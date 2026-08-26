import { describe, expect, it } from 'vitest'
import {
  prescribeExercise,
  prescribeSession,
  goalHeldStreak,
  shouldDeloadGoalExercise,
  TARGET_REPS_BY_EMPHASIS,
  WEIGHT_INCREMENT_KG,
} from './sessionPrescription'
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

// A fixed reference "now" close to (but after) the historical log dates
// below, passed explicitly as `asOf` everywhere prescribeExercise/
// prescribeSession's date-gap math matters -- without it, these tests'
// pass/fail would silently depend on how many real days have elapsed since
// the log dates were written, since the default asOf is the real
// new Date(). Chosen 1 day after the latest fixed log date so every gap in
// these tests stays well under DETRAINING_RISK_THRESHOLD_DAYS (14) unless a
// test is specifically about that gap.
const NOW = new Date('2026-08-16T00:00:00.000Z')

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
    const result = prescribeExercise(slot(), GOAL, history, { asOf: NOW })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70 + WEIGHT_INCREMENT_KG)
  })

  it('holds the weight when the last session missed target reps', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps - 1)]
    const result = prescribeExercise(slot(), GOAL, history, { asOf: NOW })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70)
  })

  it('uses the most recent (not first) log when several exist', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps),
      log('2026-08-15T00:00:00.000Z', 'x1', 75, targetReps - 1), // most recent: held
    ]
    const result = prescribeExercise(slot(), GOAL, history, { asOf: NOW })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(75)
  })

  it('ignores a skipped exercise log when looking for the most recent top set (boundary condition)', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps),
      log('2026-08-15T00:00:00.000Z', 'x1', 999, 999, true), // skipped, must be ignored
    ]
    // The skipped 08-15 log must be ignored, leaving 08-01 as the real most
    // recent top set -- asOf pinned within 14 days of THAT date (not NOW,
    // which is 15 days out and would otherwise wrongly trigger the
    // returning-after-a-gap resumption-weight branch instead of plain
    // progression, defeating the point of this test).
    const asOf = new Date('2026-08-10T00:00:00.000Z')
    const result = prescribeExercise(slot(), GOAL, history, { asOf })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70 + WEIGHT_INCREMENT_KG)
  })

  it('uses suggestResumptionWeight instead of plain progression when returning after >= 14 days', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps)] // hit target, but stale
    const asOf = new Date('2026-08-15T00:00:00.000Z') // exactly 14 days later
    const result = prescribeExercise(slot(), GOAL, history, { asOf })
    const working = result.sets.filter((s) => s.role === 'working')
    // 14-27 days tier = 90% of last working weight, not 70 + increment.
    expect(working[0].weightKg).toBe(70 * 0.9)
  })

  it('still applies plain APRE progression at 13 days (boundary condition, just under the gap threshold)', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps)]
    const asOf = new Date('2026-08-14T00:00:00.000Z') // 13 days later
    const result = prescribeExercise(slot(), GOAL, history, { asOf })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70 + WEIGHT_INCREMENT_KG)
  })

  it('deloadGoalExercise holds the weight even when the last session hit target reps', () => {
    const targetReps = TARGET_REPS_BY_EMPHASIS.strength
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps)]
    const result = prescribeExercise(slot(), GOAL, history, { asOf: NOW, deloadGoalExercise: true })
    const working = result.sets.filter((s) => s.role === 'working')
    expect(working[0].weightKg).toBe(70)
  })

  it('deloadGoalExercise has no effect on a maintenance exercise (only meaningful for the goal exercise)', () => {
    const history = [log('2026-08-10T00:00:00.000Z', 'x1', 40, 12)]
    const result = prescribeExercise(slot({ isGoalPriority: false }), GOAL, history, {
      asOf: NOW,
      deloadGoalExercise: true,
    })
    expect(result.sets.every((s) => s.weightKg === 40)).toBe(true)
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

describe('goalHeldStreak', () => {
  const targetReps = TARGET_REPS_BY_EMPHASIS.strength

  it('is 0 when there is no history at all', () => {
    expect(goalHeldStreak([], GOAL)).toBe(0)
  })

  it('is 0 when the most recent session met target reps', () => {
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps - 1),
      log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps),
    ]
    expect(goalHeldStreak(history, GOAL)).toBe(0)
  })

  it('counts consecutive most-recent misses, stopping at the first hit walking backward', () => {
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 65, targetReps), // hit -- not counted
      log('2026-08-05T00:00:00.000Z', 'x1', 70, targetReps - 1), // held
      log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps - 1), // held
      log('2026-08-15T00:00:00.000Z', 'x1', 70, targetReps - 1), // held (most recent)
    ]
    expect(goalHeldStreak(history, GOAL)).toBe(3)
  })

  it('ignores logs for a different exercise and skipped logs', () => {
    const history = [
      log('2026-08-01T00:00:00.000Z', 'x1', 70, targetReps - 1),
      log('2026-08-05T00:00:00.000Z', 'other-exercise', 999, 999),
      log('2026-08-10T00:00:00.000Z', 'x1', 70, targetReps - 1, true), // skipped
    ]
    expect(goalHeldStreak(history, GOAL)).toBe(1)
  })
})

describe('shouldDeloadGoalExercise', () => {
  const targetReps = TARGET_REPS_BY_EMPHASIS.strength
  // A real exercise/muscle pair (unlike EXERCISE/GOAL above, which use a
  // fake id) -- buildMuscleLoadEntries needs a real library lookup to
  // attribute hard sets to a muscle at all.
  const REAL_GOAL: Goal = { ...GOAL, exerciseId: 'Barbell_Curl' }

  function curlLog(daysAgo: number, reps: number): WorkoutLog {
    const completedAt = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    return log(completedAt, 'Barbell_Curl', 20, reps)
  }

  it('is false with no history at all (boundary condition)', () => {
    expect(shouldDeloadGoalExercise([], [], 'biceps', REAL_GOAL, NOW)).toBe(false)
  })

  it('triggers on 2+ consecutive held sessions, even with unremarkable ACWR', () => {
    const history = [curlLog(10, targetReps - 1), curlLog(5, targetReps - 1)]
    expect(shouldDeloadGoalExercise(history, history, 'biceps', REAL_GOAL, NOW)).toBe(true)
  })

  it('triggers on ACWR exceeding the safety ceiling even with zero held sessions', () => {
    // A sudden spike: all load in the last 7 days, none before -- acute
    // load fully drives chronic load too, pushing the ratio well past 1.3.
    const history = [curlLog(1, targetReps), curlLog(3, targetReps), curlLog(5, targetReps)]
    expect(shouldDeloadGoalExercise(history, history, 'biceps', REAL_GOAL, NOW)).toBe(true)
  })

  it('is false for consistent, evenly-spaced training with no held streak', () => {
    // ~7 sessions spread over 25 days, hitting target reps every time --
    // chronic weekly average keeps pace with acute load, ratio stays low.
    const history = [3, 7, 11, 14, 18, 21, 25].map((daysAgo) => curlLog(daysAgo, targetReps))
    expect(shouldDeloadGoalExercise(history, history, 'biceps', REAL_GOAL, NOW)).toBe(false)
  })
})

describe('prescribeSession', () => {
  it('prescribes every slot', () => {
    const slots = [slot({ exercise: { ...EXERCISE, id: 'a' } }), slot({ exercise: { ...EXERCISE, id: 'b' }, isGoalPriority: false })]
    const result = prescribeSession(slots, GOAL, [])
    expect(result.map((r) => r.exerciseId)).toEqual(['a', 'b'])
  })
})
