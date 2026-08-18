import { describe, expect, it } from 'vitest'
import { assembleTodaysSession } from './sessionOrchestration'
import { sortedCandidatesForMuscle } from './exerciseRecommendation'
import { MUSCLE_GROUPS } from '../domain/muscles/muscleTaxonomy'
import { isHomeFriendly } from '../domain/sessionAssembly/sessionAssembly'

// Picked programmatically from the real library rather than hardcoded, so
// this stays valid if the library is ever regenerated.
const CHEST_GOAL_EXERCISE_ID = sortedCandidatesForMuscle('chest')[0].id

describe('assembleTodaysSession', () => {
  it('produces a non-empty session including the goal exercise as a goal-priority slot for the focus muscle', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 3,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 300,
    })
    expect(slots.length).toBeGreaterThan(0)
    const goalSlot = slots.find((s) => s.exercise.id === CHEST_GOAL_EXERCISE_ID)
    expect(goalSlot).toBeDefined()
    expect(goalSlot?.isGoalPriority).toBe(true)
    expect(goalSlot?.muscleGroupId).toBe('chest')
  })

  it('excludes injured muscles from the session entirely', () => {
    const injuredMuscles = MUSCLE_GROUPS.filter((g) => g.id !== 'chest').map((g) => g.id) // injure everything except the focus muscle
    const slots = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles,
      sessionsPerWeek: 3,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 300,
    })
    expect(slots.every((s) => s.muscleGroupId === 'chest')).toBe(true)
  })

  it('substitutes home-friendly exercises when noGymToday is set', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 3,
      completedSessionsInBlock: 0,
      noGymToday: true,
      availableMinutes: 300,
    })
    // Not every muscle necessarily has a home-friendly candidate, but where a substitute exists it should be used.
    const anyHomeFriendly = slots.some((s) => isHomeFriendly(s.exercise))
    expect(anyHomeFriendly).toBe(true)
  })

  it('cuts to a short, goal-priority-first session under a tight time budget (boundary condition)', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 3,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 1, // far too small for a full session
    })
    expect(slots.length).toBeGreaterThan(0) // time-crunch cuts never go below 1 exercise
    expect(slots[0].isGoalPriority).toBe(true) // goal-priority sorts first, so it survives the cut
  })

  it('returns an empty session for a non-positive sessionsPerWeek (boundary condition)', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 0,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 300,
    })
    expect(slots).toEqual([])
  })

  it('wraps the rotation index by sessionsPerWeek (boundary condition — session 0 and session sessionsPerWeek both mean the first slot)', () => {
    const first = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 3,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 300,
    })
    const wrapped = assembleTodaysSession({
      focusMuscle: 'chest',
      goalExerciseId: CHEST_GOAL_EXERCISE_ID,
      injuredMuscles: [],
      sessionsPerWeek: 3,
      completedSessionsInBlock: 3,
      noGymToday: false,
      availableMinutes: 300,
    })
    expect(wrapped.map((s) => s.muscleGroupId).sort()).toEqual(first.map((s) => s.muscleGroupId).sort())
  })

  it('every slot has at least one set (no exercise assembled with zero prescribed sets)', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'back',
      goalExerciseId: sortedCandidatesForMuscle('back')[0].id,
      injuredMuscles: [],
      sessionsPerWeek: 4,
      completedSessionsInBlock: 1,
      noGymToday: false,
      availableMinutes: 300,
    })
    expect(slots.every((s) => s.sets >= 1)).toBe(true)
  })

  it('skips a maintenance muscle whose weekly target rounds to zero sets (boundary condition — several muscles have MV=0, e.g. front_delts, meaning no dedicated maintenance work is needed)', () => {
    const slots = assembleTodaysSession({
      focusMuscle: 'back', // front_delts' MV is 0 regardless of which muscle is focus
      goalExerciseId: sortedCandidatesForMuscle('back')[0].id,
      injuredMuscles: [],
      sessionsPerWeek: 1, // one session/week -> every maintenance muscle appears in this single session, making the assertion deterministic
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 1000, // generous, so this isn't about time-crunch cuts
    })
    expect(slots.some((s) => s.muscleGroupId === 'front_delts')).toBe(false)
  })
})
