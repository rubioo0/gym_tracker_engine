import { describe, expect, it } from 'vitest'
import {
  calculateAvgDaysBetweenSessions,
  projectUpcomingSessions,
  DEFAULT_AVG_DAYS_BETWEEN_SESSIONS,
} from './sessionCadence'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { SpecializationBlock } from '../domain/specialization/types'

function log(id: string, completedAt: string): WorkoutLog {
  return { id, completedAt, successful: true, exerciseLogs: [] }
}

describe('calculateAvgDaysBetweenSessions', () => {
  it('defaults to 3.5 days with zero logs (boundary condition)', () => {
    expect(calculateAvgDaysBetweenSessions([])).toBe(DEFAULT_AVG_DAYS_BETWEEN_SESSIONS)
  })

  it('defaults to 3.5 days with exactly one log (boundary condition -- no gap to compute)', () => {
    expect(calculateAvgDaysBetweenSessions([log('a', '2026-08-01T00:00:00.000Z')])).toBe(
      DEFAULT_AVG_DAYS_BETWEEN_SESSIONS,
    )
  })

  it('computes the single gap for exactly two logs', () => {
    const logs = [log('a', '2026-08-01T00:00:00.000Z'), log('b', '2026-08-08T00:00:00.000Z')]
    expect(calculateAvgDaysBetweenSessions(logs)).toBe(7)
  })

  it('averages multiple gaps (2 days then 4 days -> 3)', () => {
    const logs = [
      log('a', '2026-08-01T00:00:00.000Z'),
      log('b', '2026-08-03T00:00:00.000Z'),
      log('c', '2026-08-07T00:00:00.000Z'),
    ]
    expect(calculateAvgDaysBetweenSessions(logs)).toBe(3)
  })

  it('sorts internally -- gives the same result regardless of input order', () => {
    const inOrder = [
      log('a', '2026-08-01T00:00:00.000Z'),
      log('b', '2026-08-03T00:00:00.000Z'),
      log('c', '2026-08-07T00:00:00.000Z'),
    ]
    const shuffled = [inOrder[2], inOrder[0], inOrder[1]]
    expect(calculateAvgDaysBetweenSessions(shuffled)).toBe(calculateAvgDaysBetweenSessions(inOrder))
  })
})

describe('projectUpcomingSessions', () => {
  const BLOCK: SpecializationBlock = {
    goalId: 'g1',
    focusMuscle: 'chest',
    startedAt: '2026-08-01T00:00:00.000Z',
    endedAt: null,
  }

  it('with no logs in the block, projects from asOf using the default cadence', () => {
    const asOf = new Date('2026-08-01T00:00:00.000Z')
    const result = projectUpcomingSessions(BLOCK, [], asOf, 2)
    expect(result).toEqual([
      { date: '2026-08-04', isProjected: true }, // +3.5 days
      { date: '2026-08-08', isProjected: true }, // +7 days
    ])
  })

  it('includes real logged sessions in the block as past (non-projected) entries', () => {
    const logs = [log('a', '2026-08-03T00:00:00.000Z'), log('b', '2026-08-06T00:00:00.000Z')]
    const asOf = new Date('2026-08-06T00:00:00.000Z')
    const result = projectUpcomingSessions(BLOCK, logs, asOf, 1)
    expect(result[0]).toEqual({ date: '2026-08-03', isProjected: false, workoutLogId: 'a' })
    expect(result[1]).toEqual({ date: '2026-08-06', isProjected: false, workoutLogId: 'b' })
    // avgDays = 3 (Aug 3 -> Aug 6), projected from the last real log (Aug 6) + 3 days.
    expect(result[2]).toEqual({ date: '2026-08-09', isProjected: true })
  })

  it('excludes logs outside the block date range (boundary condition)', () => {
    const beforeBlock = log('before', '2026-07-15T00:00:00.000Z')
    const inBlock = log('in', '2026-08-05T00:00:00.000Z')
    const result = projectUpcomingSessions(BLOCK, [beforeBlock, inBlock], new Date('2026-08-05T00:00:00.000Z'), 0)
    expect(result).toEqual([{ date: '2026-08-05', isProjected: false, workoutLogId: 'in' }])
  })

  it('excludes logs after the block ended (boundary condition)', () => {
    const endedBlock: SpecializationBlock = { ...BLOCK, endedAt: '2026-08-10T00:00:00.000Z' }
    const inBlock = log('in', '2026-08-05T00:00:00.000Z')
    const afterEnd = log('after', '2026-08-15T00:00:00.000Z')
    const result = projectUpcomingSessions(endedBlock, [inBlock, afterEnd], new Date('2026-08-20T00:00:00.000Z'), 0)
    expect(result).toEqual([{ date: '2026-08-05', isProjected: false, workoutLogId: 'in' }])
  })

  it('countAhead=0 produces no projected entries (boundary condition)', () => {
    const result = projectUpcomingSessions(BLOCK, [], new Date('2026-08-01T00:00:00.000Z'), 0)
    expect(result).toEqual([])
  })
})
