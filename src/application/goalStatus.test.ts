import { describe, expect, it } from 'vitest'
import { checkGoalNeedsRenewal } from './goalStatus'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { UserProfile } from '../domain/profile/types'

const ASOF = new Date('2026-08-17T00:00:00.000Z')

const GOAL: Goal = {
  id: 'g1',
  exerciseId: 'x',
  startingWeightKg: 80,
  targetWeightKg: 100,
  deadline: '2026-12-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  trainingEmphasis: 'strength',
}
const BLOCK: SpecializationBlock = { goalId: 'g1', focusMuscle: 'chest', startedAt: '2026-08-01T00:00:00.000Z', endedAt: null }
const PROFILE: UserProfile = { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} }

describe('checkGoalNeedsRenewal', () => {
  it('returns null when nothing has triggered renewal', () => {
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, null, ASOF)).toBeNull()
  })

  it('flags focusMuscleInjured when the block\'s focus muscle is injured — takes priority over everything else', () => {
    const injuredProfile: UserProfile = { ...PROFILE, injuredMuscles: ['chest'] }
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, injuredProfile, null, ASOF)).toBe('focusMuscleInjured')
  })

  it('flags targetMet when the current weight has reached or exceeded the target', () => {
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, 100, ASOF)).toBe('targetMet')
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, 105, ASOF)).toBe('targetMet')
  })

  it('does not flag targetMet just short of the target (boundary condition)', () => {
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, 99, ASOF)).toBeNull()
  })

  it('flags deadlinePassed once the deadline is behind asOf', () => {
    const pastDeadlineAsOf = new Date('2027-01-01T00:00:00.000Z')
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, null, pastDeadlineAsOf)).toBe('deadlinePassed')
  })

  it('does not flag deadlinePassed exactly at the deadline (boundary condition — still on the last day)', () => {
    const exactlyAtDeadline = new Date(GOAL.deadline)
    expect(checkGoalNeedsRenewal(GOAL, BLOCK, PROFILE, null, exactlyAtDeadline)).toBeNull()
  })

  it('null currentWeightKg never triggers targetMet, even for a zero-or-negative target (boundary condition)', () => {
    const trivialGoal: Goal = { ...GOAL, targetWeightKg: 0 }
    expect(checkGoalNeedsRenewal(trivialGoal, BLOCK, PROFILE, null, ASOF)).toBeNull()
  })
})
