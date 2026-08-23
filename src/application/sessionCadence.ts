import type { WorkoutLog } from '../domain/workoutLog/types'
import type { SpecializationBlock } from '../domain/specialization/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Matches the old app's own default for <2 logs (logic.ts's calculateAvgDaysBetweenSessions) -- roughly twice a week. */
export const DEFAULT_AVG_DAYS_BETWEEN_SESSIONS = 3.5

/**
 * Average day-gap between consecutive logged sessions (oldest-first) --
 * ported from the old app's calculateAvgDaysBetweenSessions (logic.ts),
 * adapted to the new engine's WorkoutLog shape. Same algorithm: sort by
 * date, average the gaps between consecutive entries, default when there
 * isn't enough real history yet to compute a meaningful average from.
 */
export function calculateAvgDaysBetweenSessions(workoutLogs: readonly WorkoutLog[]): number {
  if (workoutLogs.length < 2) return DEFAULT_AVG_DAYS_BETWEEN_SESSIONS

  const sorted = workoutLogs.slice().sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1))
  let totalGapDays = 0
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = new Date(sorted[i].completedAt).getTime() - new Date(sorted[i - 1].completedAt).getTime()
    totalGapDays += gapMs / MS_PER_DAY
  }
  return totalGapDays / (sorted.length - 1)
}

export interface CalendarEntry {
  date: string // ISO date (YYYY-MM-DD)
  isProjected: boolean
  workoutLogId?: string
}

export const DEFAULT_PROJECTED_SESSIONS_AHEAD = 6

/**
 * The active block's logged sessions (✓, dated, real) plus a handful of
 * projected upcoming ones (→, dated, estimated from the learned cadence
 * above) -- same spirit as the old app's buildProgramCalendar, but without
 * a fixed session-count/template to iterate against: future dates are
 * simple linear extrapolation from the last logged date (or `asOf` if
 * nothing's logged in this block yet) using the learned average cadence.
 */
export function projectUpcomingSessions(
  block: SpecializationBlock,
  workoutLogs: readonly WorkoutLog[],
  asOf: Date,
  countAhead: number = DEFAULT_PROJECTED_SESSIONS_AHEAD,
): CalendarEntry[] {
  const blockStartMs = new Date(block.startedAt).getTime()
  const blockEndMs = block.endedAt ? new Date(block.endedAt).getTime() : Number.POSITIVE_INFINITY

  const logsInBlock = workoutLogs
    .filter((log) => {
      const t = new Date(log.completedAt).getTime()
      return t >= blockStartMs && t <= blockEndMs
    })
    .slice()
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1))

  const pastEntries: CalendarEntry[] = logsInBlock.map((log) => ({
    date: log.completedAt.slice(0, 10),
    isProjected: false,
    workoutLogId: log.id,
  }))

  const avgDays = calculateAvgDaysBetweenSessions(logsInBlock)
  const lastKnownMs =
    logsInBlock.length > 0 ? new Date(logsInBlock[logsInBlock.length - 1].completedAt).getTime() : asOf.getTime()

  const futureEntries: CalendarEntry[] = Array.from({ length: Math.max(countAhead, 0) }, (_, i) => {
    const projectedMs = lastKnownMs + (i + 1) * avgDays * MS_PER_DAY
    return { date: new Date(projectedMs).toISOString().slice(0, 10), isProjected: true }
  })

  return [...pastEntries, ...futureEntries]
}
