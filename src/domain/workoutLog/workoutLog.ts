import type { MuscleGroupId } from '../muscles/muscleTaxonomy'
import type { ExerciseLog, SetEntry } from './types'

export const SECONDARY_MUSCLE_LOAD_FRACTION = 0.5

/**
 * Hard-set contribution of one exercise log toward a specific muscle group,
 * per the locked "secondary-muscle load fraction: 0.5x" decision. See
 * workoutLog.md for the full derivation and worked example.
 */
function workingSets(log: ExerciseLog): SetEntry[] {
  if (log.skipped) return []
  return log.sets.filter((set) => set.role === 'working')
}

export function hardSetCount(
  log: ExerciseLog,
  muscleGroupId: MuscleGroupId,
  exercisePrimaryMuscles: readonly MuscleGroupId[],
  exerciseSecondaryMuscles: readonly MuscleGroupId[],
): number {
  const count = workingSets(log).length
  if (exercisePrimaryMuscles.includes(muscleGroupId)) {
    return count * 1
  }
  if (exerciseSecondaryMuscles.includes(muscleGroupId)) {
    return count * SECONDARY_MUSCLE_LOAD_FRACTION
  }
  return 0
}

/** Standard tonnage: sum of weight x reps across WORKING sets only (ramp sets excluded, same as hardSetCount). 0 for a skipped log. */
export function totalVolumeKg(log: ExerciseLog): number {
  return workingSets(log).reduce((sum, set) => sum + set.weightKg * set.reps, 0)
}

/**
 * The working set with the highest weight (ties broken by higher reps);
 * ramp sets are never considered. Undefined for a skipped log or a log with
 * no working sets. See workoutLog.md — this is the input for the APRE
 * ramp-set basis (apre.ts): "% of last session's working weight".
 */
export function topSet(log: ExerciseLog): SetEntry | undefined {
  const sets = workingSets(log)
  if (sets.length === 0) return undefined
  return sets.reduce((best, set) => {
    if (set.weightKg > best.weightKg) return set
    if (set.weightKg === best.weightKg && set.reps > best.reps) return set
    return best
  })
}
