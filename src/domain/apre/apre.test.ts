import { describe, expect, it } from 'vitest'
import { rampSets, nextWorkingWeight } from './apre'

describe('rampSets (worked example from apre.md)', () => {
  it('computes 50% and 75% of last working weight for 60kg', () => {
    expect(rampSets(60)).toEqual([{ weightKg: 30 }, { weightKg: 45 }])
  })

  it('returns zero-weight ramps for a zero working weight (boundary condition — e.g. a bodyweight-only exercise with no added load yet)', () => {
    expect(rampSets(0)).toEqual([{ weightKg: 0 }, { weightKg: 0 }])
  })
})

describe('nextWorkingWeight (worked examples from apre.md)', () => {
  const base = { previousWorkingWeightKg: 60, targetReps: 10, incrementKg: 2.5 }

  it('progresses when actual reps exactly meet the target', () => {
    expect(nextWorkingWeight({ ...base, actualReps: 10 })).toBe(62.5)
  })

  it('progresses by the same increment when actual reps beat the target (binary rule, not proportional to overshoot)', () => {
    expect(nextWorkingWeight({ ...base, actualReps: 12 })).toBe(62.5)
  })

  it('holds (does not decrease) when actual reps miss the target', () => {
    expect(nextWorkingWeight({ ...base, actualReps: 8 })).toBe(60)
  })

  it('holds at exactly one rep short of the target (boundary condition)', () => {
    expect(nextWorkingWeight({ ...base, actualReps: 9 })).toBe(60)
  })

  it('never decreases below the previous working weight, no matter how far short the miss (boundary condition — see "why no automatic decrease" in apre.md)', () => {
    expect(nextWorkingWeight({ ...base, actualReps: 0 })).toBe(60)
  })
})
