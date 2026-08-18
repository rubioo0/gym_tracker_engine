import { describe, expect, it } from 'vitest'
import {
  projectedCompletionDate,
  isOnTrack,
  checkFeasibilityAtCreation,
  ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE,
} from './goalProjection'
import type { Goal } from './types'

const ASOF = new Date('2026-08-15T00:00:00.000Z')

describe('projectedCompletionDate (worked example from goalProjection.md)', () => {
  it('projects 80kg -> 100kg at 2.5kg/week as 8 weeks (56 days) out', () => {
    const projected = projectedCompletionDate(80, 100, 2.5, ASOF)
    expect(projected).toEqual(new Date(ASOF.getTime() + 56 * 24 * 60 * 60 * 1000))
  })

  it('returns asOf unchanged when the goal is already met (boundary condition)', () => {
    expect(projectedCompletionDate(100, 100, 2.5, ASOF)).toEqual(ASOF)
    expect(projectedCompletionDate(105, 100, 2.5, ASOF)).toEqual(ASOF) // already exceeded
  })

  it('returns null for a zero rate (boundary condition)', () => {
    expect(projectedCompletionDate(80, 100, 0, ASOF)).toBeNull()
  })

  it('returns null for a negative rate (boundary condition — should not happen in practice, but must not silently produce a backwards date)', () => {
    expect(projectedCompletionDate(80, 100, -1, ASOF)).toBeNull()
  })
})

describe('isOnTrack', () => {
  it('is on track when the projection lands before the deadline', () => {
    // needs 8 weeks (56 days), deadline is 60 days out
    const deadline = new Date(ASOF.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOnTrack(80, 100, deadline, 2.5, ASOF)).toBe(true)
  })

  it('is not on track when the projection lands after the deadline', () => {
    const deadline = new Date(ASOF.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOnTrack(80, 100, deadline, 2.5, ASOF)).toBe(false)
  })

  it('is exactly on track when the projection lands precisely on the deadline (boundary condition)', () => {
    const deadline = new Date(ASOF.getTime() + 56 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOnTrack(80, 100, deadline, 2.5, ASOF)).toBe(true)
  })

  it('is not on track for a zero rate short of the target, regardless of deadline (boundary condition)', () => {
    const farFutureDeadline = new Date(ASOF.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOnTrack(80, 100, farFutureDeadline, 0, ASOF)).toBe(false)
  })

  it('is on track (trivially) when the goal is already met, even with a zero rate (boundary condition)', () => {
    const deadline = new Date(ASOF.getTime() + 1000).toISOString()
    expect(isOnTrack(100, 100, deadline, 0, ASOF)).toBe(true)
  })
})

describe('checkFeasibilityAtCreation (worked example from goalProjection.md)', () => {
  it('flags an unrealistic beginner goal (40kg in 4 weeks vs. a 2.5kg/week default) as not feasible', () => {
    const goal: Goal = {
      id: 'g1',
      exerciseId: 'Barbell_Squat',
      startingWeightKg: 60,
      targetWeightKg: 100,
      createdAt: ASOF.toISOString(),
      deadline: new Date(ASOF.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 4 weeks
      trainingEmphasis: 'strength',
    }
    expect(checkFeasibilityAtCreation(goal, 'beginner')).toBe(false)
  })

  it('accepts a realistic beginner goal at the same default rate', () => {
    const goal: Goal = {
      id: 'g2',
      exerciseId: 'Barbell_Squat',
      startingWeightKg: 60,
      targetWeightKg: 70, // 10kg needed
      createdAt: ASOF.toISOString(),
      deadline: new Date(ASOF.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 4 weeks -> needs 2.5kg/week, exactly the beginner default
      trainingEmphasis: 'strength',
    }
    expect(checkFeasibilityAtCreation(goal, 'beginner')).toBe(true)
  })

  it('uses a slower default for advanced lifters, making the same goal infeasible at that level (boundary/consistency check)', () => {
    const goal: Goal = {
      id: 'g3',
      exerciseId: 'Barbell_Squat',
      startingWeightKg: 60,
      targetWeightKg: 70,
      createdAt: ASOF.toISOString(),
      deadline: new Date(ASOF.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      trainingEmphasis: 'strength',
    }
    expect(checkFeasibilityAtCreation(goal, 'advanced')).toBe(false)
  })

  it('experience-level default rates are ordered beginner > intermediate > advanced (sanity check)', () => {
    expect(ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.beginner).toBeGreaterThan(
      ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.intermediate,
    )
    expect(ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.intermediate).toBeGreaterThan(
      ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.advanced,
    )
  })
})
