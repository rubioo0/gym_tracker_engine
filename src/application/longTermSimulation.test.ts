import { describe, expect, it } from 'vitest'
import { assembleTodaysSession } from './sessionOrchestration'
import { prescribeSession, shouldDeloadGoalExercise, WEIGHT_INCREMENT_KG } from './sessionPrescription'
import { countSessionsInBlock, workoutLogsInBlock } from './activeGoal'
import { createGoalWithBlock } from './goalCreation'
import { checkGoalNeedsRenewal } from './goalStatus'
import { projectedCompletionDate, isOnTrack, ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE } from '../domain/goals/goalProjection'
import { MUSCLE_GROUPS } from '../domain/muscles/muscleTaxonomy'
import { getExerciseById } from '../domain/exerciseLibrary/exerciseLibrary'
import type { UserProfile } from '../domain/profile/types'
import type { ExerciseLog, WorkoutLog } from '../domain/workoutLog/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const SESSIONS_PER_WEEK = 4
const SESSION_SPACING_DAYS = 2.5
const TOTAL_SESSIONS = 90 // ~225 simulated days, ~7.5 months -- item 7: "simulate the full program flow over several months/years"

/**
 * Item 7 from real-usage feedback: "simulate the full program flow over
 * several months/years to verify long-term viability." Runs the actual
 * application-layer functions a real user's daily loop calls
 * (assembleTodaysSession -> prescribeSession -> a synthesized WorkoutLog),
 * with every logged working set exactly hitting target reps (perfect
 * adherence -- the scenario most likely to expose a runaway/negative
 * weight bug or a muscle that silently never gets scheduled), advancing a
 * real simulated clock across ~7.5 months. No React/reducer involved --
 * this is plain state-threading over pure functions, exactly like a real
 * multi-session history would accumulate.
 */
describe('long-term simulation', () => {
  it('keeps every muscle in rotation, keeps goal-exercise weight sane, and reaches a realistic goal', () => {
    const profile: UserProfile = {
      deficitLabel: 'notDieting',
      sessionsPerWeek: SESSIONS_PER_WEEK,
      injuredMuscles: [],
      experienceByMuscle: {},
    }

    const exercise = getExerciseById('Barbell_Curl')
    if (!exercise) throw new Error('fixture exercise missing from the library')

    const createdAt = '2026-01-01T00:00:00.000Z'
    const deadline = '2027-01-01T00:00:00.000Z' // a full year out -- generous, not the thing under test
    const { goal, specializationBlock: block } = createGoalWithBlock(
      {
        exerciseId: exercise.id,
        startingWeightKg: 20,
        targetWeightKg: 40,
        deadline,
        trainingEmphasis: 'hypertrophy',
        createdAt,
      },
      exercise,
      () => 'sim-goal-1',
    )

    // Sanity-check the projection math itself against the numbers chosen
    // above, independent of the simulation loop below -- these numbers are
    // meant to be reachable, not just large.
    expect(
      isOnTrack(goal.startingWeightKg, goal.targetWeightKg, goal.deadline, ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.beginner, new Date(createdAt)),
    ).toBe(true)

    const workoutLogs: WorkoutLog[] = []
    const musclesSeen = new Set<string>()
    const goalWorkingWeights: number[] = []
    let targetMetAt: { asOf: Date; weightKg: number } | null = null

    let currentDate = new Date(createdAt)
    for (let i = 0; i < TOTAL_SESSIONS; i++) {
      currentDate = new Date(currentDate.getTime() + SESSION_SPACING_DAYS * MS_PER_DAY)

      const blockLogs = workoutLogsInBlock(workoutLogs, block)
      const deloadGoalExercise = shouldDeloadGoalExercise(workoutLogs, blockLogs, block.focusMuscle, goal, currentDate)

      const slots = assembleTodaysSession({
        focusMuscle: block.focusMuscle,
        goalExerciseId: goal.exerciseId,
        injuredMuscles: profile.injuredMuscles,
        sessionsPerWeek: profile.sessionsPerWeek,
        completedSessionsInBlock: countSessionsInBlock(workoutLogs, block),
        noGymToday: false,
        // Deliberately generous -- this simulation is about long-horizon
        // progression/rotation correctness, not time-crunch cutting
        // (already covered by sessionOrchestration.test.ts).
        availableMinutes: 300,
      })
      for (const slot of slots) musclesSeen.add(slot.muscleGroupId)

      const prescriptions = prescribeSession(slots, goal, blockLogs, { asOf: currentDate, deloadGoalExercise })
      const exerciseLogs: ExerciseLog[] = prescriptions.map((p) => ({
        exerciseId: p.exerciseId,
        skipped: false,
        // Perfect adherence: every set exactly hits its target reps, so
        // APRE progresses the goal exercise every session it isn't
        // deloaded -- the fastest-moving, most failure-prone path.
        sets: p.sets.map((s) => ({ weightKg: s.weightKg, reps: s.targetReps, role: s.role })),
      }))
      workoutLogs.push({ id: `sim-${i}`, completedAt: currentDate.toISOString(), successful: true, exerciseLogs })

      const goalPrescription = prescriptions.find((p) => p.exerciseId === goal.exerciseId)
      const goalWorkingSet = goalPrescription?.sets.find((s) => s.role === 'working')
      if (goalWorkingSet) goalWorkingWeights.push(goalWorkingSet.weightKg)

      if (!targetMetAt && goalWorkingSet && goalWorkingSet.weightKg >= goal.targetWeightKg) {
        targetMetAt = { asOf: currentDate, weightKg: goalWorkingSet.weightKg }
      }
    }

    // (a) Regression guard for the Phase 6 landmarks.ts `mv` fix: every
    // non-injured muscle group must get scheduled at least once. A full
    // rotation cycle is `sessionsPerWeek` sessions (assignMusclesToSessions
    // is a fixed round-robin, not calendar-based), and this run is ~22
    // full cycles long, so there's no "not enough sessions yet" excuse.
    for (const group of MUSCLE_GROUPS) {
      expect(musclesSeen.has(group.id)).toBe(true)
    }

    // (b) Weight progression stays monotonically sane: starts at the
    // goal's declared starting weight, only ever holds or increases by
    // exactly one plate-loading increment, never goes negative or skips.
    expect(goalWorkingWeights.length).toBe(TOTAL_SESSIONS)
    expect(goalWorkingWeights[0]).toBe(goal.startingWeightKg)
    for (let i = 1; i < goalWorkingWeights.length; i++) {
      const delta = goalWorkingWeights[i] - goalWorkingWeights[i - 1]
      expect(delta === 0 || delta === WEIGHT_INCREMENT_KG).toBe(true)
      expect(goalWorkingWeights[i]).toBeGreaterThan(0)
    }
    expect(goalWorkingWeights[goalWorkingWeights.length - 1]).toBeGreaterThan(goalWorkingWeights[0])

    // (c) The goal is genuinely reachable at this progression rate, and
    // the app's own renewal safety net recognizes it the moment it's met
    // -- not just a projection formula returning a plausible-looking date.
    expect(targetMetAt).not.toBeNull()
    if (targetMetAt) {
      expect(projectedCompletionDate(targetMetAt.weightKg, goal.targetWeightKg, ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE.beginner, targetMetAt.asOf)).toEqual(targetMetAt.asOf)
      const renewalReason = checkGoalNeedsRenewal(goal, block, profile, targetMetAt.weightKg, targetMetAt.asOf)
      expect(renewalReason).toBe('targetMet')
    }
  })
})
