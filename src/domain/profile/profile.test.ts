import { describe, expect, it } from 'vitest'
import { deficitRateModifier, isMuscleExcluded, DEFICIT_RATE_MODIFIER } from './profile'
import type { UserProfile } from './types'

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    deficitLabel: 'notDieting',
    sessionsPerWeek: 4,
    injuredMuscles: [],
    experienceByMuscle: {},
    ...overrides,
  }
}

describe('isMuscleExcluded', () => {
  it('excludes a muscle in the injuredMuscles list', () => {
    const profile = baseProfile({ injuredMuscles: ['back'] })
    expect(isMuscleExcluded(profile, 'back')).toBe(true)
  })

  it('does not exclude a muscle not in the list', () => {
    const profile = baseProfile({ injuredMuscles: ['back'] })
    expect(isMuscleExcluded(profile, 'chest')).toBe(false)
  })

  it('excludes nothing for an empty list (boundary condition)', () => {
    const profile = baseProfile({ injuredMuscles: [] })
    expect(isMuscleExcluded(profile, 'back')).toBe(false)
  })
})

describe('deficitRateModifier (worked example from profile.md)', () => {
  it('applies no modifier when not dieting', () => {
    expect(deficitRateModifier('notDieting')).toBe(1.0)
  })

  it('softens the rate by 0.5x under a big deficit, per the worked example', () => {
    const assumedRateKgPerWeek = 1.0
    expect(assumedRateKgPerWeek * deficitRateModifier('bigDeficit')).toBe(0.5)
  })

  it('softens less under a small deficit than a big one (ordering sanity check)', () => {
    expect(DEFICIT_RATE_MODIFIER.smallDeficit).toBeGreaterThan(DEFICIT_RATE_MODIFIER.bigDeficit)
    expect(DEFICIT_RATE_MODIFIER.notDieting).toBeGreaterThan(DEFICIT_RATE_MODIFIER.smallDeficit)
  })
})
