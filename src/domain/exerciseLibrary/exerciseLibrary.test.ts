import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, type MuscleGroupId } from '../muscles/muscleTaxonomy'
import { OLD_APP_EXERCISE_ALIASES } from './oldAppAliases'
import {
  EXERCISE_LIBRARY,
  findByExactEnglishName,
  getExerciseById,
  getExercisesTargeting,
  getExercisesWithPrimaryMuscle,
  isPerHandEquipment,
  resolveOldAppExercise,
} from './exerciseLibrary'

const VALID_MUSCLE_IDS = new Set(MUSCLE_GROUPS.map((g) => g.id))

describe('EXERCISE_LIBRARY', () => {
  it('has no duplicate ids', () => {
    const ids = EXERCISE_LIBRARY.map((ex) => ex.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every primary/secondary muscle reference is a valid MuscleGroupId', () => {
    for (const ex of EXERCISE_LIBRARY) {
      for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) {
        expect(VALID_MUSCLE_IDS.has(m as MuscleGroupId)).toBe(true)
      }
    }
  })

  it('every exercise has at least one primary muscle', () => {
    for (const ex of EXERCISE_LIBRARY) {
      expect(ex.primaryMuscles.length).toBeGreaterThan(0)
    }
  })

  it('no exercise lists the same muscle as both primary and secondary', () => {
    for (const ex of EXERCISE_LIBRARY) {
      const overlap = ex.primaryMuscles.filter((m) => ex.secondaryMuscles.includes(m))
      expect(overlap).toEqual([])
    }
  })

  // Regression guard, added after longTermSimulation.test.ts surfaced that
  // rear_delts and obliques -- valid MuscleGroupIds with their own
  // volume-landmark data -- had zero exercises tagged with either as a
  // primary muscle anywhere in the library, so no user could ever have
  // them scheduled by sessionOrchestration.ts's exercise selection
  // (selectPrimaryAndAccessories always found nothing, silently skipped).
  // Root cause: exercises literally named "Rear Delt Raise"/"Reverse
  // Flyes"/"Face Pull" and "Oblique Crunches"/"Side Bend"/"Russian Twist"
  // were mistagged as front_delts/abs respectively -- fixed by retagging
  // those specific, unambiguous cases (item 11 from real-usage feedback).
  it('every muscle group has at least one exercise with it as a primary muscle', () => {
    for (const group of MUSCLE_GROUPS) {
      const count = EXERCISE_LIBRARY.filter((ex) => ex.primaryMuscles.includes(group.id)).length
      expect(count).toBeGreaterThan(0)
    }
  })

  // Every distinct exercise name found in gym_tracker/src/data/seed.ts as of
  // the Phase 0 audit (2026-08-15) — see Phase 0 verification step 4 in the
  // plan doc. Resolved via the hand-reviewed alias table (oldAppAliases.ts),
  // NOT via exact/fuzzy name matching against the auto-generated library —
  // real free-exercise-db names frequently don't match the old app's
  // strings verbatim, and naive fuzzy matching produced at least one
  // dangerous mismatch during Phase 0 (see oldAppAliases.ts for details).
  describe.each(Object.keys(OLD_APP_EXERCISE_ALIASES))('old-app exercise %j', (name) => {
    it('resolves to a real library entry via the alias table', () => {
      const match = resolveOldAppExercise(name)
      expect(match, `expected "${name}" to resolve via OLD_APP_EXERCISE_ALIASES`).toBeDefined()
    })
  })

  it('covers all 27 exercises audited from the old app (no silent drop from the alias table)', () => {
    expect(Object.keys(OLD_APP_EXERCISE_ALIASES)).toHaveLength(27)
  })
})

describe('getExerciseById', () => {
  it('finds Barbell Squat via its real free-exercise-db id', () => {
    expect(getExerciseById('Barbell_Squat')?.nameEn).toBe('Barbell Squat')
  })

  it('finds a custom (non-free-exercise-db) entry, e.g. the hand-tagged neutral grip pull-up', () => {
    expect(getExerciseById('custom-neutral-grip-pull-up')?.nameEn).toBe('Neutral Grip Pull-up')
  })

  it('returns undefined for an unknown id', () => {
    expect(getExerciseById('not-a-real-id')).toBeUndefined()
  })
})

describe('getExercisesWithPrimaryMuscle', () => {
  it('includes Barbell Squat for quads', () => {
    const names = getExercisesWithPrimaryMuscle('quads').map((ex) => ex.nameEn)
    expect(names).toContain('Barbell Squat')
  })

  it('excludes exercises where glutes is only secondary, not primary (Barbell Squat)', () => {
    const names = getExercisesWithPrimaryMuscle('glutes').map((ex) => ex.nameEn)
    expect(names).not.toContain('Barbell Squat')
  })
})

describe('getExercisesTargeting', () => {
  it('includes Barbell Squat for glutes (primary-or-secondary)', () => {
    const names = getExercisesTargeting('glutes').map((ex) => ex.nameEn)
    expect(names).toContain('Barbell Squat')
  })
})

describe('findByExactEnglishName', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(findByExactEnglishName('  barbell squat  ')?.id).toBe('Barbell_Squat')
  })

  it('returns undefined for a name not in the library', () => {
    expect(findByExactEnglishName('Not A Real Exercise')).toBeUndefined()
  })
})

describe('resolveOldAppExercise', () => {
  it('rejects unsafe fuzzy matches in favor of a reviewed custom entry (Incline Leg Press, not the chest-press fuzzy match)', () => {
    const resolved = resolveOldAppExercise('Incline Leg Press')
    expect(resolved?.id).toBe('custom-incline-leg-press')
    expect(resolved?.primaryMuscles).toContain('quads') // sanity check: a leg exercise, not the chest press the fuzzy matcher suggested
  })

  it('returns undefined for a name with no alias entry', () => {
    expect(resolveOldAppExercise('Not An Old App Exercise')).toBeUndefined()
  })
})

describe('isPerHandEquipment', () => {
  it('is true for dumbbell', () => {
    expect(isPerHandEquipment({ equipment: 'dumbbell' })).toBe(true)
  })

  it('is true for kettlebells', () => {
    expect(isPerHandEquipment({ equipment: 'kettlebells' })).toBe(true)
  })

  it('is false for barbell, other equipment, and null', () => {
    expect(isPerHandEquipment({ equipment: 'barbell' })).toBe(false)
    expect(isPerHandEquipment({ equipment: 'body only' })).toBe(false)
    expect(isPerHandEquipment({ equipment: null })).toBe(false)
  })
})
