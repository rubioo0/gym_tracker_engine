import { MUSCLE_GROUPS, type MuscleGroupId } from '../domain/muscles/muscleTaxonomy'
import type { FocusHistoryEntry, SpecializationBlock } from '../domain/specialization/types'

/**
 * Builds the candidate list `pickNextFocus` (domain/specialization) needs,
 * from real block history + the profile's injury list — the seeding logic
 * flagged as missing in the application-layer grooming (finding #3).
 * Injured muscles are excluded entirely (never candidates). A muscle's
 * `lastFocusEndedAt` is the most recent `endedAt` among its *ended* blocks
 * (an active, not-yet-ended block doesn't count — and shouldn't exist for
 * more than one muscle at a time under the single-focus model anyway).
 */
export function buildFocusHistorySeed(
  blocks: readonly SpecializationBlock[],
  injuredMuscles: readonly MuscleGroupId[],
): FocusHistoryEntry[] {
  const injuredSet = new Set(injuredMuscles)
  return MUSCLE_GROUPS.filter((group) => !injuredSet.has(group.id)).map((group) => ({
    muscleGroupId: group.id,
    lastFocusEndedAt: mostRecentEndedAt(blocks, group.id),
  }))
}

function mostRecentEndedAt(blocks: readonly SpecializationBlock[], muscleGroupId: MuscleGroupId): string | null {
  const endedDates = blocks
    .filter((b) => b.focusMuscle === muscleGroupId && b.endedAt !== null)
    .map((b) => b.endedAt as string)
  if (endedDates.length === 0) return null
  return endedDates.reduce((latest, date) => (new Date(date).getTime() > new Date(latest).getTime() ? date : latest))
}
