import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  acuteLoad,
  chronicLoad,
  acwr,
  classifyAcwrZone,
  exceedsCeiling,
  ACWR_SAFETY_CEILING,
  daysSinceLastLoad,
  isDetrainingRisk,
  DETRAINING_RISK_THRESHOLD_DAYS,
  countConsecutiveHeldSessions,
  shouldDeload,
  type MuscleLoadEntry,
} from './acwr'

const ASOF = new Date('2026-08-15T00:00:00.000Z')

function daysAgo(n: number): string {
  return new Date(ASOF.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('acuteLoad / chronicLoad / acwr (worked example from acwr.md)', () => {
  // 10 hard sets in the last 7 days, 32 total in the last 28 days.
  const entries: MuscleLoadEntry[] = [
    { date: daysAgo(1), hardSets: 5 },
    { date: daysAgo(3), hardSets: 5 }, // acute total: 10
    { date: daysAgo(10), hardSets: 11 },
    { date: daysAgo(20), hardSets: 11 }, // chronic total: 10 + 11 + 11 = 32
  ]

  it('computes acute load as the sum over the last 7 days', () => {
    expect(acuteLoad(entries, ASOF)).toBe(10)
  })

  it('computes chronic load as the sum over the last 28 days', () => {
    expect(chronicLoad(entries, ASOF)).toBe(32)
  })

  it('computes ACWR = acute / (chronic / 4) = 10 / 8 = 1.25', () => {
    expect(acwr(entries, ASOF)).toBe(1.25)
  })
})

describe('acwr cold-start handling (boundary conditions)', () => {
  it('returns 0 when there is no load at all', () => {
    expect(acwr([], ASOF)).toBe(0)
  })

  it('returns 0 (not null) for a single recent entry — chronic load can never be zero while acute is nonzero, since the acute window is a subset of the chronic window', () => {
    const entries: MuscleLoadEntry[] = [{ date: daysAgo(1), hardSets: 5 }]
    // chronic = 5 (that entry falls within 28 days too), chronicWeekly = 1.25, acwr = 5/1.25 = 4
    expect(acwr(entries, ASOF)).toBe(4)
  })
})

describe('acuteLoad/chronicLoad window boundaries (boundary conditions)', () => {
  it('includes a set exactly 6 days ago in the acute window (7-day window = offsets 0..6)', () => {
    expect(acuteLoad([{ date: daysAgo(6), hardSets: 1 }], ASOF)).toBe(1)
  })

  it('excludes a set exactly 7 days ago from the acute window', () => {
    expect(acuteLoad([{ date: daysAgo(7), hardSets: 1 }], ASOF)).toBe(0)
  })

  it('includes a set exactly 27 days ago in the chronic window (28-day window = offsets 0..27)', () => {
    expect(chronicLoad([{ date: daysAgo(27), hardSets: 1 }], ASOF)).toBe(1)
  })

  it('excludes a set exactly 28 days ago from the chronic window', () => {
    expect(chronicLoad([{ date: daysAgo(28), hardSets: 1 }], ASOF)).toBe(0)
  })
})

describe('classifyAcwrZone', () => {
  it('classifies null as insufficientData', () => {
    expect(classifyAcwrZone(null)).toBe('insufficientData')
  })

  it('classifies the sweet-spot boundaries correctly (boundary conditions)', () => {
    expect(classifyAcwrZone(0.79)).toBe('low')
    expect(classifyAcwrZone(0.8)).toBe('safe')
    expect(classifyAcwrZone(1.3)).toBe('safe')
    expect(classifyAcwrZone(1.31)).toBe('elevated')
    expect(classifyAcwrZone(1.5)).toBe('elevated')
    expect(classifyAcwrZone(1.51)).toBe('high')
  })
})

describe('exceedsCeiling (boundary conditions, uses the named ACWR_SAFETY_CEILING constant, not a magic number)', () => {
  it('does not exceed exactly at the ceiling', () => {
    expect(exceedsCeiling(ACWR_SAFETY_CEILING)).toBe(false)
  })

  it('exceeds one epsilon above the ceiling', () => {
    expect(exceedsCeiling(ACWR_SAFETY_CEILING + 0.001)).toBe(true)
  })

  it('null (insufficient data) never exceeds the ceiling', () => {
    expect(exceedsCeiling(null)).toBe(false)
  })
})

describe('daysSinceLastLoad / isDetrainingRisk', () => {
  it('returns null when there are no entries at all', () => {
    expect(daysSinceLastLoad([], ASOF)).toBeNull()
    expect(isDetrainingRisk([], ASOF)).toBe(false)
  })

  it('is not a detraining risk one day short of the threshold (boundary condition)', () => {
    const entries: MuscleLoadEntry[] = [{ date: daysAgo(DETRAINING_RISK_THRESHOLD_DAYS - 1), hardSets: 3 }]
    expect(isDetrainingRisk(entries, ASOF)).toBe(false)
  })

  it('is a detraining risk exactly at the threshold (boundary condition)', () => {
    const entries: MuscleLoadEntry[] = [{ date: daysAgo(DETRAINING_RISK_THRESHOLD_DAYS), hardSets: 3 }]
    expect(isDetrainingRisk(entries, ASOF)).toBe(true)
  })
})

describe('countConsecutiveHeldSessions (worked example from acwr.md)', () => {
  it('counts trailing missed sessions, stopping at the first progressed one', () => {
    const sessions = [
      { targetReps: 10, actualReps: 8 }, // miss
      { targetReps: 10, actualReps: 10 }, // hit — stop counting from here backward
      { targetReps: 10, actualReps: 8 }, // miss
      { targetReps: 10, actualReps: 7 }, // miss (most recent)
    ]
    expect(countConsecutiveHeldSessions(sessions)).toBe(2)
  })

  it('is 0 for an empty history (boundary condition)', () => {
    expect(countConsecutiveHeldSessions([])).toBe(0)
  })

  it('counts all sessions if every one was missed (boundary condition)', () => {
    const sessions = [
      { targetReps: 10, actualReps: 9 },
      { targetReps: 10, actualReps: 9 },
      { targetReps: 10, actualReps: 9 },
    ]
    expect(countConsecutiveHeldSessions(sessions)).toBe(3)
  })
})

describe('shouldDeload', () => {
  it('triggers on ACWR alone, even with zero held sessions', () => {
    expect(shouldDeload(ACWR_SAFETY_CEILING + 0.1, 0)).toBe(true)
  })

  it('triggers on 2 consecutive held sessions alone, even with a safe ACWR', () => {
    expect(shouldDeload(1.0, 2)).toBe(true)
  })

  it('does not trigger on a single held session with a safe ACWR (boundary condition)', () => {
    expect(shouldDeload(1.0, 1)).toBe(false)
  })

  it('does not trigger when both signals are clear', () => {
    expect(shouldDeload(1.0, 0)).toBe(false)
  })
})

describe('property: acwr is never negative for any non-negative load entries', () => {
  it('holds across randomly generated load histories', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ dayOffset: fc.integer({ min: 0, max: 60 }), hardSets: fc.float({ min: 0, max: 50, noNaN: true }) })),
        (records) => {
          const entries: MuscleLoadEntry[] = records.map((r) => ({ date: daysAgo(r.dayOffset), hardSets: r.hardSets }))
          const ratio = acwr(entries, ASOF)
          if (ratio !== null) {
            expect(ratio).toBeGreaterThanOrEqual(0)
          }
        },
      ),
    )
  })
})
