import type { WorkoutLog } from '../domain/workoutLog/types'
import type { MuscleGroupId } from '../domain/muscles/muscleTaxonomy'
import type { MuscleLoadEntry } from '../domain/acwr/acwr'
import { getExerciseById } from '../domain/exerciseLibrary/exerciseLibrary'
import { hardSetCount } from '../domain/workoutLog/workoutLog'

/**
 * Aggregates real logged workouts into the per-muscle time series that
 * acwr.ts's acuteLoad/chronicLoad/acwr/classifyAcwrZone/isDetrainingRisk
 * (built and tested in Phase 4, never wired into any UI until now) actually
 * need. Pure aggregation, no new math: for each log, sums hardSetCount
 * (workoutLog.ts) toward `muscleGroupId` across all its non-skipped
 * exercises, bucketed by calendar date (a workout logged twice in one day
 * contributes one combined entry, not two).
 */
export function buildMuscleLoadEntries(
  workoutLogs: readonly WorkoutLog[],
  muscleGroupId: MuscleGroupId,
): MuscleLoadEntry[] {
  const hardSetsByDate = new Map<string, number>()

  for (const log of workoutLogs) {
    const date = log.completedAt.slice(0, 10)
    let dailyHardSets = hardSetsByDate.get(date) ?? 0

    for (const exerciseLog of log.exerciseLogs) {
      if (exerciseLog.skipped) continue
      const exercise = getExerciseById(exerciseLog.exerciseId)
      if (!exercise) continue
      dailyHardSets += hardSetCount(exerciseLog, muscleGroupId, exercise.primaryMuscles, exercise.secondaryMuscles)
    }

    if (dailyHardSets > 0) {
      hardSetsByDate.set(date, dailyHardSets)
    }
  }

  return Array.from(hardSetsByDate.entries())
    .map(([date, hardSets]) => ({ date, hardSets }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
