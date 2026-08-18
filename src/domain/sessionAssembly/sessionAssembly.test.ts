import { describe, expect, it } from 'vitest'
import {
  estimateSessionDurationMinutes,
  cutExercisesToFitBudget,
  orderExercises,
  isHomeFriendly,
  findHomeFriendlySubstitute,
  ESTIMATED_MINUTES_PER_WORKING_SET,
  type PlannedExerciseSlot,
  type OrderableExercise,
} from './sessionAssembly'
import type { LibraryExercise } from '../exerciseLibrary/exerciseLibrary'
import type { MuscleGroupId } from '../muscles/muscleTaxonomy'

describe('estimateSessionDurationMinutes', () => {
  it('multiplies total working sets by the estimated minutes per set', () => {
    expect(estimateSessionDurationMinutes(10)).toBe(10 * ESTIMATED_MINUTES_PER_WORKING_SET)
  })

  it('is zero for zero sets (boundary condition)', () => {
    expect(estimateSessionDurationMinutes(0)).toBe(0)
  })
})

describe('cutExercisesToFitBudget (worked example from sessionAssembly.md)', () => {
  const threeExercises: PlannedExerciseSlot[] = [
    { exerciseId: 'primary', sets: 4 },
    { exerciseId: 'accessory-1', sets: 4 },
    { exerciseId: 'accessory-2', sets: 4 },
  ]

  it('drops the lowest-priority exercise when the full list does not fit, keeping the survivors\' sets unchanged', () => {
    const result = cutExercisesToFitBudget(threeExercises, 25)
    expect(result).toEqual([
      { exerciseId: 'primary', sets: 4 },
      { exerciseId: 'accessory-1', sets: 4 },
    ])
  })

  it('keeps the full list when it already fits the budget', () => {
    expect(cutExercisesToFitBudget(threeExercises, 100)).toEqual(threeExercises)
  })

  it('never cuts below one exercise, even if it alone exceeds the budget (boundary condition)', () => {
    const result = cutExercisesToFitBudget(threeExercises, 1)
    expect(result).toEqual([{ exerciseId: 'primary', sets: 4 }])
  })

  it('handles an empty list without error (boundary condition)', () => {
    expect(cutExercisesToFitBudget([], 25)).toEqual([])
  })
})

describe('orderExercises', () => {
  it('sorts compound exercises before isolation/unknown ones', () => {
    const exercises: OrderableExercise[] = [
      { id: 'iso-1', mechanic: 'isolation', isGoalPriority: false },
      { id: 'comp-1', mechanic: 'compound', isGoalPriority: false },
    ]
    expect(orderExercises(exercises).map((e) => e.id)).toEqual(['comp-1', 'iso-1'])
  })

  it('treats null mechanic the same tier as isolation, both after compound (boundary condition)', () => {
    const exercises: OrderableExercise[] = [
      { id: 'unknown-1', mechanic: null, isGoalPriority: false },
      { id: 'comp-1', mechanic: 'compound', isGoalPriority: false },
      { id: 'iso-1', mechanic: 'isolation', isGoalPriority: false },
    ]
    expect(orderExercises(exercises).map((e) => e.id)[0]).toBe('comp-1')
  })

  it('orders goal-priority exercises first within a tier', () => {
    const exercises: OrderableExercise[] = [
      { id: 'comp-1', mechanic: 'compound', isGoalPriority: false },
      { id: 'comp-2-goal', mechanic: 'compound', isGoalPriority: true },
    ]
    expect(orderExercises(exercises).map((e) => e.id)).toEqual(['comp-2-goal', 'comp-1'])
  })

  it('is a stable sort — equal-rank items keep their input order (boundary condition)', () => {
    const exercises: OrderableExercise[] = [
      { id: 'iso-a', mechanic: 'isolation', isGoalPriority: false },
      { id: 'iso-b', mechanic: 'isolation', isGoalPriority: false },
    ]
    expect(orderExercises(exercises).map((e) => e.id)).toEqual(['iso-a', 'iso-b'])
  })
})

function fakeExercise(
  id: string,
  equipment: string | null,
  primaryMuscles: MuscleGroupId[],
  mechanic: 'compound' | 'isolation' | null = 'compound',
): LibraryExercise {
  return { id, nameEn: id, nameUk: id, equipment, mechanic, primaryMuscles, secondaryMuscles: [] }
}

describe('isHomeFriendly', () => {
  it('treats body-only and bands as home-friendly', () => {
    expect(isHomeFriendly(fakeExercise('a', 'body only', ['chest']))).toBe(true)
    expect(isHomeFriendly(fakeExercise('b', 'bands', ['chest']))).toBe(true)
  })

  it('treats barbell/machine/null as not home-friendly', () => {
    expect(isHomeFriendly(fakeExercise('c', 'barbell', ['chest']))).toBe(false)
    expect(isHomeFriendly(fakeExercise('d', 'machine', ['chest']))).toBe(false)
    expect(isHomeFriendly(fakeExercise('e', null, ['chest']))).toBe(false)
  })
})

describe('findHomeFriendlySubstitute', () => {
  it('returns the original unchanged if already home-friendly', () => {
    const original = fakeExercise('pushup', 'body only', ['chest'])
    expect(findHomeFriendlySubstitute(original, [])).toBe(original)
  })

  it('prefers a same-mechanic, same-primary-muscle home-friendly candidate', () => {
    const original = fakeExercise('barbell-bench', 'barbell', ['chest'], 'compound')
    const candidates = [
      fakeExercise('band-chest-press', 'bands', ['chest'], 'compound'),
      fakeExercise('band-chest-fly', 'bands', ['chest'], 'isolation'),
    ]
    expect(findHomeFriendlySubstitute(original, candidates)?.id).toBe('band-chest-press')
  })

  it('falls back to a different-mechanic match on the same muscle if no same-mechanic candidate exists (boundary condition)', () => {
    const original = fakeExercise('barbell-bench', 'barbell', ['chest'], 'compound')
    const candidates = [fakeExercise('band-chest-fly', 'bands', ['chest'], 'isolation')]
    expect(findHomeFriendlySubstitute(original, candidates)?.id).toBe('band-chest-fly')
  })

  it('returns null when nothing home-friendly targets the muscle (boundary condition)', () => {
    const original = fakeExercise('barbell-bench', 'barbell', ['chest'], 'compound')
    const candidates = [fakeExercise('band-row', 'bands', ['back'], 'compound')]
    expect(findHomeFriendlySubstitute(original, candidates)).toBeNull()
  })
})
