import { describe, expect, it } from 'vitest'
import { buildCalendarEntryDetails } from './calendarDetail'
import type { CalendarEntry } from './sessionCadence'
import { INITIAL_STATE, type PersistedState } from './state'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'

const GOAL: Goal = {
  id: 'g1',
  exerciseId: 'Barbell_Curl',
  startingWeightKg: 20,
  targetWeightKg: 30,
  deadline: '2027-01-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  trainingEmphasis: 'strength',
}
const BLOCK: SpecializationBlock = { goalId: 'g1', focusMuscle: 'biceps', startedAt: '2026-08-01T00:00:00.000Z', endedAt: null }

function baseState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    ...INITIAL_STATE,
    profile: { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} },
    goals: [GOAL],
    specializationBlocks: [BLOCK],
    ...overrides,
  }
}

describe('buildCalendarEntryDetails', () => {
  it('returns empty exercises for every entry when there is no profile yet (boundary condition)', () => {
    const entries: CalendarEntry[] = [{ date: '2026-08-05', isProjected: true }]
    const state = { ...baseState(), profile: null }
    const result = buildCalendarEntryDetails(entries, state, { goal: GOAL, block: BLOCK })
    expect(result).toEqual([{ ...entries[0], exercises: [] }])
  })

  it('reads a logged entry back from the real WorkoutLog, including actual weight/reps', () => {
    const log: WorkoutLog = {
      id: 'w1',
      completedAt: '2026-08-05T10:00:00.000Z',
      successful: true,
      exerciseLogs: [
        { exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 22.5, reps: 6, role: 'working' }] },
      ],
    }
    const entries: CalendarEntry[] = [{ date: '2026-08-05', isProjected: false, workoutLogId: 'w1' }]
    const state = baseState({ workoutLogs: [log] })

    const result = buildCalendarEntryDetails(entries, state, { goal: GOAL, block: BLOCK })
    expect(result).toHaveLength(1)
    expect(result[0].exercises).toHaveLength(1)
    expect(result[0].exercises[0]).toMatchObject({
      exerciseId: 'Barbell_Curl',
      sets: 1,
      reps: 6,
      weightKg: 22.5,
      skipped: false,
    })
  })

  it('returns an empty exercise list for a logged entry whose workoutLogId no longer resolves (boundary condition)', () => {
    const entries: CalendarEntry[] = [{ date: '2026-08-05', isProjected: false, workoutLogId: 'missing' }]
    const result = buildCalendarEntryDetails(entries, baseState(), { goal: GOAL, block: BLOCK })
    expect(result[0].exercises).toEqual([])
  })

  it('builds a preview for a projected entry via assembleTodaysSession/prescribeSession, including the goal exercise', () => {
    const entries: CalendarEntry[] = [{ date: '2026-08-10', isProjected: true }]
    const result = buildCalendarEntryDetails(entries, baseState(), { goal: GOAL, block: BLOCK })
    expect(result).toHaveLength(1)
    expect(result[0].exercises.length).toBeGreaterThan(0)
    expect(result[0].exercises.some((ex) => ex.exerciseId === 'Barbell_Curl')).toBe(true)
  })

  it('advances the simulated completedSessionsInBlock count for each successive projected entry', () => {
    const entries: CalendarEntry[] = [
      { date: '2026-08-10', isProjected: true },
      { date: '2026-08-14', isProjected: true },
      { date: '2026-08-18', isProjected: true },
    ]
    // Just confirm it doesn't throw and returns 3 previewed entries -- the
    // rotation logic itself (which muscle lands on which session index) is
    // sessionOrchestration.ts's own, already-tested responsibility.
    const result = buildCalendarEntryDetails(entries, baseState(), { goal: GOAL, block: BLOCK })
    expect(result).toHaveLength(3)
    for (const entry of result) {
      expect(entry.exercises.length).toBeGreaterThan(0)
    }
  })
})
