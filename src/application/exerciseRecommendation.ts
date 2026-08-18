import { getExercisesWithPrimaryMuscle, type LibraryExercise } from '../domain/exerciseLibrary/exerciseLibrary'
import { selectPrimaryAndAccessories } from '../domain/specialization/specialization'
import type { MuscleGroupId } from '../domain/muscles/muscleTaxonomy'

/**
 * Simple, transparent equipment-preference order used to sort candidates
 * before handing them to the domain layer's `selectPrimaryAndAccessories`
 * (which picks the first compound exercise in whatever order it's given —
 * see specialization.md: "candidate ordering/filtering... is the caller's
 * job"). This is a reasonable default, not deeply researched — common
 * barbell/dumbbell/machine/cable equipment first, then bodyweight and
 * bands, then more exotic implements last. Easy to override manually in
 * the UI; this only decides what gets suggested by default.
 */
const EQUIPMENT_PREFERENCE_ORDER = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'body only',
  'kettlebells',
  'bands',
  'e-z curl bar',
  'exercise ball',
  'medicine ball',
  'other',
  'foam roll',
]

function equipmentRank(equipment: string | null): number {
  if (equipment === null) return EQUIPMENT_PREFERENCE_ORDER.length
  const index = EQUIPMENT_PREFERENCE_ORDER.indexOf(equipment)
  return index === -1 ? EQUIPMENT_PREFERENCE_ORDER.length : index
}

/**
 * Exercises targeting `muscleGroupId` as primary, sorted by the equipment
 * preference above. Exposed separately from `recommendExerciseForMuscle`
 * so session orchestration can build a full primary+accessories selection
 * (not just the single best pick) from the same ordering.
 */
export function sortedCandidatesForMuscle(muscleGroupId: MuscleGroupId): LibraryExercise[] {
  const candidates = getExercisesWithPrimaryMuscle(muscleGroupId)
  return [...candidates].sort((a, b) => equipmentRank(a.equipment) - equipmentRank(b.equipment))
}

/**
 * Auto-recommends the best exercise for a muscle group — the engine
 * picking for you being the actual point of this app, with manual
 * override always available in the UI on top of this. Returns undefined
 * if the library has no exercise targeting this muscle as primary.
 */
export function recommendExerciseForMuscle(muscleGroupId: MuscleGroupId): LibraryExercise | undefined {
  return selectPrimaryAndAccessories(sortedCandidatesForMuscle(muscleGroupId), muscleGroupId)?.primary
}
