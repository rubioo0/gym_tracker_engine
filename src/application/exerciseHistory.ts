import type { WorkoutLog } from '../domain/workoutLog/types'
import { topSet } from '../domain/workoutLog/workoutLog'

export interface ExerciseHistoryEntry {
  completedAt: string
  weightKg: number
  reps: number
}

/**
 * Up to `limit` most recent non-skipped top-set entries for an exercise,
 * newest first — the new engine's equivalent of the old app's
 * `getRecentExerciseHistory`/`.exercise-history-chip` list shown on session
 * cards. Reuses the same "top working set per log" concept as
 * sessionPrescription.ts's mostRecentTopSet, just keeping several entries
 * instead of only the single most recent one.
 */
export function recentExerciseHistory(
  workoutLogs: readonly WorkoutLog[],
  exerciseId: string,
  limit: number,
): ExerciseHistoryEntry[] {
  const entries: ExerciseHistoryEntry[] = []
  for (const log of workoutLogs) {
    const exerciseLog = log.exerciseLogs.find((e) => e.exerciseId === exerciseId && !e.skipped)
    if (!exerciseLog) continue
    const best = topSet(exerciseLog)
    if (!best) continue
    entries.push({ completedAt: log.completedAt, weightKg: best.weightKg, reps: best.reps })
  }
  return entries.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)).slice(0, limit)
}
