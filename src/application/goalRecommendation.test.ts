import { describe, expect, it } from 'vitest'
import { suggestGoalTargetAndDeadline, DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE } from './goalRecommendation'
import { ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE } from '../domain/goals/goalProjection'
import { checkFeasibilityAtCreation } from '../domain/goals/goalProjection'
import type { Goal } from '../domain/goals/types'

const CREATED_AT = new Date('2026-08-17T00:00:00.000Z')

describe('DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE', () => {
  it('is tiered by experience (shorter for beginners, longer for advanced) per the duration research', () => {
    expect(DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.beginner).toBe(6)
    expect(DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.intermediate).toBe(8)
    expect(DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.advanced).toBe(12)
    expect(DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.beginner).toBeLessThan(
      DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.intermediate,
    )
    expect(DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.intermediate).toBeLessThan(
      DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.advanced,
    )
  })
})

describe('suggestGoalTargetAndDeadline', () => {
  it('computes target = starting + (experience rate x deficit modifier x duration), rounded to 2.5kg', () => {
    const result = suggestGoalTargetAndDeadline({
      startingWeightKg: 80,
      experienceLevel: 'beginner',
      deficitLabel: 'notDieting',
      createdAt: CREATED_AT,
      durationWeeks: 8,
    })
    // 80 + (2.5 * 1.0 * 8) = 100, already a multiple of 2.5
    expect(result.targetWeightKg).toBe(100)
  })

  it('suggests a deadline exactly durationWeeks out from createdAt', () => {
    const result = suggestGoalTargetAndDeadline({
      startingWeightKg: 80,
      experienceLevel: 'beginner',
      deficitLabel: 'notDieting',
      createdAt: CREATED_AT,
      durationWeeks: DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.beginner,
    })
    expect(result.deadline).toBe(
      new Date(CREATED_AT.getTime() + DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE.beginner * 7 * 24 * 60 * 60 * 1000).toISOString(),
    )
  })

  it('softens the suggested target under a big deficit, consistent with the deficit modifier', () => {
    const notDieting = suggestGoalTargetAndDeadline({
      startingWeightKg: 80,
      experienceLevel: 'intermediate',
      deficitLabel: 'notDieting',
      createdAt: CREATED_AT,
      durationWeeks: 8,
    })
    const bigDeficit = suggestGoalTargetAndDeadline({
      startingWeightKg: 80,
      experienceLevel: 'intermediate',
      deficitLabel: 'bigDeficit',
      createdAt: CREATED_AT,
      durationWeeks: 8,
    })
    expect(bigDeficit.targetWeightKg).toBeLessThan(notDieting.targetWeightKg)
  })

  it('is internally consistent: accepting the suggestion as-is always passes checkFeasibilityAtCreation for the same experience level', () => {
    for (const experienceLevel of Object.keys(ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE) as Array<
      keyof typeof ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE
    >) {
      const suggestion = suggestGoalTargetAndDeadline({
        startingWeightKg: 80,
        experienceLevel,
        deficitLabel: 'notDieting',
        createdAt: CREATED_AT,
        durationWeeks: 8,
      })
      const goal: Goal = {
        id: 'g1',
        exerciseId: 'x',
        startingWeightKg: 80,
        targetWeightKg: suggestion.targetWeightKg,
        deadline: suggestion.deadline,
        createdAt: CREATED_AT.toISOString(),
        trainingEmphasis: 'strength',
      }
      // rounding can shave a hair off the exact rate, so allow the boundary case; the key claim is it's never wildly infeasible
      expect(checkFeasibilityAtCreation(goal, experienceLevel)).toBe(true)
    }
  })

  it('produces a zero-gain suggestion for zero duration (boundary condition)', () => {
    const result = suggestGoalTargetAndDeadline({
      startingWeightKg: 80,
      experienceLevel: 'beginner',
      deficitLabel: 'notDieting',
      createdAt: CREATED_AT,
      durationWeeks: 0,
    })
    expect(result.targetWeightKg).toBe(80)
    expect(result.deadline).toBe(CREATED_AT.toISOString())
  })
})
