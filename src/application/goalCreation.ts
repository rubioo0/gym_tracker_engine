import type { Goal, TrainingEmphasis } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { LibraryExercise } from '../domain/exerciseLibrary/exerciseLibrary'

/**
 * Implements the confirmed decision (application-layer grooming finding
 * #1): creating a goal IS creating its specialization block — there is no
 * separate "pick your focus" step. The focus muscle is the goal's
 * exercise's first primary muscle.
 */
export interface CreateGoalInput {
  exerciseId: string
  startingWeightKg: number
  targetWeightKg: number
  deadline: string // ISO date
  trainingEmphasis: TrainingEmphasis
  createdAt: string // ISO date, injected rather than read from Date.now() internally — keeps this a pure function
}

export interface CreateGoalResult {
  goal: Goal
  specializationBlock: SpecializationBlock
}

export function createGoalWithBlock(input: CreateGoalInput, exercise: LibraryExercise, newId: () => string): CreateGoalResult {
  if (exercise.primaryMuscles.length === 0) {
    // Should be unreachable given the exercise library's own "every exercise has >= 1 primary muscle" invariant (see exerciseLibrary.test.ts) — guarded anyway since this function must never silently produce a goal with no focus muscle.
    throw new Error(`Exercise ${exercise.id} has no primary muscle; cannot derive a specialization focus.`)
  }

  const goalId = newId()
  const goal: Goal = {
    id: goalId,
    exerciseId: input.exerciseId,
    startingWeightKg: input.startingWeightKg,
    targetWeightKg: input.targetWeightKg,
    deadline: input.deadline,
    createdAt: input.createdAt,
    trainingEmphasis: input.trainingEmphasis,
  }
  const specializationBlock: SpecializationBlock = {
    goalId,
    focusMuscle: exercise.primaryMuscles[0],
    startedAt: input.createdAt,
    endedAt: null,
  }
  return { goal, specializationBlock }
}
