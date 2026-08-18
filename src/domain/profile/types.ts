import type { MuscleGroupId } from '../muscles/muscleTaxonomy'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

/**
 * Simple label, not a calorie number — per the locked "deficit-magnitude
 * entry: simple label, not a number" decision. No food-tracking or
 * maintenance-calorie math required from the user.
 */
export type DeficitLabel = 'notDieting' | 'smallDeficit' | 'bigDeficit'

export interface UserProfile {
  /** Demographics — stored only in v1, not algorithm-active. See plan doc "Demographics... feeding the algorithm: stored only for v1". */
  ageYears?: number
  sex?: 'male' | 'female' | 'other'
  heightCm?: number
  bodyweightKg?: number
  /** Stored only, not algorithm-active — unlike deficitLabel below. */
  sleepHoursPerNight?: number
  /** Algorithm-active: modifies progression-projection expectations — see profile.ts's deficitRateModifier(). */
  deficitLabel: DeficitLabel
  /** Explicit user-set constraint the engine plans around, not something it chooses. */
  sessionsPerWeek: number
  /** Fitbod-style binary exclusion — a muscle in this list is fully excluded from generated workouts until manually removed. Not medical advice. */
  injuredMuscles: MuscleGroupId[]
  /** Self-reported starting point; per the locked decision this is meant to be quietly superseded by actual logged training history once there's enough of it (that supersession logic lives in a later phase, once there's real per-muscle history to derive it from). */
  experienceByMuscle: Partial<Record<MuscleGroupId, ExperienceLevel>>
}
