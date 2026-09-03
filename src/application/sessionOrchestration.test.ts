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

  it(
    'never assembles a session that trains only the focus muscle across a full rotation (regression: real user report ' +
      '"looks like it focuses on one muscle and ignores the others" -- root-caused to 13/17 muscle groups having mv=0, ' +
      'fixed in landmarks.ts)',
    () => {
      for (let completedSessionsInBlock = 0; completedSessionsInBlock < 3; completedSessionsInBlock++) {
        const slots = assembleTodaysSession({
          focusMuscle: 'chest',
          goalExerciseId: CHEST_GOAL_EXERCISE_ID,
          injuredMuscles: [],
          sessionsPerWeek: 3,
          completedSessionsInBlock,
          noGymToday: false,
          availableMinutes: 1000, // generous, so this is purely about muscle selection, not time-crunch cuts
        })
        const muscleGroupsThisSession = new Set(slots.map((s) => s.muscleGroupId))
        expect(muscleGroupsThisSession.size).toBeGreaterThan(1)
      }
    },
  )

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

  it(
    'a tighter time budget genuinely assembles fewer exercises than a generous one for the same session ' +
      '(verifies real user report: "перевірити чи точно кількість часу впливає на вправи" -- 45 vs 90 min looked identical)',
    () => {
      const input = {
        focusMuscle: 'chest' as const,
        goalExerciseId: CHEST_GOAL_EXERCISE_ID,
        injuredMuscles: [],
        sessionsPerWeek: 3,
        completedSessionsInBlock: 0,
        noGymToday: false,
      }
      const tight = assembleTodaysSession({ ...input, availableMinutes: 45 })
      const generous = assembleTodaysSession({ ...input, availableMinutes: 300 })
      expect(tight.length).toBeLessThan(generous.length)
    },
  )

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

  it('skips any muscle whose weekly target rounds to zero sets (boundary condition — the `setsThisSession <= 0` guard still exists for safety, even though real landmark data no longer drives any muscle to exactly zero after the 2026-09 mv fix in landmarks.ts)', () => {
    // An extreme sessionsPerWeek makes even the FOCUS muscle's own target
    // round to zero (round(back's mrv=25 / 60) = 0), proving the guard is
    // generic and not specifically tied to any one muscle's landmark data.
    const slots = assembleTodaysSession({
      focusMuscle: 'back',
      goalExerciseId: sortedCandidatesForMuscle('back')[0].id,
      injuredMuscles: [],
      sessionsPerWeek: 60,
      completedSessionsInBlock: 0,
      noGymToday: false,
      availableMinutes: 10000, // generous, so this isn't about time-crunch cuts
    })
    expect(slots.some((s) => s.muscleGroupId === 'back')).toBe(false)
  })
})
