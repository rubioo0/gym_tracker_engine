import { ACWR_SAFETY_CEILING, DETRAINING_RISK_THRESHOLD_DAYS } from '../acwr/acwr'

/** See autoCorrection.md "Plan compression" for the derivation — reuses acwr.ts's own formula rather than inventing new math. */
export function maxSafeWeeklyLoad(chronicWeeklyAverageSets: number): number {
  return chronicWeeklyAverageSets * ACWR_SAFETY_CEILING
}

export interface MakeupSessionInput {
  chronicWeeklyAverageSets: number
  currentWeekSetsSoFar: number
  makeupSessionSets: number
}

/** See autoCorrection.md worked example. */
export function canAddMakeupSession(input: MakeupSessionInput): boolean {
  const projectedWeeklySets = input.currentWeekSetsSoFar + input.makeupSessionSets
  return projectedWeeklySets <= maxSafeWeeklyLoad(input.chronicWeeklyAverageSets)
}

export interface ResumptionSuggestion {
  suggestedWeightKg: number
  percentOfPrevious: number
  reason: string
}

interface ResumptionTier {
  minDays: number
  percentOfPrevious: number
}

/** See autoCorrection.md "Gap-resumption suggestion" honesty note — the 14-day first boundary intentionally matches acwr.ts's DETRAINING_RISK_THRESHOLD_DAYS. */
const RESUMPTION_TIERS: readonly ResumptionTier[] = [
  { minDays: 0, percentOfPrevious: 1.0 },
  { minDays: DETRAINING_RISK_THRESHOLD_DAYS, percentOfPrevious: 0.9 }, // 14
  { minDays: 28, percentOfPrevious: 0.8 },
  { minDays: 60, percentOfPrevious: 0.65 },
]

function tierFor(daysSinceLastLoad: number): ResumptionTier {
  // tiers are defined lowest-to-highest minDays; find the highest one whose threshold has been reached
  let matched = RESUMPTION_TIERS[0]
  for (const tier of RESUMPTION_TIERS) {
    if (daysSinceLastLoad >= tier.minDays) {
      matched = tier
    }
  }
  return matched
}

/** See autoCorrection.md worked example. */
export function suggestResumptionWeight(lastWorkingWeightKg: number, daysSinceLastLoad: number): ResumptionSuggestion {
  const tier = tierFor(daysSinceLastLoad)
  const suggestedWeightKg = lastWorkingWeightKg * tier.percentOfPrevious
  const percent = Math.round(tier.percentOfPrevious * 100)
  return {
    suggestedWeightKg,
    percentOfPrevious: tier.percentOfPrevious,
    reason: `${daysSinceLastLoad} days since last load — suggest ${percent}% of last working weight (${lastWorkingWeightKg}kg)`,
  }
}
