import { describe, expect, it } from 'vitest'
import { gymMinutesFrom, INITIAL_STATE, isPersistedState } from './state'

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
      }),
    ).toBe(false)
  })

  it('accepts a missing confirmedSessionInputs (backup exported before it existed), a null one, and a populated one', () => {
    const base = {
      profile: null,
      goals: [],
      specializationBlocks: [],
      workoutLogs: [],
    }
    expect(isPersistedState(base)).toBe(true)
    expect(isPersistedState({ ...base, confirmedSessionInputs: null })).toBe(true)
    expect(isPersistedState({ ...base, confirmedSessionInputs: { availableMinutes: 45, noGymToday: false } })).toBe(true)
  })

  it('rejects a non-null, non-object confirmedSessionInputs (boundary condition)', () => {
    const base = {
      profile: null,
      goals: [],
      specializationBlocks: [],
      workoutLogs: [],
    }
    expect(isPersistedState({ ...base, confirmedSessionInputs: 'not-an-object' })).toBe(false)
  })
})

describe('gymMinutesFrom', () => {
  it('subtracts pool minutes from the total available minutes', () => {
    expect(gymMinutesFrom({ availableMinutes: 60, noGymToday: false, poolMinutes: 20 })).toBe(40)
  })

  it('defaults to the full available minutes when poolMinutes is absent (older persisted state)', () => {
    expect(gymMinutesFrom({ availableMinutes: 45, noGymToday: false })).toBe(45)
  })

  it('clamps at 0 rather than going negative when poolMinutes exceeds availableMinutes', () => {
    expect(gymMinutesFrom({ availableMinutes: 30, noGymToday: false, poolMinutes: 45 })).toBe(0)
  })
})
