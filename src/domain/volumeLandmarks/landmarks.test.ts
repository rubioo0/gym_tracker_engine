import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../muscles/muscleTaxonomy'
import {
  VOLUME_LANDMARKS,
  getVolumeLandmark,
  sessionCapFromWeekly,
  monthlyCapFromWeekly,
} from './landmarks'

describe('VOLUME_LANDMARKS', () => {
  it('has exactly one entry per muscle group in the taxonomy (no missing, no orphaned)', () => {
    const taxonomyIds = MUSCLE_GROUPS.map((g) => g.id).sort()
    const landmarkIds = VOLUME_LANDMARKS.map((l) => l.muscleGroupId).sort()
    expect(landmarkIds).toEqual(taxonomyIds)
  })

  it('every landmark satisfies mv <= mev <= mavLow <= mavHigh <= mrv', () => {
    for (const l of VOLUME_LANDMARKS) {
      expect(l.mv).toBeLessThanOrEqual(l.mev)
      expect(l.mev).toBeLessThanOrEqual(l.mavLow)
      expect(l.mavLow).toBeLessThanOrEqual(l.mavHigh)
      expect(l.mavHigh).toBeLessThanOrEqual(l.mrv)
    }
  })

  it('flags exactly obliques/adductors/abductors/neck as estimated (not published) — see landmarks.md', () => {
    const estimated = VOLUME_LANDMARKS.filter((l) => l.sourceConfidence === 'estimated')
      .map((l) => l.muscleGroupId)
      .sort()
    expect(estimated).toEqual(['abductors', 'adductors', 'neck', 'obliques'].sort())
  })
})

describe('getVolumeLandmark', () => {
  it('returns chest with the documented worked-example figures (landmarks.md)', () => {
    const chest = getVolumeLandmark('chest')
    expect(chest).toMatchObject({ mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 })
  })
})

describe('sessionCapFromWeekly (worked example from landmarks.md)', () => {
  it('chest at MRV=22 sets/week, trained 2x/week -> 11 sets/session', () => {
    const chest = getVolumeLandmark('chest')
    expect(sessionCapFromWeekly(chest.mrv, 2)).toBe(11)
  })

  it('throws for zero/negative frequency (boundary condition)', () => {
    expect(() => sessionCapFromWeekly(20, 0)).toThrow()
    expect(() => sessionCapFromWeekly(20, -1)).toThrow()
  })
})

describe('monthlyCapFromWeekly (worked example from landmarks.md)', () => {
  it('chest at MRV=22 sets/week -> ~95.3 sets/month', () => {
    const chest = getVolumeLandmark('chest')
    expect(monthlyCapFromWeekly(chest.mrv)).toBeCloseTo(95.33, 1)
  })

  it('zero weekly sets -> zero monthly cap (boundary condition)', () => {
    expect(monthlyCapFromWeekly(0)).toBe(0)
  })
})
