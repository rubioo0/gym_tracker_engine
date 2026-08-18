import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { UserProfile } from '../domain/profile/types'

export type GoalRenewalReason = 'deadlinePassed' | 'targetMet' | 'focusMuscleInjured'

/**
 * Implements grooming findings #11 + #13 as one composed check, per the
 * plan doc's synthesis: an injury to the active focus muscle forces the
 * block to end early, using the same "set your next goal" flow as a
 * deadline passing or the target being met — one mechanism, three
 * triggers, rather than separate handling for each.
 *
 * `currentWeightKg` is null when there's no logged history yet for the
 * goal's exercise (nothing to compare against — "target met" can only be
 * true once there's a real log to check).
 */
export function checkGoalNeedsRenewal(
  goal: Goal,
  block: SpecializationBlock,
  profile: UserProfile,
  currentWeightKg: number | null,
  asOf: Date,
): GoalRenewalReason | null {
  if (profile.injuredMuscles.includes(block.focusMuscle)) return 'focusMuscleInjured'
  if (currentWeightKg !== null && currentWeightKg >= goal.targetWeightKg) return 'targetMet'
  if (new Date(goal.deadline).getTime() < asOf.getTime()) return 'deadlinePassed'
  return null
}
