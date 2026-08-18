import { describe, expect, it } from 'vitest'
import { getExerciseImageUrls } from './exerciseImages'

describe('getExerciseImageUrls', () => {
  it('derives both frame URLs from a free-exercise-db id', () => {
    expect(getExerciseImageUrls('3_4_Sit-Up')).toEqual([
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/0.jpg',
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/1.jpg',
    ])
  })

  it('returns null for custom exercise ids (boundary condition — no source images exist)', () => {
    expect(getExerciseImageUrls('custom-neutral-grip-pull-up')).toBeNull()
  })
})
