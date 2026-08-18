import { describe, expect, it } from 'vitest'
import { createGoalWithBlock } from './goalCreation'
import type { LibraryExercise } from '../domain/exerciseLibrary/exerciseLibrary'

function fakeExercise(primaryMuscles: LibraryExercise['primaryMuscles']): LibraryExercise {
  return {
    id: 'Barbell_Squat',
    nameEn: 'Barbell Squat',
    nameUk: 'Присідання зі штангою',
    equipment: 'barbell',
    mechanic: 'compound',
    primaryMuscles,
    secondaryMuscles: [],
  }
}

describe('createGoalWithBlock (implements grooming finding #1: goal creation IS block creation)', () => {
  it('derives the specialization focus from the exercise\'s first primary muscle', () => {
    const result = createGoalWithBlock(
      {
        exerciseId: 'Barbell_Squat',
        startingWeightKg: 80,
        targetWeightKg: 100,
        deadline: '2026-12-01T00:00:00.000Z',
        trainingEmphasis: 'strength',
        createdAt: '2026-08-17T00:00:00.000Z',
      },
      fakeExercise(['quads', 'glutes']),
      () => 'goal-1',
    )
    expect(result.specializationBlock.focusMuscle).toBe('quads')
  })

  it('links the block back to the goal via goalId, and starts it unended', () => {
    const result = createGoalWithBlock(
      {
        exerciseId: 'Barbell_Squat',
        startingWeightKg: 80,
        targetWeightKg: 100,
        deadline: '2026-12-01T00:00:00.000Z',
        trainingEmphasis: 'strength',
        createdAt: '2026-08-17T00:00:00.000Z',
      },
      fakeExercise(['quads']),
      () => 'goal-1',
    )
    expect(result.specializationBlock.goalId).toBe(result.goal.id)
    expect(result.goal.id).toBe('goal-1')
    expect(result.specializationBlock.endedAt).toBeNull()
    expect(result.specializationBlock.startedAt).toBe('2026-08-17T00:00:00.000Z')
  })

  it('throws for an exercise with no primary muscle (boundary condition — should be unreachable given the library invariant, but must never silently produce a focus-less block)', () => {
    expect(() =>
      createGoalWithBlock(
        {
          exerciseId: 'x',
          startingWeightKg: 80,
          targetWeightKg: 100,
          deadline: '2026-12-01T00:00:00.000Z',
          trainingEmphasis: 'strength',
          createdAt: '2026-08-17T00:00:00.000Z',
        },
        fakeExercise([]),
        () => 'goal-1',
      ),
    ).toThrow()
  })
})
