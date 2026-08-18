import { ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE } from '../domain/goals/goalProjection'
import { deficitRateModifier } from '../domain/profile/profile'
import type { ExperienceLevel, DeficitLabel } from '../domain/profile/types'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Default suggested block duration, tiered by experience level. Not a
 * hard/fixed program length (that was deliberately dropped in favor of
 * "runs until goal completion or deadline") — just a starting point for the
 * deadline suggestion below, fully editable.
 *
 * Tiered rather than flat because training-age genuinely drives specialization
 * length in the literature (unlike muscle size, which doesn't): novices are
 * "PR-ready" every 48-72 hours and benefit from shorter, more frequent
 * recalibration; intermediates fit the standard 4-8 week specialization-phase
 * convention; advanced lifters need monthly-or-longer blocks since their
 * per-week rate (ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE) is slow enough that
 * an 8-week window yields a barely-meaningful target. See goalProjection.md
 * and the 2026-08-18 duration research for sourcing.
 */
export const DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE: Record<ExperienceLevel, number> = {
  beginner: 6,
  intermediate: 8,
  advanced: 12,
}

/** Round to the nearest practical plate-loading increment (kg). A UX nicety, not a researched number. */
const TARGET_ROUNDING_INCREMENT_KG = 2.5

export interface GoalSuggestionInput {
  startingWeightKg: number
  experienceLevel: ExperienceLevel
  deficitLabel: DeficitLabel
  createdAt: Date
  durationWeeks: number
}

export interface GoalSuggestion {
  deadline: string // ISO
  targetWeightKg: number
}

/**
 * Suggests a target weight + deadline together, reusing the existing
 * per-experience-level rate table (goalProjection.ts) and deficit modifier
 * (profile.ts) rather than inventing new math — by construction, accepting
 * this suggestion as-is will always pass checkFeasibilityAtCreation for
 * the same experience level, since it's derived from the exact same rate.
 */
export function suggestGoalTargetAndDeadline(input: GoalSuggestionInput): GoalSuggestion {
  const baseRate = ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[input.experienceLevel]
  const adjustedRate = baseRate * deficitRateModifier(input.deficitLabel)
  const rawTarget = input.startingWeightKg + adjustedRate * input.durationWeeks
  const targetWeightKg = Math.round(rawTarget / TARGET_ROUNDING_INCREMENT_KG) * TARGET_ROUNDING_INCREMENT_KG
  const deadline = new Date(input.createdAt.getTime() + input.durationWeeks * MS_PER_WEEK).toISOString()
  return { deadline, targetWeightKg }
}
