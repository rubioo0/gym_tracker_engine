import { describe, expect, it } from 'vitest'
import {
  pickNextFocus,
  violatesMajorPairingRule,
  targetWeeklySets,
  exerciseCountForMuscle,
  selectPrimaryAndAccessories,
  EXERCISE_COUNT_BY_SIZE,
} from './specialization'
import { getVolumeLandmark } from '../volumeLandmarks/landmarks'
import type { LibraryExercise } from '../exerciseLibrary/exerciseLibrary'
import type { FocusHistoryEntry } from './types'

describe('pickNextFocus (worked example from specialization.md)', () => {
  it('picks the never-focused muscle over any muscle with a real last-focus date', () => {
    const candidates: FocusHistoryEntry[] = [
      { muscleGroupId: 'chest', lastFocusEndedAt: '2026-06-16T00:00:00.000Z' }, // 60 days before 2026-08-15
      { muscleGroupId: 'back', lastFocusEndedAt: null },
      { muscleGroupId: 'quads', lastFocusEndedAt: '2026-07-16T00:00:00.000Z' }, // 30 days before
    ]
    expect(pickNextFocus(candidates)).toBe('back')
  })

  it('among muscles with real dates, picks the oldest one', () => {
    const candidates: FocusHistoryEntry[] = [
      { muscleGroupId: 'chest', lastFocusEndedAt: '2026-06-16T00:00:00.000Z' },
      { muscleGroupId: 'quads', lastFocusEndedAt: '2026-07-16T00:00:00.000Z' },
    ]
    expect(pickNextFocus(candidates)).toBe('chest')
  })

  it('breaks a tie between two never-focused muscles by input order (boundary condition)', () => {
    const candidates: FocusHistoryEntry[] = [
      { muscleGroupId: 'biceps', lastFocusEndedAt: null },
      { muscleGroupId: 'triceps', lastFocusEndedAt: null },
    ]
    expect(pickNextFocus(candidates)).toBe('biceps')
  })

  it('returns null for an empty candidate list (boundary condition)', () => {
    expect(pickNextFocus([])).toBeNull()
  })

  it('returns the only candidate for a single-item list (boundary condition)', () => {
    expect(pickNextFocus([{ muscleGroupId: 'calves', lastFocusEndedAt: null }])).toBe('calves')
  })
})

describe('violatesMajorPairingRule', () => {
  it('flags two large muscle groups together', () => {
    expect(violatesMajorPairingRule(['chest', 'back'])).toBe(true)
  })

  it('allows one large plus one small', () => {
    expect(violatesMajorPairingRule(['chest', 'biceps'])).toBe(false)
  })

  it('allows two small muscle groups together', () => {
    expect(violatesMajorPairingRule(['biceps', 'triceps'])).toBe(false)
  })

  it('allows a single large muscle group alone (boundary condition)', () => {
    expect(violatesMajorPairingRule(['chest'])).toBe(false)
  })

  it('allows an empty list (boundary condition)', () => {
    expect(violatesMajorPairingRule([])).toBe(false)
  })
})

describe('targetWeeklySets', () => {
  it('targets MRV for the focus muscle', () => {
    const chest = getVolumeLandmark('chest')
    expect(targetWeeklySets(chest, true)).toBe(chest.mrv)
  })

  it('targets MV for a non-focus (maintenance) muscle', () => {
    const chest = getVolumeLandmark('chest')
    expect(targetWeeklySets(chest, false)).toBe(chest.mv)
  })
})

describe('exerciseCountForMuscle (worked example from specialization.md)', () => {
  it('gives large muscle groups the upper end of the researched range (3)', () => {
    expect(exerciseCountForMuscle('chest')).toBe(EXERCISE_COUNT_BY_SIZE.large)
    expect(exerciseCountForMuscle('chest')).toBe(3)
  })

  it('gives small muscle groups the upper end of the researched range (2)', () => {
    expect(exerciseCountForMuscle('biceps')).toBe(EXERCISE_COUNT_BY_SIZE.small)
    expect(exerciseCountForMuscle('biceps')).toBe(2)
  })
})

function fakeExercise(id: string, mechanic: 'compound' | 'isolation'): LibraryExercise {
  return { id, nameEn: id, nameUk: id, equipment: 'barbell', mechanic, primaryMuscles: ['chest'], secondaryMuscles: [] }
}

describe('selectPrimaryAndAccessories', () => {
  it('picks the first compound exercise as primary, even if listed after isolation exercises', () => {
    const candidates = [fakeExercise('iso-1', 'isolation'), fakeExercise('comp-1', 'compound'), fakeExercise('comp-2', 'compound')]
    const result = selectPrimaryAndAccessories(candidates, 'chest') // large -> 3 total, 2 accessory slots
    expect(result?.primary.id).toBe('comp-1')
    expect(result?.accessories.map((a) => a.id)).toEqual(['iso-1', 'comp-2'])
  })

  it('falls back to the first candidate as primary when none are compound (boundary condition)', () => {
    const candidates = [fakeExercise('iso-1', 'isolation'), fakeExercise('iso-2', 'isolation')]
    const result = selectPrimaryAndAccessories(candidates, 'biceps') // small -> 2 total, 1 accessory slot
    expect(result?.primary.id).toBe('iso-1')
    expect(result?.accessories.map((a) => a.id)).toEqual(['iso-2'])
  })

  it('returns fewer accessories than the slot count when not enough candidates exist (boundary condition)', () => {
    const candidates = [fakeExercise('comp-1', 'compound')]
    const result = selectPrimaryAndAccessories(candidates, 'chest') // wants 2 accessories, only 1 candidate total
    expect(result?.primary.id).toBe('comp-1')
    expect(result?.accessories).toEqual([])
  })

  it('returns null for an empty candidate list (boundary condition)', () => {
    expect(selectPrimaryAndAccessories([], 'chest')).toBeNull()
  })
})
