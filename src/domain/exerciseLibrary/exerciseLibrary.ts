import exerciseLibraryData from '../../../data/exercise-library.json'
import customExercisesData from '../../../data/custom-exercises.json'
import type { MuscleGroupId } from '../muscles/muscleTaxonomy'
import { OLD_APP_EXERCISE_ALIASES } from './oldAppAliases'

export type ExerciseMechanic = 'isolation' | 'compound' | null

export interface LibraryExercise {
  id: string
  nameEn: string
  nameUk: string | null
  equipment: string | null
  mechanic: ExerciseMechanic
  primaryMuscles: MuscleGroupId[]
  secondaryMuscles: MuscleGroupId[]
  /** Present on free-exercise-db-sourced entries; absent on the 9 hand-added custom entries (custom-exercises.json carries no instructions). */
  instructionsEn?: string[]
  instructionsUk?: string[]
}

// Casts are safe: both JSON assets' shapes are produced/validated against
// exactly this interface — exercise-library.json by
// tools/exercise-library-gen, custom-exercises.json by hand (see
// oldAppAliases.ts for why the custom entries exist: exercises the fuzzy
// matcher either couldn't find or matched unsafely). See plan doc "Project
// isolation & reuse".
export const EXERCISE_LIBRARY: readonly LibraryExercise[] = [
  ...(exerciseLibraryData as LibraryExercise[]),
  ...(customExercisesData as LibraryExercise[]),
]

const EXERCISE_BY_ID: ReadonlyMap<string, LibraryExercise> = new Map(
  EXERCISE_LIBRARY.map((ex) => [ex.id, ex]),
)

export function getExerciseById(id: string): LibraryExercise | undefined {
  return EXERCISE_BY_ID.get(id)
}

/** Whether a logged/prescribed weight for this exercise means "per hand/side" rather than total load — dumbbells and kettlebells are always loaded and moved independently per side. */
export function isPerHandEquipment(exercise: Pick<LibraryExercise, 'equipment'>): boolean {
  return exercise.equipment === 'dumbbell' || exercise.equipment === 'kettlebells'
}

/**
 * Exercises where the given muscle is a PRIMARY target. Used by the
 * primary-lift-plus-accessories selection (see plan doc "Primary vs.
 * accessory exercises").
 */
export function getExercisesWithPrimaryMuscle(muscleGroupId: MuscleGroupId): LibraryExercise[] {
  return EXERCISE_LIBRARY.filter((ex) => ex.primaryMuscles.includes(muscleGroupId))
}

/** Exercises where the given muscle is primary OR secondary. */
export function getExercisesTargeting(muscleGroupId: MuscleGroupId): LibraryExercise[] {
  return EXERCISE_LIBRARY.filter(
    (ex) => ex.primaryMuscles.includes(muscleGroupId) || ex.secondaryMuscles.includes(muscleGroupId),
  )
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9а-яіїєґ0-9\s]/gi, '').trim()
}

/**
 * Exact (normalized) name match against the English name. Prefer
 * resolveOldAppExercise for old-app exercise names specifically — this is a
 * generic fallback for anything not covered by the alias table (e.g. new
 * exercises added after Phase 0).
 */
export function findByExactEnglishName(name: string): LibraryExercise | undefined {
  const target = normalizeName(name)
  return EXERCISE_LIBRARY.find((ex) => normalizeName(ex.nameEn) === target)
}

/**
 * Resolves an old-app (gym_tracker/src/data/seed.ts) exercise name to its
 * library entry via the hand-reviewed alias table (oldAppAliases.ts) —
 * NOT via fuzzy or exact name matching, both of which are unsafe here (real
 * free-exercise-db names often don't match the old app's strings, and naive
 * fuzzy matching produced at least one dangerous mismatch during Phase 0 —
 * see oldAppAliases.ts for details).
 */
export function resolveOldAppExercise(oldAppName: string): LibraryExercise | undefined {
  const id = OLD_APP_EXERCISE_ALIASES[oldAppName]
  return id ? getExerciseById(id) : undefined
}
