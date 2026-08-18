import type { WorkoutLog as OldAppWorkoutLog } from '../domain/types'
import { OLD_APP_EXERCISE_ALIASES } from '../domain/exerciseLibrary/oldAppAliases'

const KG_PER_LB = 0.45359237

function toKg(weight: number, unit: string | undefined): number {
  return (unit ?? 'kg').toLowerCase().includes('lb') ? weight * KG_PER_LB : weight
}

/**
 * Suggests a starting weight for a new goal by looking up the most recent
 * actual weight the user logged for this exercise in the old app's own
 * history — real data already sitting in this merged app, per the "auto-
 * suggest from your own input data" pattern used throughout (see
 * goalRecommendation.ts for target/deadline). Only exercises covered by the
 * hand-reviewed old-app alias table (oldAppAliases.ts) can match — an
 * exercise the user never logged, or one added to the 882-exercise library
 * that has no old-app equivalent, honestly returns null rather than
 * guessing. Old-app logs recorded in lbs are converted to kg; unitless logs
 * are assumed kg, matching the old app's own convention (logic.ts).
 */
export function suggestStartingWeightFromOldApp(
  oldWorkoutLogs: readonly OldAppWorkoutLog[],
  exerciseId: string,
): number | null {
  const matchingNames = new Set(
    Object.entries(OLD_APP_EXERCISE_ALIASES)
      .filter(([, id]) => id === exerciseId)
      .map(([name]) => name),
  )
  if (matchingNames.size === 0) return null

  let bestWeightKg: number | null = null
  let bestCompletedAt: string | null = null
  for (const log of oldWorkoutLogs) {
    for (const exerciseLog of log.exerciseLogs) {
      if (exerciseLog.actualWeight === undefined) continue
      if (!matchingNames.has(exerciseLog.exerciseName)) continue
      if (bestCompletedAt === null || log.completedAt > bestCompletedAt) {
        bestCompletedAt = log.completedAt
        bestWeightKg = toKg(exerciseLog.actualWeight, exerciseLog.weightUnit)
      }
    }
  }
  return bestWeightKg
}
