/** See acwr.md for the full derivation and worked examples. */

import { localDateKey, parseLocalDateKey } from '../dateUtils'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const ACUTE_WINDOW_DAYS = 7
const CHRONIC_WINDOW_DAYS = 28
const CHRONIC_WEEKS = CHRONIC_WINDOW_DAYS / 7

export const ACWR_SAFETY_CEILING = 1.3
export const DETRAINING_RISK_THRESHOLD_DAYS = 14

export interface MuscleLoadEntry {
  /** ISO date/timestamp of the workout this load came from. */
  date: string
  /** Hard-set contribution to this specific muscle (see workoutLog.ts's hardSetCount). */
  hardSets: number
}

/**
 * Day-offset of `date` before `asOf`, e.g. 0 = same day, 1 = yesterday.
 * Negative if `date` is in the future relative to `asOf`. Compares LOCAL
 * calendar days, not raw UTC-instant subtraction — accepts either a bare
 * "YYYY-MM-DD" (already a local-date-key, e.g. from muscleLoadHistory.ts)
 * or a full ISO timestamp (converted to its local calendar day first).
 */
function daysBefore(date: string, asOf: Date): number {
  const dateKey = date.length === 10 ? date : localDateKey(date)
  const dateMs = parseLocalDateKey(dateKey).getTime()
  const asOfMs = parseLocalDateKey(localDateKey(asOf)).getTime()
  return Math.floor((asOfMs - dateMs) / MS_PER_DAY)
}

/** Sum of hardSets for entries within the last `windowDays` days up to and including `asOf` (half-open: day-offsets 0..windowDays-1). */
function sumWithinWindow(entries: readonly MuscleLoadEntry[], asOf: Date, windowDays: number): number {
  return entries
    .filter((e) => {
      const offset = daysBefore(e.date, asOf)
      return offset >= 0 && offset < windowDays
    })
    .reduce((sum, e) => sum + e.hardSets, 0)
}

export function acuteLoad(entries: readonly MuscleLoadEntry[], asOf: Date): number {
  return sumWithinWindow(entries, asOf, ACUTE_WINDOW_DAYS)
}

export function chronicLoad(entries: readonly MuscleLoadEntry[], asOf: Date): number {
  return sumWithinWindow(entries, asOf, CHRONIC_WINDOW_DAYS)
}

/**
 * Acute:chronic workload ratio. The chronic (28-day) window always fully
 * contains the acute (7-day) window, so "chronic load is zero" implies
 * acute load is zero too — there is no reachable state where chronic is
 * zero but acute is nonzero. Returns 0 (no load, no risk) in that case.
 *
 * The `number | null` return type is kept for a genuinely different
 * cold-start problem this function does NOT yet solve: a user with, say,
 * only 3 days of any tracked history at all gets an artificially volatile
 * ratio (a small chronic window inflates or deflates the average sharply).
 * Deciding a minimum-tracked-days threshold for a real "insufficientData"
 * signal is a real refinement, not yet a locked decision — flagged here
 * rather than invented. Callers should not assume `null` is currently
 * reachable; `classifyAcwrZone` still handles it gracefully if a future
 * change reintroduces it.
 */
export function acwr(entries: readonly MuscleLoadEntry[], asOf: Date): number | null {
  const acute = acuteLoad(entries, asOf)
  const chronicWeeklyAverage = chronicLoad(entries, asOf) / CHRONIC_WEEKS
  if (chronicWeeklyAverage === 0) {
    return 0 // implies acute is also 0, given the acute window is a subset of the chronic window
  }
  return acute / chronicWeeklyAverage
}

export type AcwrZone = 'insufficientData' | 'low' | 'safe' | 'elevated' | 'high'

/** Informational zone classification for display/advisory purposes — see acwr.md for the research-backed thresholds. Distinct from the hard ACWR_SAFETY_CEILING used by exceedsCeiling(). */
export function classifyAcwrZone(ratio: number | null): AcwrZone {
  if (ratio === null) return 'insufficientData'
  if (ratio < 0.8) return 'low'
  if (ratio <= 1.3) return 'safe'
  if (ratio <= 1.5) return 'elevated'
  return 'high'
}

/** Whether the ratio exceeds the hard 1.3 safety ceiling used by the plan-compression bound and the deload trigger. null (insufficient data) never exceeds it. */
export function exceedsCeiling(ratio: number | null): boolean {
  return ratio !== null && ratio > ACWR_SAFETY_CEILING
}

/** Days since the most recent load entry, or null if there are no entries at all. */
export function daysSinceLastLoad(entries: readonly MuscleLoadEntry[], asOf: Date): number | null {
  if (entries.length === 0) return null
  const mostRecentOffset = Math.min(...entries.map((e) => daysBefore(e.date, asOf)))
  return mostRecentOffset < 0 ? 0 : mostRecentOffset // a future-dated entry (shouldn't happen) still reads as "today"
}

/** True once a muscle has gone >= 14 days without any load — see acwr.md for why 14, not the full 21. */
export function isDetrainingRisk(entries: readonly MuscleLoadEntry[], asOf: Date): boolean {
  const days = daysSinceLastLoad(entries, asOf)
  return days !== null && days >= DETRAINING_RISK_THRESHOLD_DAYS
}

export interface ApreSessionOutcome {
  targetReps: number
  actualReps: number
}

/**
 * Walks a chronological (oldest-first) list of APRE outcomes from the most
 * recent backward, counting consecutive "held" (missed-target) sessions
 * before the first progressed one. See acwr.md worked example.
 */
export function countConsecutiveHeldSessions(sessionsOldestFirst: readonly ApreSessionOutcome[]): number {
  let count = 0
  for (let i = sessionsOldestFirst.length - 1; i >= 0; i--) {
    const session = sessionsOldestFirst[i]
    if (session.actualReps < session.targetReps) {
      count++
    } else {
      break
    }
  }
  return count
}

/** Implements the locked deload-trigger decision: ACWR danger zone OR 2+ consecutive held sessions. */
export function shouldDeload(ratio: number | null, consecutiveHeldSessions: number): boolean {
  return exceedsCeiling(ratio) || consecutiveHeldSessions >= 2
}
