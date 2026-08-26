import type { AssembledExerciseSlot } from './sessionOrchestration'
import type { ExerciseLog, SetEntry, WorkoutLog } from '../domain/workoutLog/types'
import type { Goal, TrainingEmphasis } from '../domain/goals/types'
import type { MuscleGroupId } from '../domain/muscles/muscleTaxonomy'
import { rampSets, nextWorkingWeight } from '../domain/apre/apre'
import { topSet } from '../domain/workoutLog/workoutLog'
import {
  countConsecutiveHeldSessions,
  shouldDeload,
  acwr,
  DETRAINING_RISK_THRESHOLD_DAYS,
  type ApreSessionOutcome,
} from '../domain/acwr/acwr'
import { suggestResumptionWeight } from '../domain/autoCorrection/autoCorrection'
import { buildMuscleLoadEntries } from './muscleLoadHistory'

const MS_PER_DAY = 24 * 60 * 60 * 1000

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

/** mostRecentTopSet's result plus when it happened — the date is needed to detect a returning-after-a-gap resumption case, which weight alone can't tell you. */
export interface RecentTopSetEntry extends SetEntry {
  completedAt: string
}

function mostRecentTopSetEntry(
  workoutLogs: readonly WorkoutLog[],
  exerciseId: string,
): RecentTopSetEntry | undefined {
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
  if (!bestLog || !bestExerciseLog) return undefined
  const top = topSet(bestExerciseLog)
  return top ? { ...top, completedAt: bestLog.completedAt } : undefined
}

/** The most recent (by completedAt, not array position) non-skipped top working set logged for an exercise — shared with anything that needs "what did I last lift for X" (goal-progress views, this module's own prescriptions). */
export function mostRecentTopSet(
  workoutLogs: readonly WorkoutLog[],
  exerciseId: string,
): SetEntry | undefined {
  return mostRecentTopSetEntry(workoutLogs, exerciseId)
}

export interface PrescriptionOptions {
  /** Defaults to now — overridable for deterministic tests and calendar-preview simulation. */
  asOf?: Date
  /**
   * True to suppress the goal exercise's progression this session (computed
   * by the caller via shouldDeloadGoalExercise below, which needs the FULL
   * workout history for accurate ACWR windows — deliberately not computed
   * inside this function, since `workoutLogs` here is often block-scoped by
   * the caller per the Phase 0 fix, and block boundaries have nothing to do
   * with real physical fatigue). Only affects the goal-priority exercise;
   * maintenance exercises were never part of the APRE progression system
   * shouldDeload governs (see acwr.md's deload-trigger section).
   */
  deloadGoalExercise?: boolean
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
 *
 * Two corrections layered onto the plain APRE math for the goal exercise,
 * both previously built and tested but never wired into any real
 * prescription (see AUDIT.md's "autonomous layer" finding):
 * - Returning after a real gap (>= DETRAINING_RISK_THRESHOLD_DAYS since the
 *   last logged session): uses domain/autoCorrection/autoCorrection.ts's
 *   suggestResumptionWeight instead of naively applying nextWorkingWeight to
 *   a stale top set.
 * - deloadGoalExercise (see PrescriptionOptions): holds at the last logged
 *   weight instead of progressing, even if the last session hit target reps
 *   — no new formula invented here, this just gates whether the normal
 *   progression call happens at all.
 */
export function prescribeExercise(
  slot: AssembledExerciseSlot,
  goal: Goal,
  workoutLogs: readonly WorkoutLog[],
  options: PrescriptionOptions = {},
): ExercisePrescription {
  const targetReps = TARGET_REPS_BY_EMPHASIS[goal.trainingEmphasis]
  const previousTopSet = mostRecentTopSetEntry(workoutLogs, slot.exercise.id)
  const workingSetCount = Math.max(slot.sets, 1)

  if (slot.isGoalPriority) {
    const asOf = options.asOf ?? new Date()
    let workingWeightKg: number

    if (!previousTopSet) {
      workingWeightKg = goal.startingWeightKg
    } else if (options.deloadGoalExercise) {
      workingWeightKg = previousTopSet.weightKg
    } else {
      const daysSinceLastSession = Math.floor(
        (asOf.getTime() - new Date(previousTopSet.completedAt).getTime()) / MS_PER_DAY,
      )
      workingWeightKg =
        daysSinceLastSession >= DETRAINING_RISK_THRESHOLD_DAYS
          ? suggestResumptionWeight(previousTopSet.weightKg, daysSinceLastSession).suggestedWeightKg
          : nextWorkingWeight({
              previousWorkingWeightKg: previousTopSet.weightKg,
              targetReps,
              actualReps: previousTopSet.reps,
              incrementKg: WEIGHT_INCREMENT_KG,
            })
    }

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
  options: PrescriptionOptions = {},
): ExercisePrescription[] {
  return slots.map((slot) => prescribeExercise(slot, goal, workoutLogs, options))
}

/**
 * Implements the locked deload-trigger decision (domain/acwr/acwr.ts's
 * shouldDeload, "ACWR danger zone OR 2+ consecutive held sessions") for a
 * goal's focus muscle — composes it with real data for the first time
 * anywhere in the app. Two different history slices are deliberately
 * required: `acwrWorkoutLogs` should be the FULL, unscoped history (real
 * physical fatigue doesn't reset at a block boundary), while
 * `blockWorkoutLogs` should be scoped to the active block (per the Phase 0
 * fix — a previous block's held streak isn't this block's stalled
 * progress).
 */
export function shouldDeloadGoalExercise(
  acwrWorkoutLogs: readonly WorkoutLog[],
  blockWorkoutLogs: readonly WorkoutLog[],
  muscleGroupId: MuscleGroupId,
  goal: Goal,
  asOf: Date = new Date(),
): boolean {
  const loadEntries = buildMuscleLoadEntries(acwrWorkoutLogs, muscleGroupId)
  const ratio = acwr(loadEntries, asOf)
  const heldStreak = goalHeldStreak(blockWorkoutLogs, goal)
  return shouldDeload(ratio, heldStreak)
}
