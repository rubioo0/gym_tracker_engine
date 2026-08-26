import type { AssembledExerciseSlot } from './sessionOrchestration'
import type { ExerciseLog, SetEntry, WorkoutLog } from '../domain/workoutLog/types'
import type { Goal, TrainingEmphasis } from '../domain/goals/types'
import { rampSets, nextWorkingWeight } from '../domain/apre/apre'
import { topSet } from '../domain/workoutLog/workoutLog'
import { countConsecutiveHeldSessions, type ApreSessionOutcome } from '../domain/acwr/acwr'

/**
 * Target rep count per training emphasis — the locked "training-emphasis
 * default (classic NSCA zones), user-overridable" decision. Not a fresh
 * number: strength ≈ low reps, hypertrophy ≈ moderate reps.
 */
export const TARGET_REPS_BY_EMPHASIS: Record<TrainingEmphasis, number> = {
  strength: 5,
  hypertrophy: 10,
}

/** Standard plate-loading increment — same constant already used for target-weight rounding in goalRecommendation.ts, reused here rather than inventing a second number. */
export const WEIGHT_INCREMENT_KG = 2.5

export interface PrescribedSet {
  weightKg: number
  targetReps: number
  role: SetEntry['role']
}

export interface ExercisePrescription {
  exerciseId: string
  sets: PrescribedSet[]
}

/** The most recent (by completedAt, not array position) non-skipped top working set logged for an exercise — shared with anything that needs "what did I last lift for X" (goal-progress views, this module's own prescriptions). */
export function mostRecentTopSet(
  workoutLogs: readonly WorkoutLog[],
  exerciseId: string,
): SetEntry | undefined {
  let bestLog: WorkoutLog | undefined
  let bestExerciseLog: ExerciseLog | undefined
  for (const log of workoutLogs) {
    const exerciseLog = log.exerciseLogs.find((e) => e.exerciseId === exerciseId && !e.skipped)
    if (!exerciseLog) continue
    if (!bestLog || log.completedAt > bestLog.completedAt) {
      bestLog = log
      bestExerciseLog = exerciseLog
    }
  }
  return bestExerciseLog ? topSet(bestExerciseLog) : undefined
}

/**
 * Prescribes actual weight/rep targets for one assembled slot — the wiring
 * that was missing between the domain layer's APRE/workoutLog math (built
 * and tested in Phases 2-3) and any real UI. The goal exercise gets the full
 * APRE treatment (ramp sets off last working weight, then working sets at
 * today's prescribed weight, computed via nextWorkingWeight from the most
 * recent session's top set); every other exercise uses "repeat last
 * weight" per the locked maintenance-progression decision, with no ramp.
 * First time an exercise appears with no history at all: the goal exercise
 * falls back to the goal's own startingWeightKg (that's literally what the
 * user declared); anything else honestly falls back to 0 rather than
 * guessing — same "no history, enter manually" pattern as the Setup form.
 */
export function prescribeExercise(
  slot: AssembledExerciseSlot,
  goal: Goal,
  workoutLogs: readonly WorkoutLog[],
): ExercisePrescription {
  const targetReps = TARGET_REPS_BY_EMPHASIS[goal.trainingEmphasis]
  const previousTopSet = mostRecentTopSet(workoutLogs, slot.exercise.id)
  const workingSetCount = Math.max(slot.sets, 1)

  if (slot.isGoalPriority) {
    const workingWeightKg = previousTopSet
      ? nextWorkingWeight({
          previousWorkingWeightKg: previousTopSet.weightKg,
          targetReps,
          actualReps: previousTopSet.reps,
          incrementKg: WEIGHT_INCREMENT_KG,
        })
      : goal.startingWeightKg

    const ramps: PrescribedSet[] = rampSets(workingWeightKg).map((r) => ({
      weightKg: r.weightKg,
      targetReps,
      role: 'ramp',
    }))
    const working: PrescribedSet[] = Array.from({ length: workingSetCount }, () => ({
      weightKg: workingWeightKg,
      targetReps,
      role: 'working',
    }))
    return { exerciseId: slot.exercise.id, sets: [...ramps, ...working] }
  }

  const repeatWeightKg = previousTopSet?.weightKg ?? 0
  const working: PrescribedSet[] = Array.from({ length: workingSetCount }, () => ({
    weightKg: repeatWeightKg,
    targetReps,
    role: 'working',
  }))
  return { exerciseId: slot.exercise.id, sets: working }
}

/**
 * How many of the most recent sessions for a goal's exercise, walking
 * backward, missed the target rep count in a row — the engine's analogue of
 * the old app's "held cycle" indicator, reusing the already-tested
 * countConsecutiveHeldSessions (domain/acwr/acwr.ts) instead of resurrecting
 * that app's fixed-frequency-cycle math, which doesn't apply to APRE.
 */
export function goalHeldStreak(workoutLogs: readonly WorkoutLog[], goal: Goal): number {
  const targetReps = TARGET_REPS_BY_EMPHASIS[goal.trainingEmphasis]
  const outcomes: ApreSessionOutcome[] = workoutLogs
    .slice()
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1))
    .flatMap((log) => {
      const exerciseLog = log.exerciseLogs.find((e) => e.exerciseId === goal.exerciseId && !e.skipped)
      const top = exerciseLog ? topSet(exerciseLog) : undefined
      return top ? [{ targetReps, actualReps: top.reps }] : []
    })
  return countConsecutiveHeldSessions(outcomes)
}

export function prescribeSession(
  slots: readonly AssembledExerciseSlot[],
  goal: Goal,
  workoutLogs: readonly WorkoutLog[],
): ExercisePrescription[] {
  return slots.map((slot) => prescribeExercise(slot, goal, workoutLogs))
}
