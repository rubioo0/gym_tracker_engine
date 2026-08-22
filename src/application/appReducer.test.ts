import { describe, expect, it } from 'vitest'
import { appReducer } from './appReducer'
import { INITIAL_STATE, type DraftSession, type PersistedState } from './state'
import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'

const PROFILE: UserProfile = {
  deficitLabel: 'notDieting',
  sessionsPerWeek: 4,
  injuredMuscles: [],
  experienceByMuscle: {},
}

describe('appReducer', () => {
  it('SET_PROFILE replaces the profile without touching other state', () => {
    const result = appReducer(INITIAL_STATE, { type: 'SET_PROFILE', profile: PROFILE })
    expect(result.profile).toBe(PROFILE)
    expect(result.goals).toEqual([])
  })

  it('CREATE_GOAL appends both the goal and its specialization block', () => {
    const goal: Goal = {
      id: 'g1',
      exerciseId: 'Barbell_Squat',
      startingWeightKg: 80,
      targetWeightKg: 100,
      deadline: '2026-12-01T00:00:00.000Z',
      createdAt: '2026-08-17T00:00:00.000Z',
      trainingEmphasis: 'strength',
    }
    const block: SpecializationBlock = {
      goalId: 'g1',
      focusMuscle: 'quads',
      startedAt: '2026-08-17T00:00:00.000Z',
      endedAt: null,
    }
    const result = appReducer(INITIAL_STATE, { type: 'CREATE_GOAL', goal, specializationBlock: block })
    expect(result.goals).toEqual([goal])
    expect(result.specializationBlocks).toEqual([block])
  })

  it('CREATE_GOAL appends to existing goals rather than replacing them (boundary condition)', () => {
    const existingGoal: Goal = {
      id: 'g0',
      exerciseId: 'x',
      startingWeightKg: 1,
      targetWeightKg: 2,
      deadline: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      trainingEmphasis: 'hypertrophy',
    }
    const stateWithGoal: PersistedState = { ...INITIAL_STATE, goals: [existingGoal] }
    const newGoal: Goal = { ...existingGoal, id: 'g1' }
    const block: SpecializationBlock = { goalId: 'g1', focusMuscle: 'back', startedAt: '2026-08-17T00:00:00.000Z', endedAt: null }
    const result = appReducer(stateWithGoal, { type: 'CREATE_GOAL', goal: newGoal, specializationBlock: block })
    expect(result.goals).toHaveLength(2)
  })

  it('REPLACE_STATE swaps the entire state wholesale', () => {
    const newState: PersistedState = { ...INITIAL_STATE, profile: PROFILE }
    const result = appReducer(INITIAL_STATE, { type: 'REPLACE_STATE', state: newState })
    expect(result).toBe(newState)
  })

  it('returns the same state reference for an unknown action type (boundary condition)', () => {
    // @ts-expect-error intentionally invalid action to exercise the default branch
    const result = appReducer(INITIAL_STATE, { type: 'NOT_A_REAL_ACTION' })
    expect(result).toBe(INITIAL_STATE)
  })

  const DRAFT: DraftSession = {
    startedAt: '2026-08-19T00:00:00.000Z',
    focusMuscle: 'chest',
    exerciseLogs: [{ exerciseId: 'x1', skipped: false, sets: [{ weightKg: 60, reps: 5, role: 'working' }] }],
  }

  it('START_DRAFT_SESSION sets the draft session', () => {
    const result = appReducer(INITIAL_STATE, { type: 'START_DRAFT_SESSION', draftSession: DRAFT })
    expect(result.draftSession).toEqual(DRAFT)
  })

  it('UPDATE_DRAFT_EXERCISE_LOG replaces only the matching exercise log', () => {
    const started = appReducer(INITIAL_STATE, { type: 'START_DRAFT_SESSION', draftSession: DRAFT })
    const updatedLog = { exerciseId: 'x1', skipped: false, sets: [{ weightKg: 62.5, reps: 5, role: 'working' as const }] }
    const result = appReducer(started, { type: 'UPDATE_DRAFT_EXERCISE_LOG', exerciseId: 'x1', exerciseLog: updatedLog })
    expect(result.draftSession?.exerciseLogs).toEqual([updatedLog])
  })

  it('UPDATE_DRAFT_EXERCISE_LOG is a no-op when there is no draft session (boundary condition)', () => {
    const updatedLog = { exerciseId: 'x1', skipped: false, sets: [] }
    const result = appReducer(INITIAL_STATE, { type: 'UPDATE_DRAFT_EXERCISE_LOG', exerciseId: 'x1', exerciseLog: updatedLog })
    expect(result).toBe(INITIAL_STATE)
  })

  it('FINISH_DRAFT_SESSION appends the finished log and clears the draft', () => {
    const started = appReducer(INITIAL_STATE, { type: 'START_DRAFT_SESSION', draftSession: DRAFT })
    const finished: WorkoutLog = {
      id: 'w1',
      completedAt: '2026-08-19T01:00:00.000Z',
      successful: true,
      exerciseLogs: [{ exerciseId: 'x1', skipped: false, sets: [{ weightKg: 60, reps: 5, role: 'working' }] }],
    }
    const result = appReducer(started, { type: 'FINISH_DRAFT_SESSION', workoutLog: finished })
    expect(result.workoutLogs).toEqual([finished])
    expect(result.draftSession).toBeNull()
  })

  it('DISCARD_DRAFT_SESSION clears the draft without touching workoutLogs', () => {
    const started = appReducer(INITIAL_STATE, { type: 'START_DRAFT_SESSION', draftSession: DRAFT })
    const result = appReducer(started, { type: 'DISCARD_DRAFT_SESSION' })
    expect(result.draftSession).toBeNull()
    expect(result.workoutLogs).toEqual([])
  })
})
