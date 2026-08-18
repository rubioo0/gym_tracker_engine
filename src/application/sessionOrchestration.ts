import { MUSCLE_GROUPS, type MuscleGroupId } from '../domain/muscles/muscleTaxonomy'
import { getVolumeLandmark } from '../domain/volumeLandmarks/landmarks'
import { targetWeeklySets, exerciseCountForMuscle, selectPrimaryAndAccessories } from '../domain/specialization/specialization'
import { assignMusclesToSessions } from '../domain/sessionAssembly/sessionSplit'
import {
  orderExercises,
  cutExercisesToFitBudget,
  findHomeFriendlySubstitute,
  type OrderableExercise,
  type PlannedExerciseSlot,
} from '../domain/sessionAssembly/sessionAssembly'
import { getExerciseById, getExercisesTargeting, type LibraryExercise } from '../domain/exerciseLibrary/exerciseLibrary'
import { sortedCandidatesForMuscle } from './exerciseRecommendation'

export interface AssembleSessionInput {
  focusMuscle: MuscleGroupId
  /** The active goal's exercise — always the primary lift for the focus muscle (this IS what the user is training toward), not re-recommended. */
  goalExerciseId: string
  injuredMuscles: readonly MuscleGroupId[]
  sessionsPerWeek: number
  /** How many sessions have been logged since the current block started — determines which slot in the weekly rotation "today" is, per the session-count-based (not calendar-based) design (grooming finding #7). */
  completedSessionsInBlock: number
  noGymToday: boolean
  availableMinutes: number
}

export interface AssembledExerciseSlot {
  exercise: LibraryExercise
  muscleGroupId: MuscleGroupId
  isGoalPriority: boolean
  sets: number
}

/** Splits `totalSets` as evenly as possible across `exerciseCount` exercises, giving any remainder to the earliest ones (the primary lift, since callers pass [primary, ...accessories] in that order). */
function distributeSetsEvenly(totalSets: number, exerciseCount: number): number[] {
  if (exerciseCount === 0) return []
  const base = Math.floor(totalSets / exerciseCount)
  const remainder = totalSets - base * exerciseCount
  return Array.from({ length: exerciseCount }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * The core "engine assembles your session" orchestration — composes every
 * domain module built across phases 0-9 plus the exercise recommendation
 * helper, per the application-layer grooming's finding #2. A pure function:
 * all inputs (including the per-session time/gym-access flags, which are
 * NOT part of the stored profile per the locked decision) are passed in
 * explicitly, no hidden reads from state/Date.now()/etc.
 */
export function assembleTodaysSession(input: AssembleSessionInput): AssembledExerciseSlot[] {
  const maintenanceMuscles = MUSCLE_GROUPS.map((g) => g.id).filter(
    (m) => m !== input.focusMuscle && !input.injuredMuscles.includes(m),
  )

  if (input.sessionsPerWeek <= 0) return []
  const sessions = assignMusclesToSessions(input.focusMuscle, maintenanceMuscles, input.sessionsPerWeek)
  const sessionIndex = input.completedSessionsInBlock % input.sessionsPerWeek
  const musclesToday = sessions[sessionIndex].muscles

  const slots: AssembledExerciseSlot[] = []

  for (const muscleGroupId of musclesToday) {
    const isFocus = muscleGroupId === input.focusMuscle
    const exerciseCount = exerciseCountForMuscle(muscleGroupId)
    const weeklyTarget = targetWeeklySets(getVolumeLandmark(muscleGroupId), isFocus)
    // Focus muscle appears in every session (assignMusclesToSessions), so its weekly target is spread across all sessionsPerWeek; each maintenance muscle appears in exactly one session per week (round-robin), so it gets its full weekly target that single time.
    const sessionsForThisMuscle = isFocus ? input.sessionsPerWeek : 1
    const setsThisSession = Math.round(weeklyTarget / sessionsForThisMuscle)

    // A muscle whose target rounds to zero sets (several maintenance
    // muscles have MV=0 in the volume-landmark data — e.g. front delts,
    // biceps, glutes — meaning they get enough indirect work from other
    // lifts and need no dedicated maintenance work) shouldn't consume a
    // session slot on a pointless zero-set "exercise." Caught by trying to
    // write a "every slot has >= 1 set" test and having it correctly fail.
    if (setsThisSession <= 0) continue

    let primary: LibraryExercise | undefined
    let accessories: LibraryExercise[]

    if (isFocus) {
      primary = getExerciseById(input.goalExerciseId)
      accessories = sortedCandidatesForMuscle(muscleGroupId)
        .filter((ex) => ex.id !== input.goalExerciseId)
        .slice(0, exerciseCount - 1)
    } else {
      const selection = selectPrimaryAndAccessories(sortedCandidatesForMuscle(muscleGroupId), muscleGroupId)
      primary = selection?.primary
      accessories = selection?.accessories ?? []
    }

    if (!primary) continue // no exercise available for this muscle at all — skip rather than error, a real gap in the library for an obscure muscle shouldn't crash session assembly

    const exercisesForMuscle = [primary, ...accessories]
    const setsPerExercise = distributeSetsEvenly(setsThisSession, exercisesForMuscle.length)

    exercisesForMuscle.forEach((exercise, i) => {
      const resolvedExercise = input.noGymToday
        ? (findHomeFriendlySubstitute(exercise, getExercisesTargeting(muscleGroupId)) ?? exercise)
        : exercise
      slots.push({ exercise: resolvedExercise, muscleGroupId, isGoalPriority: isFocus, sets: setsPerExercise[i] })
    })
  }

  // NSCA tiering + goal priority (sessionAssembly.ts's orderExercises operates on a slimmer interface; correlate back to the full slots by array index since an exercise/muscle pair is unique per session by construction).
  const orderable: OrderableExercise[] = slots.map((slot, i) => ({
    id: String(i),
    mechanic: slot.exercise.mechanic,
    isGoalPriority: slot.isGoalPriority,
  }))
  const orderedIndices = orderExercises(orderable).map((o) => Number(o.id))
  const orderedSlots = orderedIndices.map((i) => slots[i])

  // Time-crunch cut: drop lowest-priority (last, after ordering) exercises to fit the reported time budget, per "cut whole exercises, keep sets-per-remaining-exercise."
  const plannedSlots: PlannedExerciseSlot[] = orderedSlots.map((slot, i) => ({ exerciseId: String(i), sets: slot.sets }))
  const fitted = cutExercisesToFitBudget(plannedSlots, input.availableMinutes)
  const fittedCount = fitted.length
  return orderedSlots.slice(0, fittedCount)
}
