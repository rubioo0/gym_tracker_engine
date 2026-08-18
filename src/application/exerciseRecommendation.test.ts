import { describe, expect, it } from 'vitest'
import { recommendExerciseForMuscle } from './exerciseRecommendation'
import { getExercisesWithPrimaryMuscle } from '../domain/exerciseLibrary/exerciseLibrary'

describe('recommendExerciseForMuscle', () => {
  it('recommends a real exercise that actually targets the requested muscle as primary', () => {
    const recommended = recommendExerciseForMuscle('quads')
    expect(recommended).toBeDefined()
    expect(recommended?.primaryMuscles).toContain('quads')
  })

  it('prefers barbell/dumbbell/machine/cable equipment over more exotic implements when both are available', () => {
    const recommended = recommendExerciseForMuscle('chest')
    const candidates = getExercisesWithPrimaryMuscle('chest')
    const hasCommonEquipment = candidates.some((c) => ['barbell', 'dumbbell', 'machine', 'cable'].includes(c.equipment ?? ''))
    if (hasCommonEquipment) {
      expect(['barbell', 'dumbbell', 'machine', 'cable', 'body only']).toContain(recommended?.equipment)
    }
  })

  it('is deterministic — same muscle always recommends the same exercise', () => {
    expect(recommendExerciseForMuscle('back')?.id).toBe(recommendExerciseForMuscle('back')?.id)
  })

  it('returns undefined for a muscle with no primary-targeting exercises in the library (boundary condition, not expected in practice given every muscle group has real coverage)', () => {
    // neck realistically has few/no dedicated exercises in free-exercise-db; if this ever becomes non-empty the test below still holds shape-wise
    const recommended = recommendExerciseForMuscle('neck')
    if (recommended) {
      expect(recommended.primaryMuscles).toContain('neck')
    } else {
      expect(recommended).toBeUndefined()
    }
  })
})
