import type { ExperienceLevel } from '../profile/types'
import type { Goal } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = MS_PER_DAY * 7

/** See goalProjection.md "honesty note" for how these were derived and their real precision. */
export const ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE: Record<ExperienceLevel, number> = {
  beginner: 2.5,
  intermediate: 0.625,
  advanced: 0.15,
}

function weeksBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_WEEK
}

/**
 * Projects when a goal will be completed at a given weekly rate. Returns
 * `asOf` unchanged if the goal is already met, or `null` if the rate is
 * non-positive (will never complete). See goalProjection.md worked example.
 */
export function projectedCompletionDate(
  currentWeightKg: number,
  targetWeightKg: number,
  weeklyRateKg: number,
  asOf: Date,
): Date | null {
  if (targetWeightKg <= currentWeightKg) return asOf
  if (weeklyRateKg <= 0) return null
  const weeksNeeded = (targetWeightKg - currentWeightKg) / weeklyRateKg
  return new Date(asOf.getTime() + weeksNeeded * MS_PER_WEEK)
}

/** True if the projected completion date is on or before the deadline. See goalProjection.md. */
export function isOnTrack(
  currentWeightKg: number,
  targetWeightKg: number,
  deadline: string,
  weeklyRateKg: number,
  asOf: Date,
): boolean {
  const projected = projectedCompletionDate(currentWeightKg, targetWeightKg, weeklyRateKg, asOf)
  if (projected === null) return false
  return projected.getTime() <= new Date(deadline).getTime()
}

/**
 * At-creation-time feasibility check using an experience-level default rate
 * (no logged history exists yet for a brand-new goal) — implements "warned
 * at creation time" per goalProjection.md.
 */
export function checkFeasibilityAtCreation(goal: Goal, experienceLevel: ExperienceLevel): boolean {
  const assumedRate = ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[experienceLevel]
  return isOnTrack(goal.startingWeightKg, goal.targetWeightKg, goal.deadline, assumedRate, new Date(goal.createdAt))
}

export { weeksBetween }
