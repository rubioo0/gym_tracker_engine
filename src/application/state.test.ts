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

  it('accepts a backup exported before draftSession existed (boundary condition — undefined, not present at all)', () => {
    expect(
      isPersistedState({
        profile: null,
        goals: [],
        specializationBlocks: [],
        workoutLogs: [],
        weighIns: [],
        circumferenceMeasurements: [],
      }),
    ).toBe(true)
  })

  it('accepts a populated draftSession object, and rejects a non-null/non-object draftSession', () => {
    const base = {
      profile: null,
      goals: [],
      specializationBlocks: [],
      workoutLogs: [],
      weighIns: [],
      circumferenceMeasurements: [],
    }
    expect(isPersistedState({ ...base, draftSession: { startedAt: 'x', focusMuscle: 'chest', exerciseLogs: [] } })).toBe(true)
    expect(isPersistedState({ ...base, draftSession: null })).toBe(true)
    expect(isPersistedState({ ...base, draftSession: 'not-an-object' })).toBe(false)
  })
})
