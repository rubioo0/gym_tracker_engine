import { describe, expect, it } from 'vitest'
import { recentExerciseHistory } from './exerciseHistory'
import type { WorkoutLog } from '../domain/workoutLog/types'

function log(id: string, completedAt: string, weightKg: number, reps: number, skipped = false): WorkoutLog {
  return {
    id,
    completedAt,
    successful: true,
    exerciseLogs: [
      {
        exerciseId: 'x1',
        skipped,
        sets: skipped ? [] : [{ weightKg, reps, role: 'working' }],
      },
    ],
  }
}

describe('recentExerciseHistory', () => {
  it('returns an empty array when there is no history at all (boundary condition)', () => {
    expect(recentExerciseHistory([], 'x1', 3)).toEqual([])
  })

  it('returns entries newest-first', () => {
    const logs = [log('a', '2026-08-01T00:00:00.000Z', 20, 8), log('b', '2026-08-05T00:00:00.000Z', 22.5, 6)]
    expect(recentExerciseHistory(logs, 'x1', 3)).toEqual([
      { completedAt: '2026-08-05T00:00:00.000Z', weightKg: 22.5, reps: 6 },
      { completedAt: '2026-08-01T00:00:00.000Z', weightKg: 20, reps: 8 },
    ])
  })

  it('caps at `limit` entries even when more history exists (boundary condition)', () => {
    const logs = [
      log('a', '2026-08-01T00:00:00.000Z', 20, 8),
      log('b', '2026-08-02T00:00:00.000Z', 20, 8),
      log('c', '2026-08-03T00:00:00.000Z', 20, 8),
      log('d', '2026-08-04T00:00:00.000Z', 20, 8),
    ]
    expect(recentExerciseHistory(logs, 'x1', 3)).toHaveLength(3)
  })

  it('ignores skipped exercise logs', () => {
    const logs = [log('a', '2026-08-01T00:00:00.000Z', 20, 8), log('b', '2026-08-05T00:00:00.000Z', 999, 999, true)]
    expect(recentExerciseHistory(logs, 'x1', 3)).toEqual([{ completedAt: '2026-08-01T00:00:00.000Z', weightKg: 20, reps: 8 }])
  })

  it('ignores logs for a different exercise', () => {
    const other: WorkoutLog = {
      id: 'a',
      completedAt: '2026-08-01T00:00:00.000Z',
      successful: true,
      exerciseLogs: [{ exerciseId: 'other', skipped: false, sets: [{ weightKg: 50, reps: 5, role: 'working' }] }],
    }
    expect(recentExerciseHistory([other], 'x1', 3)).toEqual([])
  })

  it('limit of 0 returns an empty array (boundary condition)', () => {
    const logs = [log('a', '2026-08-01T00:00:00.000Z', 20, 8)]
    expect(recentExerciseHistory(logs, 'x1', 0)).toEqual([])
  })
})
