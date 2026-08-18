/** See apre.md for the full derivation, worked examples, and why this is an
 * adaptation of the original Mann et al. protocol rather than a literal
 * implementation of it. */

export const RAMP_SET_PERCENTAGES = [0.5, 0.75] as const

export interface RampSet {
  weightKg: number
}

/**
 * Prescribed ramp-set weights for the upcoming session, based on last
 * session's working weight — see plan doc "APRE ramp-set basis: % of last
 * session's working weight". A planning-time function; weights are left
 * unrounded (plate-loading rounding is a later UI concern).
 */
export function rampSets(lastWorkingWeightKg: number): RampSet[] {
  return RAMP_SET_PERCENTAGES.map((pct) => ({ weightKg: lastWorkingWeightKg * pct }))
}

export interface NextWorkingWeightInput {
  previousWorkingWeightKg: number
  targetReps: number
  actualReps: number
  incrementKg: number
}

/**
 * The core APRE adjustment: meeting or beating the target reps progresses
 * the weight for next session; missing it holds the current weight. Never
 * decreases — see apre.md "Why no automatic decrease": repeated misses are
 * the separate deload-trigger mechanism's responsibility (Phase 4), not
 * this function's.
 */
export function nextWorkingWeight(input: NextWorkingWeightInput): number {
  const { previousWorkingWeightKg, targetReps, actualReps, incrementKg } = input
  return actualReps >= targetReps ? previousWorkingWeightKg + incrementKg : previousWorkingWeightKg
}
