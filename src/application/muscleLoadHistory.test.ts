import { describe, expect, it } from 'vitest'
import { buildMuscleLoadEntries } from './muscleLoadHistory'
import type { WorkoutLog } from '../domain/workoutLog/types'

// Barbell_Curl: primary biceps, secondary forearms (see domain/exerciseLibrary data).
function curlLog(id: string, completedAt: string, workingSets: number, skipped = false): WorkoutLog {
  return {
    id,
    completedAt,
    successful: true,
    exerciseLogs: [
      {
        exerciseId: 'Barbell_Curl',
        skipped,
        sets: Array.from({ length: workingSets }, () => ({ weightKg: 20, reps: 8, role: 'working' as const })),
      },
    ],
  }
}

describe('buildMuscleLoadEntries', () => {
  it('sums hard sets at full weight for the primary muscle', () => {
    const result = buildMuscleLoadEntries([curlLog('a', '2026-08-01T10:00:00.000Z', 3)], 'biceps')
    expect(result).toEqual([{ date: '2026-08-01', hardSets: 3 }])
  })

  it('sums hard sets at 0.5x for a secondary muscle', () => {
    const result = buildMuscleLoadEntries([curlLog('a', '2026-08-01T10:00:00.000Z', 3)], 'forearms')
    expect(result).toEqual([{ date: '2026-08-01', hardSets: 1.5 }])
  })

  it('contributes zero for a muscle the exercise does not target at all (boundary condition)', () => {
    const result = buildMuscleLoadEntries([curlLog('a', '2026-08-01T10:00:00.000Z', 3)], 'quads')
    expect(result).toEqual([])
  })

  it('ignores a skipped exercise log entirely', () => {
    const result = buildMuscleLoadEntries([curlLog('a', '2026-08-01T10:00:00.000Z', 3, true)], 'biceps')
    expect(result).toEqual([])
  })

  it('combines two logs on the same calendar date into one entry', () => {
    const result = buildMuscleLoadEntries(
      [curlLog('a', '2026-08-01T08:00:00.000Z', 2), curlLog('b', '2026-08-01T18:00:00.000Z', 1)],
      'biceps',
    )
    expect(result).toEqual([{ date: '2026-08-01', hardSets: 3 }])
  })

  it('keeps separate dates as separate entries, sorted oldest-first', () => {
    const result = buildMuscleLoadEntries(
      [curlLog('a', '2026-08-05T10:00:00.000Z', 2), curlLog('b', '2026-08-01T10:00:00.000Z', 3)],
      'biceps',
    )
    expect(result).toEqual([
      { date: '2026-08-01', hardSets: 3 },
      { date: '2026-08-05', hardSets: 2 },
    ])
  })

  it('skips an exerciseId not found in the library rather than throwing (boundary condition)', () => {
    const log: WorkoutLog = {
      id: 'a',
      completedAt: '2026-08-01T10:00:00.000Z',
      successful: true,
      exerciseLogs: [{ exerciseId: 'not-a-real-exercise', skipped: false, sets: [{ weightKg: 20, reps: 8, role: 'working' }] }],
    }
    expect(buildMuscleLoadEntries([log], 'biceps')).toEqual([])
  })

  it('returns an empty array for no logs at all (boundary condition)', () => {
    expect(buildMuscleLoadEntries([], 'biceps')).toEqual([])
  })
})
