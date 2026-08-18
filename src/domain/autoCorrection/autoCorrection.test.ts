import { describe, expect, it } from 'vitest'
import { maxSafeWeeklyLoad, canAddMakeupSession, suggestResumptionWeight } from './autoCorrection'
import { ACWR_SAFETY_CEILING, DETRAINING_RISK_THRESHOLD_DAYS } from '../acwr/acwr'

describe('maxSafeWeeklyLoad', () => {
  it('is chronic weekly average times the ACWR safety ceiling constant, not a hardcoded number', () => {
    expect(maxSafeWeeklyLoad(8)).toBe(8 * ACWR_SAFETY_CEILING)
  })

  it('is zero for zero chronic load (boundary condition)', () => {
    expect(maxSafeWeeklyLoad(0)).toBe(0)
  })
})

describe('canAddMakeupSession (worked example from autoCorrection.md)', () => {
  it('rejects a makeup session that would push weekly load over the safety cap', () => {
    const result = canAddMakeupSession({ chronicWeeklyAverageSets: 8, currentWeekSetsSoFar: 6, makeupSessionSets: 5 })
    expect(result).toBe(false) // 6+5=11 > 8*1.3=10.4
  })

  it('allows a makeup session that stays within the safety cap', () => {
    const result = canAddMakeupSession({ chronicWeeklyAverageSets: 8, currentWeekSetsSoFar: 4, makeupSessionSets: 5 })
    expect(result).toBe(true) // 4+5=9 <= 10.4
  })

  it('allows a makeup session landing exactly at the cap (boundary condition)', () => {
    const result = canAddMakeupSession({ chronicWeeklyAverageSets: 10, currentWeekSetsSoFar: 8, makeupSessionSets: 5 })
    expect(result).toBe(true) // 8+5=13 == 10*1.3=13
  })

  it('rejects a makeup session one set over the cap (boundary condition)', () => {
    const result = canAddMakeupSession({ chronicWeeklyAverageSets: 10, currentWeekSetsSoFar: 9, makeupSessionSets: 5 })
    expect(result).toBe(false) // 9+5=14 > 13
  })
})

describe('suggestResumptionWeight (worked example from autoCorrection.md)', () => {
  it('suggests no reduction below the detraining-risk threshold', () => {
    const result = suggestResumptionWeight(80, DETRAINING_RISK_THRESHOLD_DAYS - 1)
    expect(result.suggestedWeightKg).toBe(80)
    expect(result.percentOfPrevious).toBe(1.0)
  })

  it('suggests 90% exactly at the detraining-risk threshold (boundary condition, intentionally shared with acwr.ts)', () => {
    const result = suggestResumptionWeight(80, DETRAINING_RISK_THRESHOLD_DAYS)
    expect(result.percentOfPrevious).toBe(0.9)
  })

  it('suggests 72kg (90%) at 20 days, per the worked example', () => {
    const result = suggestResumptionWeight(80, 20)
    expect(result.suggestedWeightKg).toBe(72)
  })

  it('suggests 80% at exactly 28 days (boundary condition)', () => {
    expect(suggestResumptionWeight(80, 28).percentOfPrevious).toBe(0.8)
  })

  it('suggests 65% at exactly 60 days and beyond (boundary condition)', () => {
    expect(suggestResumptionWeight(80, 60).percentOfPrevious).toBe(0.65)
    expect(suggestResumptionWeight(80, 200).percentOfPrevious).toBe(0.65)
  })

  it('includes a human-readable reason string, not just the numbers', () => {
    const result = suggestResumptionWeight(80, 20)
    expect(result.reason).toContain('20 days')
    expect(result.reason).toContain('90%')
  })
})
