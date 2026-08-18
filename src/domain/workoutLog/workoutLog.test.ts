import { describe, expect, it } from 'vitest'
import type { ExerciseLog } from './types'
import { hardSetCount, totalVolumeKg, topSet, SECONDARY_MUSCLE_LOAD_FRACTION } from './workoutLog'

const PRIMARY = ['chest'] as const
const SECONDARY = ['triceps', 'front_delts'] as const

function fourSetBenchLog(overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    exerciseId: 'Barbell_Bench_Press',
    skipped: false,
    sets: [
      { weightKg: 60, reps: 8, role: 'working' },
      { weightKg: 60, reps: 8, role: 'working' },
      { weightKg: 60, reps: 7, role: 'working' },
      { weightKg: 60, reps: 6, role: 'working' },
    ],
    ...overrides,
  }
}

describe('hardSetCount (worked example from workoutLog.md)', () => {
  it('counts each set fully toward a primary muscle', () => {
    const log = fourSetBenchLog()
    expect(hardSetCount(log, 'chest', [...PRIMARY], [...SECONDARY])).toBe(4)
  })

  it('counts each set at the secondary fraction toward a secondary muscle', () => {
    const log = fourSetBenchLog()
    expect(hardSetCount(log, 'triceps', [...PRIMARY], [...SECONDARY])).toBe(4 * SECONDARY_MUSCLE_LOAD_FRACTION)
    expect(hardSetCount(log, 'front_delts', [...PRIMARY], [...SECONDARY])).toBe(2)
  })

  it('contributes zero toward a muscle the exercise does not target at all', () => {
    const log = fourSetBenchLog()
    expect(hardSetCount(log, 'back', [...PRIMARY], [...SECONDARY])).toBe(0)
  })

  it('contributes zero for a skipped exercise log, regardless of muscle role (boundary condition)', () => {
    const log = fourSetBenchLog({ skipped: true })
    expect(hardSetCount(log, 'chest', [...PRIMARY], [...SECONDARY])).toBe(0)
    expect(hardSetCount(log, 'triceps', [...PRIMARY], [...SECONDARY])).toBe(0)
  })

  it('contributes zero for a log with no sets (boundary condition)', () => {
    const log = fourSetBenchLog({ sets: [] })
    expect(hardSetCount(log, 'chest', [...PRIMARY], [...SECONDARY])).toBe(0)
  })

  it('excludes ramp sets from the count, regardless of muscle role (boundary condition)', () => {
    const log = fourSetBenchLog({
      sets: [
        { weightKg: 30, reps: 5, role: 'ramp' },
        { weightKg: 45, reps: 3, role: 'ramp' },
        { weightKg: 60, reps: 8, role: 'working' },
      ],
    })
    expect(hardSetCount(log, 'chest', [...PRIMARY], [...SECONDARY])).toBe(1)
    expect(hardSetCount(log, 'triceps', [...PRIMARY], [...SECONDARY])).toBe(0.5)
  })
})

describe('totalVolumeKg', () => {
  it('sums weight x reps across all sets', () => {
    const log = fourSetBenchLog()
    // 60*8 + 60*8 + 60*7 + 60*6 = 480 + 480 + 420 + 360 = 1740
    expect(totalVolumeKg(log)).toBe(1740)
  })

  it('is zero for a skipped log, even if sets are still present (boundary condition)', () => {
    const log = fourSetBenchLog({ skipped: true })
    expect(totalVolumeKg(log)).toBe(0)
  })

  it('is zero for a log with no sets (boundary condition)', () => {
    expect(totalVolumeKg(fourSetBenchLog({ sets: [] }))).toBe(0)
  })

  it('excludes ramp sets from the total (boundary condition)', () => {
    const log = fourSetBenchLog({
      sets: [
        { weightKg: 30, reps: 5, role: 'ramp' },
        { weightKg: 60, reps: 8, role: 'working' },
      ],
    })
    expect(totalVolumeKg(log)).toBe(480) // only the 60x8 working set counts, not the 30x5 ramp set
  })
})

describe('topSet', () => {
  it('returns the heaviest set', () => {
    const log = fourSetBenchLog()
    expect(topSet(log)).toEqual({ weightKg: 60, reps: 8, role: 'working' }) // first of the two 60kg sets — tie broken by reps below
  })

  it('breaks a weight tie by higher reps', () => {
    const log = fourSetBenchLog({
      sets: [
        { weightKg: 60, reps: 5, role: 'working' },
        { weightKg: 60, reps: 9, role: 'working' },
      ],
    })
    expect(topSet(log)).toEqual({ weightKg: 60, reps: 9, role: 'working' })
  })

  it('ignores a heavier ramp set in favor of the top working set (boundary condition)', () => {
    const log = fourSetBenchLog({
      sets: [
        { weightKg: 90, reps: 2, role: 'ramp' }, // heavier than any working set, but must not win
        { weightKg: 60, reps: 8, role: 'working' },
      ],
    })
    expect(topSet(log)).toEqual({ weightKg: 60, reps: 8, role: 'working' })
  })

  it('is undefined for a skipped log (boundary condition)', () => {
    expect(topSet(fourSetBenchLog({ skipped: true }))).toBeUndefined()
  })

  it('is undefined for a log with no sets (boundary condition)', () => {
    expect(topSet(fourSetBenchLog({ sets: [] }))).toBeUndefined()
  })
})
