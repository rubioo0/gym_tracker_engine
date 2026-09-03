import type { MuscleGroupId } from '../muscles/muscleTaxonomy'

/** Weeks-per-month approximation used to derive a monthly cap from a weekly figure. */
export const WEEKS_PER_MONTH = 52 / 12

export type VolumeLandmarkSourceConfidence = 'published' | 'estimated'

export interface VolumeLandmark {
  muscleGroupId: MuscleGroupId
  /** Maintenance Volume — weekly hard sets to hold current size. */
  mv: number
  /** Minimum Effective Volume — weekly hard sets that actually drives growth. */
  mev: number
  /** Maximum Adaptive Volume range — where most growth happens. */
  mavLow: number
  mavHigh: number
  /** Maximum Recoverable Volume — ceiling before returns flatten/reverse. */
  mrv: number
  /**
   * 'published' = modeled on RP's own published landmark tables.
   * 'estimated' = RP has no standard entry for this muscle; conservative
   * placeholder modeled on a similar small-muscle group. See landmarks.md.
   */
  sourceConfidence: VolumeLandmarkSourceConfidence
}

// Weekly hard-set figures. See landmarks.md for sourcing honesty notes —
// the four 'estimated' rows are placeholders, not verified research figures.
//
// `mv` for 13 of these 17 rows was originally 0, taken straight from RP's
// published tables under the assumption that those muscles get "enough
// indirect work from other lifts" to need no dedicated maintenance volume
// of their own. That assumption doesn't hold in *this* app's session
// assembly: sessionOrchestration.ts treats each muscle atomically (its own
// exercise slot or none at all) with no mechanism crediting a muscle for
// indirect work from a compound lift trained elsewhere in the rotation —
// so mv=0 meant those 13 muscles were silently and permanently excluded
// from every session they'd otherwise land in as maintenance work (real
// user report: a single-focus-muscle rotation slot can end up 100% one
// muscle group). Raised to a small nonzero floor (2 sets/week) purely as a
// session-assembly data fix — not a
// claim that the RP-published mv=0 figures are wrong for their original
// context.
export const VOLUME_LANDMARKS: readonly VolumeLandmark[] = [
  { muscleGroupId: 'chest', mv: 4, mev: 8, mavLow: 12, mavHigh: 20, mrv: 22, sourceConfidence: 'published' },
  { muscleGroupId: 'back', mv: 6, mev: 10, mavLow: 14, mavHigh: 22, mrv: 25, sourceConfidence: 'published' },
  { muscleGroupId: 'traps', mv: 2, mev: 2, mavLow: 6, mavHigh: 12, mrv: 16, sourceConfidence: 'published' },
  { muscleGroupId: 'front_delts', mv: 2, mev: 2, mavLow: 6, mavHigh: 8, mrv: 12, sourceConfidence: 'published' },
  { muscleGroupId: 'rear_delts', mv: 2, mev: 6, mavLow: 12, mavHigh: 20, mrv: 26, sourceConfidence: 'published' },
  { muscleGroupId: 'biceps', mv: 2, mev: 4, mavLow: 8, mavHigh: 14, mrv: 20, sourceConfidence: 'published' },
  { muscleGroupId: 'triceps', mv: 2, mev: 4, mavLow: 8, mavHigh: 14, mrv: 18, sourceConfidence: 'published' },
  { muscleGroupId: 'forearms', mv: 2, mev: 2, mavLow: 6, mavHigh: 10, mrv: 16, sourceConfidence: 'published' },
  { muscleGroupId: 'abs', mv: 2, mev: 2, mavLow: 8, mavHigh: 16, mrv: 25, sourceConfidence: 'published' },
  { muscleGroupId: 'quads', mv: 6, mev: 8, mavLow: 12, mavHigh: 18, mrv: 20, sourceConfidence: 'published' },
  { muscleGroupId: 'hamstrings', mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20, sourceConfidence: 'published' },
  { muscleGroupId: 'glutes', mv: 2, mev: 4, mavLow: 8, mavHigh: 16, mrv: 20, sourceConfidence: 'published' },
  { muscleGroupId: 'calves', mv: 2, mev: 6, mavLow: 8, mavHigh: 16, mrv: 20, sourceConfidence: 'published' },
  // Estimated (no standard published RP entry) — see landmarks.md.
  { muscleGroupId: 'obliques', mv: 2, mev: 2, mavLow: 6, mavHigh: 10, mrv: 16, sourceConfidence: 'estimated' },
  { muscleGroupId: 'adductors', mv: 2, mev: 2, mavLow: 6, mavHigh: 10, mrv: 16, sourceConfidence: 'estimated' },
  { muscleGroupId: 'abductors', mv: 2, mev: 2, mavLow: 6, mavHigh: 10, mrv: 16, sourceConfidence: 'estimated' },
  { muscleGroupId: 'neck', mv: 2, mev: 2, mavLow: 4, mavHigh: 8, mrv: 12, sourceConfidence: 'estimated' },
]

const LANDMARK_BY_MUSCLE: ReadonlyMap<MuscleGroupId, VolumeLandmark> = new Map(
  VOLUME_LANDMARKS.map((l) => [l.muscleGroupId, l]),
)

export function getVolumeLandmark(muscleGroupId: MuscleGroupId): VolumeLandmark {
  const landmark = LANDMARK_BY_MUSCLE.get(muscleGroupId)
  if (!landmark) {
    throw new Error(`No volume landmark defined for muscle group: ${muscleGroupId}`)
  }
  return landmark
}

/**
 * Session-level cap derived from a weekly set figure and how many
 * sessions/week that muscle is trained. Per the "one weekly number, rest
 * derived" decision — there is no separately-configured session cap.
 */
export function sessionCapFromWeekly(weeklySets: number, sessionsPerWeekForMuscle: number): number {
  if (sessionsPerWeekForMuscle <= 0) {
    throw new Error('sessionsPerWeekForMuscle must be positive')
  }
  return weeklySets / sessionsPerWeekForMuscle
}

/**
 * Monthly-level cap derived from a weekly set figure. Per the "one weekly
 * number, rest derived" decision.
 */
export function monthlyCapFromWeekly(weeklySets: number): number {
  return weeklySets * WEEKS_PER_MONTH
}
