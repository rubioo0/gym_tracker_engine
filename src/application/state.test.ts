import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, isPersistedState } from './state'

describe('isPersistedState', () => {
  it('accepts the initial state shape', () => {
    expect(isPersistedState(INITIAL_STATE)).toBe(true)
  })

  it('accepts a populated valid shape', () => {
    expect(
      isPersistedState({
        profile: { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} },
        goals: [],
        specializationBlocks: [],
        workoutLogs: [],
        weighIns: [],
        circumferenceMeasurements: [],
      }),
    ).toBe(true)
  })

  it('rejects null, undefined, and non-objects (boundary conditions)', () => {
    expect(isPersistedState(null)).toBe(false)
    expect(isPersistedState(undefined)).toBe(false)
    expect(isPersistedState('not an object')).toBe(false)
    expect(isPersistedState(42)).toBe(false)
  })

  it('rejects an object missing a required array field', () => {
    expect(isPersistedState({ profile: null, goals: [] })).toBe(false)
  })

  it('rejects an object where an expected array field is not an array', () => {
    expect(
      isPersistedState({
        profile: null,
        goals: 'not-an-array',
        specializationBlocks: [],
        workoutLogs: [],
        weighIns: [],
        circumferenceMeasurements: [],
      }),
    ).toBe(false)
  })

})
