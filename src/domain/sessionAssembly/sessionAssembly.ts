import type { LibraryExercise, ExerciseMechanic } from '../exerciseLibrary/exerciseLibrary'

/** See sessionAssembly.md "honesty note" for how this rough estimate was chosen. */
export const ESTIMATED_MINUTES_PER_WORKING_SET = 3

export function estimateSessionDurationMinutes(totalWorkingSets: number): number {
  return totalWorkingSets * ESTIMATED_MINUTES_PER_WORKING_SET
}

export interface PlannedExerciseSlot {
  exerciseId: string
  sets: number
}

function totalSets(exercises: readonly PlannedExerciseSlot[]): number {
  return exercises.reduce((sum, ex) => sum + ex.sets, 0)
}

/**
 * Drops the lowest-priority (last) exercise from an already priority-ordered
 * list until the session fits the time budget, or only one exercise
 * remains. See sessionAssembly.md worked example. Never returns an empty
 * list for a non-empty input.
 */
export function cutExercisesToFitBudget(
  exercises: readonly PlannedExerciseSlot[],
  availableMinutes: number,
): PlannedExerciseSlot[] {
  let remaining = [...exercises]
  while (remaining.length > 1 && estimateSessionDurationMinutes(totalSets(remaining)) > availableMinutes) {
    remaining = remaining.slice(0, -1)
  }
  return remaining
}

export interface OrderableExercise {
  id: string
  mechanic: ExerciseMechanic
  isGoalPriority: boolean
}

function tierRank(mechanic: ExerciseMechanic): number {
  return mechanic === 'compound' ? 0 : 1 // isolation and null/unknown collapse into one tier — see sessionAssembly.md
}

/** NSCA-tiering-derived ordering with goal-priority as the tiebreak within a tier. Stable sort — equal-rank items keep their input order. See sessionAssembly.md. */
export function orderExercises(exercises: readonly OrderableExercise[]): OrderableExercise[] {
  return [...exercises].sort((a, b) => {
    const tierDiff = tierRank(a.mechanic) - tierRank(b.mechanic)
    if (tierDiff !== 0) return tierDiff
    if (a.isGoalPriority !== b.isGoalPriority) return a.isGoalPriority ? -1 : 1
    return 0
  })
}

export const HOME_FRIENDLY_EQUIPMENT: ReadonlySet<string> = new Set(['body only', 'bands'])

export function isHomeFriendly(exercise: LibraryExercise): boolean {
  return exercise.equipment !== null && HOME_FRIENDLY_EQUIPMENT.has(exercise.equipment)
}

/**
 * Finds a home-friendly substitute for `original` when the per-session
 * "no gym today" flag is set. Returns `original` unchanged if it's already
 * home-friendly. Prefers a same-mechanic + same-primary-muscle candidate,
 * falls back to primary-muscle-only, and `null` if nothing qualifies. See
 * sessionAssembly.md.
 */
export function findHomeFriendlySubstitute(
  original: LibraryExercise,
  candidates: readonly LibraryExercise[],
): LibraryExercise | null {
  if (isHomeFriendly(original)) return original

  const targetsMuscle = (c: LibraryExercise) =>
    c.id !== original.id && isHomeFriendly(c) && c.primaryMuscles.some((m) => original.primaryMuscles.includes(m))

  const sameMechanic = candidates.find((c) => targetsMuscle(c) && c.mechanic === original.mechanic)
  if (sameMechanic) return sameMechanic

  return candidates.find(targetsMuscle) ?? null
}
