import { describe, expect, it } from 'vitest'
import { getActiveGoalAndBlock, countSessionsInBlock } from './activeGoal'
import { INITIAL_STATE, type PersistedState } from './state'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'

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

describe('getActiveGoalAndBlock', () => {
  it('returns null when there is no state at all', () => {
    expect(getActiveGoalAndBlock(INITIAL_STATE)).toBeNull()
  })

  it('returns the goal+block when an unended block exists', () => {
    const state: PersistedState = { ...INITIAL_STATE, goals: [GOAL], specializationBlocks: [BLOCK] }
    expect(getActiveGoalAndBlock(state)).toEqual({ goal: GOAL, block: BLOCK })
  })

  it('returns null when the only block has already ended (boundary condition)', () => {
    const endedBlock: SpecializationBlock = { ...BLOCK, endedAt: '2026-09-01T00:00:00.000Z' }
    const state: PersistedState = { ...INITIAL_STATE, goals: [GOAL], specializationBlocks: [endedBlock] }
    expect(getActiveGoalAndBlock(state)).toBeNull()
  })

  it('returns null if the block references a goal that no longer exists (boundary condition — should not happen, but must not crash)', () => {
    const state: PersistedState = { ...INITIAL_STATE, goals: [], specializationBlocks: [BLOCK] }
    expect(getActiveGoalAndBlock(state)).toBeNull()
  })
})

describe('countSessionsInBlock', () => {
  function log(completedAt: string): WorkoutLog {
    return { id: completedAt, completedAt, exerciseLogs: [], successful: true }
  }

  it('counts logs on or after the block start', () => {
    const logs = [log('2026-08-05T00:00:00.000Z'), log('2026-08-10T00:00:00.000Z')]
    expect(countSessionsInBlock(logs, BLOCK)).toBe(2)
  })

  it('excludes logs before the block started', () => {
    const logs = [log('2026-07-01T00:00:00.000Z'), log('2026-08-05T00:00:00.000Z')]
    expect(countSessionsInBlock(logs, BLOCK)).toBe(1)
  })

  it('counts a log exactly at the block start time (boundary condition)', () => {
    expect(countSessionsInBlock([log(BLOCK.startedAt)], BLOCK)).toBe(1)
  })

  it('is zero for no logs at all (boundary condition)', () => {
    expect(countSessionsInBlock([], BLOCK)).toBe(0)
  })
})
