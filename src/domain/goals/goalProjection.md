# Goal projection — derivation

Source of truth for `goalProjection.ts`. Implements two locked decisions: **"Goal tracking (v1): passive projection only — engine projects completion date from current rate and flags if it's past the deadline; you decide what to change"**, and **"Infeasible goals: warned at creation time — engine sanity-checks the requested target/deadline against experience level, starting point, and typical progression rates."**

## Required rate vs. observed rate — two different uses of the same math

The core arithmetic (`weeksBetween`, and the target/current/rate relationship) is used for two different purposes with two different rate sources:

1. **At goal creation** (`checkFeasibilityAtCreation`): no logged history exists yet for this goal, so the rate comes from `ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE` (below) — a rough per-experience-level default.
2. **Ongoing passive tracking** (`isOnTrack` / `projectedCompletionDate`, called by the application layer with a rate derived from real logged history — that derivation lives outside this module, e.g. from `apre.ts`'s session-over-session weight changes): the rate is the user's own observed progress.

Both cases call the same underlying functions — there is no separate "creation-time" formula, just a different rate input.

## `projectedCompletionDate`

```
if targetWeightKg <= currentWeightKg: return asOf                (goal already met)
if weeklyRateKg <= 0:                 return null                (will never complete at this rate)
else:                                 weeksNeeded = (target - current) / weeklyRateKg
                                       return asOf + weeksNeeded * 7 days
```

### Worked example (mirrored in `goalProjection.test.ts`)

Current 80kg, target 100kg, observed rate 2.5kg/week, `asOf` = 2026-08-15: `weeksNeeded = 20/2.5 = 8` weeks -> projected completion 2026-10-10 (56 days later).

## `isOnTrack`

`true` if the projected completion date is on or before the deadline (and a projection exists — a `null` projection, i.e. a non-positive rate, is never on track unless the goal is already met).

## `checkFeasibilityAtCreation` and the estimated default-rate table

Thin wrapper: `isOnTrack(goal.startingWeightKg, goal.targetWeightKg, goal.deadline, assumedRate, goal.createdAt)`, where `assumedRate` comes from `ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[experienceLevel]`:

```
beginner:     2.5 kg/week
intermediate: 0.625 kg/week
advanced:     0.15 kg/week
```

**Honesty note — how these were derived, and their real precision**: sourced from general strength-training literature describing progression *cadence* qualitatively (beginners progress session-to-session, intermediates week-to-week, advanced lifters month-to-month-or-longer), with a commonly-cited concrete figure for one lift (bench press: beginners +2.5-5kg/week early on; intermediates +2.5kg per 2-4 weeks; advanced lifters take months for the same 2.5kg). This table converts those qualitative/lift-specific figures into rough weekly rates (using the *conservative* end of each range, consistent with this project's generally cautious posture elsewhere — e.g. the ACWR ceiling picked 1.3 over 1.5): beginner uses the low end of the weekly range (2.5); intermediate uses 2.5kg ÷ 4 weeks (the slower end of "2-4 weeks"); advanced uses roughly 2.5kg ÷ ~4 months. These are **not** a precise per-exercise study result — they're a reasonable, clearly-flagged starting estimate for a sanity check, not a claim of scientific precision, and are expected to be tuned once there's real usage data (same treatment as the volume-landmark "estimated" rows and the deficit-rate modifier).

### Worked example (mirrored in `goalProjection.test.ts`)

A beginner goal created today, 60kg -> 100kg (40kg needed) with a 4-week deadline: required rate would be `40/4 = 10` kg/week, far above the beginner default of `2.5` kg/week -> flagged as not feasible at creation.
