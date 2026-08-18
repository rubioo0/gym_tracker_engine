const CUSTOM_EXERCISE_ID_PREFIX = 'custom-'
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

/**
 * Every free-exercise-db-sourced entry in the library (all ids not starting
 * with `custom-`) has a real 2-frame demonstration image pair hosted in that
 * same public-domain dataset's repo, at a URL fully determined by the
 * exercise id — e.g. id `3_4_Sit-Up` -> `.../exercises/3_4_Sit-Up/0.jpg` and
 * `/1.jpg`. This was never carried into exercise-library.json during Phase 0
 * (the generator only extracted name/instructions/muscles/equipment), but
 * doesn't need to be: the URL is derived, not stored, so there's nothing to
 * regenerate or keep in sync. The 9 hand-added custom exercises (no such
 * dataset entry exists for them) return null.
 */
export function getExerciseImageUrls(exerciseId: string): readonly [string, string] | null {
  if (exerciseId.startsWith(CUSTOM_EXERCISE_ID_PREFIX)) return null
  return [`${IMAGE_BASE_URL}/${exerciseId}/0.jpg`, `${IMAGE_BASE_URL}/${exerciseId}/1.jpg`]
}
