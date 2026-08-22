import { describe, expect, it } from 'vitest'
import { prescribeExercise, prescribeSession, TARGET_REPS_BY_EMPHASIS, WEIGHT_INCREMENT_KG } from './sessionPrescription'
import type { AssembledExerciseSlot } from './sessionOrchestration'
import type { Goal } from '../domain/goals/types'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { LibraryExercise } from '../domain/exerciseLibrary/exerciseLibrary'

const EXERCISE: LibraryExercise = {
  id: 'x1',
  nameEn: 'Bench Press',
  nameUk: null,
  equipment: 'barbell',
  mechanic: 'compound',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
}

const GOAL: Goal = {
  id: 'g1',
  exerciseId: 'x1',
  startingWeightKg: 60,
  targetWeightKg: 80,
  deadline: '2026-12-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  trainingEmphasis: 'strength',
}

function slot(overrides: Partial<AssembledExerciseSlot> = {}): AssembledExerciseSlot {
  return { exercise: EXERCISE, muscleGroupId: 'chest', isGoalPriority: true, sets: 3, ...overrides }
}

function log(completedAt: string, exerciseId: string, weightKg: number, reps: number, skipped = false): WorkoutLog {
  return {
    id: completedAt,
    completedAt,
    successful: true,
    exerciseLogs: [
      { exerciseId, skipped, sets: skipped ? [] : [{ weightKg, reps, role: 'working' }] },
    ],
  }
}

describe('prescribeExercise — goal exercise (APRE)', () => {
  it('uses the goal starting weight when there is no history at all', () => {
    const result = prescribeExercise(slot(), GOAL, [])
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working.every((s) => s.weightKg === 60)).toBe(true)
  })

  it('prescribes 2 ramp sets at 50%/75% of the working weight plus the requested working set count', () => {
    const result = prescribeExercise(slot({ sets: 3 }), GOAL, [])
    const ramps = result.sets.filter((s) => s.role === 'ramp')
    const working = result.sets.filter((s) => s.role === 'working')
    expect(ramps.map((r) => r.weightKg)).toEqual([30, 45]) // 60 * 0.5, 60 * 0.75
    expect(working).toHaveLength(3)
  })

  it('progresses the working weight by the increment when the last session met or beat target reps', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps)]
    const result = prescribeExercise(slot(), GOAL, history)
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70 + WEIGHT_INCREMENT_KG)
  })

  it('holds the weight when the last session missed target reps', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps - 1)]
    const result = prescribeExercise(slot(), GOAL, history)
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70)
  })

  it('uses the most recent (not first) log when several exist', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps),
      log('2026-08-15T00:00:00.000Z', 'x1', 75, targetReps - 1), // most recent: held
    ]
    const result = prescribeExercise(slot(), GOAL, history)
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(75)
  })

  it('ignores a skipped exercise log when looking for the most recent top set (boundary condition)', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps),
      log('2026-08-15T00:00:00.000Z', 'x1', 999, 999, true), // skipped, must be ignored
    ]
    const result = prescribeExercise(slot(), GOAL, history)
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70 + WEIGHT_INCREMENT_KG)
  })

  it('always prescribes at least 1 working set even if the assembled slot said 0 (boundary condition)', () => {
    const result = prescribeExercise(slot({ sets: 0 }), GOAL, [])
    expect(result.sets.filter((s) => s.role === 'working')).toHaveLength(1)
  })
})

describe('prescribeExercise — maintenance exercise (repeat last weight)', () => {
  it('repeats the most recently logged weight, with no ramp sets', () => {
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 40, 12)]
    const result = prescribeExercise(slot({ isGoalPriority: false, sets: 2 }), GOAL, history)
    expect(result.sets.every((s) => s.role === 'working')).toBe(true)
    expect(result.sets.every((s) => s.weightKg === 40)).toBe(true)
    expect(result.sets).toHaveLength(2)
  })

  it('falls back to 0 (not the goal starting weight) when there is no history — honest "enter manually", not a guess', () => {
    const result = prescribeExercise(slot({ isGoalPriority: false }), GOAL, [])
    expect(result.sets.every((s) => s.weightKg === 0)).toBe(true)
  })
})

describe('prescribeSession', () => {
  it('prescribes every slot', () => {
    const slots = [slot({ exercise: { ...EXERCISE, id: 'a' } }), slot({ exercise: { ...EXERCISE, id: 'b' }, isGoalPriority: false })]
    const result = prescribeSession(slots, GOAL, [])
    expect(result.map((r) => r.exerciseId)).toEqual(['a', 'b'])
  })
})
