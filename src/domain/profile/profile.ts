import type { MuscleGroupId } from '../muscles/muscleTaxonomy'
import type { DeficitLabel, UserProfile } from './types'

/** See profile.md for the full derivation and honesty note on these values. */
export const DEFICIT_RATE_MODIFIER: Record<DeficitLabel, number> = {
  notDieting: 1.0,
  smallDeficit: 0.85,
  bigDeficit: 0.5,
}

/** Fitbod-style binary exclusion check — see profile.md. */
export function isMuscleExcluded(profile: UserProfile, muscleGroupId: MuscleGroupId): boolean {
  return profile.injuredMuscles.includes(muscleGroupId)
}

/** Multiplier to apply to an observed/assumed progression rate, given the user's current deficit label. See profile.md worked example. */
export function deficitRateModifier(deficitLabel: DeficitLabel): number {
  return DEFICIT_RATE_MODIFIER[deficitLabel]
}
