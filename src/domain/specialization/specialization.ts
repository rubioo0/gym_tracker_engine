import { getMuscleGroup, isLargeMuscleGroup, type MuscleGroupId, type MuscleGroupSize } from '../muscles/muscleTaxonomy'
import type { VolumeLandmark } from '../volumeLandmarks/landmarks'
import type { LibraryExercise } from '../exerciseLibrary/exerciseLibrary'
import type { FocusHistoryEntry } from './types'

/** See specialization.md for the full derivation and worked example. */
export function pickNextFocus(candidates: readonly FocusHistoryEntry[]): MuscleGroupId | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  for (const candidate of candidates.slice(1)) {
    if (isMoreLagging(candidate, best)) {
      best = candidate
    }
  }
  return best.muscleGroupId
}

/** True if `a` has gone longer without being focus than `b` (never-focused beats any real date; two never-focused muscles tie, keeping whichever came first in input order — see pickNextFocus). */
function isMoreLagging(a: FocusHistoryEntry, b: FocusHistoryEntry): boolean {
  if (a.lastFocusEndedAt === null && b.lastFocusEndedAt === null) return false
  if (a.lastFocusEndedAt === null) return true
  if (b.lastFocusEndedAt === null) return false
  return new Date(a.lastFocusEndedAt).getTime() < new Date(b.lastFocusEndedAt).getTime()
}

/** See specialization.md — a standalone guard, not currently reachable from pickNextFocus given the single-focus model. */
export function violatesMajorPairingRule(muscleGroupIds: readonly MuscleGroupId[]): boolean {
  return muscleGroupIds.filter((id) => isLargeMuscleGroup(id)).length >= 2
}

/** See specialization.md: isFocus muscles progress toward MRV, others hold at MV. */
export function targetWeeklySets(landmark: VolumeLandmark, isFocus: boolean): number {
  return isFocus ? landmark.mrv : landmark.mv
}

/** See specialization.md "Exercise count and primary/accessory structure" for why these specific numbers were picked from the researched ranges. */
export const EXERCISE_COUNT_BY_SIZE: Record<MuscleGroupSize, number> = {
  large: 3,
  small: 2,
}

export function exerciseCountForMuscle(muscleGroupId: MuscleGroupId): number {
  return EXERCISE_COUNT_BY_SIZE[getMuscleGroup(muscleGroupId).size]
}

export interface PrimaryAndAccessories {
  primary: LibraryExercise
  accessories: LibraryExercise[]
}

/** See specialization.md — deliberately simple; candidate quality/ordering is the caller's responsibility. */
export function selectPrimaryAndAccessories(
  candidates: readonly LibraryExercise[],
  muscleGroupId: MuscleGroupId,
): PrimaryAndAccessories | null {
  if (candidates.length === 0) return null
  const primary = candidates.find((ex) => ex.mechanic === 'compound') ?? candidates[0]
  const accessorySlots = exerciseCountForMuscle(muscleGroupId) - 1
  const accessories = candidates.filter((ex) => ex.id !== primary.id).slice(0, accessorySlots)
  return { primary, accessories }
}
