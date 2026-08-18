# Autonomous assembly / auto-correction — derivation

Source of truth for `autoCorrection.ts`. This is the capstone phase — per the plan doc, it "ties everything above into an actual re-planning loop toward the deadline." Deliberately, most of the real math already exists in earlier phases; this module is mostly *composition*, plus two genuinely new pieces (plan-compression evaluation, gap-resumption suggestion).

## Plan compression (`maxSafeWeeklyLoad`, `canAddMakeupSession`)

Per **"Missed/skipped whole sessions: plan compresses, deadline stays fixed... bounded by the ACWR ceiling... beyond that, the engine slips the deadline instead of compressing further."**

**What "compression" concretely means here**: the app's per-exercise goals progress via APRE, which is session-count-based (each session is a chance to hit the target and progress the weight), not directly volume-based. So "catching up" after a missed session means offering an **extra session** for the goal muscle that week to recover a lost APRE opportunity — and *that's* the thing the ACWR ceiling has to bound, since an extra session raises that muscle's weekly hard-set count.

This reuses `acwr.ts`'s own formula rather than inventing new math: `ACWR = acuteWeekly / chronicWeekly`, so the maximum acute (this-week) load that keeps `ACWR <= ACWR_SAFETY_CEILING` is simply:

```
maxSafeWeeklyLoad(chronicWeeklyAverage) = chronicWeeklyAverage * ACWR_SAFETY_CEILING
```

`canAddMakeupSession` checks whether *this week's sets so far* plus *the proposed makeup session's sets* would stay at or under that cap. If not, the engine should not offer the makeup session — the deadline slips instead (a UI/application-layer decision, not this function's — it only answers "is this safe," not "what happens if it isn't").

### Worked example (mirrored in `autoCorrection.test.ts`)

Chronic weekly average 8 sets/week: `maxSafeWeeklyLoad = 8 * 1.3 = 10.4`. If 6 sets are already done this week and a makeup session would add 5 more (total 11), `11 > 10.4` → not safe, `canAddMakeupSession` returns `false`.

## Gap-resumption suggestion (`suggestResumptionWeight`)

Per **"Gap resumption: auto-suggest, user confirms — engine proposes an adjusted resumption point with a stated reason (e.g. gap length → estimated detraining → suggested % of last working weight)."**

```
< 14 days since last load:  100% of last working weight (no adjustment — below the detraining-risk threshold from acwr.ts)
14-27 days:                  90%
28-59 days:                  80%
60+ days:                    65%
```

**Honesty note**: these percentages are the project's own reasonable staged estimates, following the same shape as the detraining research already cited (meaningful atrophy onset around 2 weeks, worsening with longer gaps) — not a precisely validated formula. The `14`-day first tier boundary is deliberately the same constant as `acwr.ts`'s `DETRAINING_RISK_THRESHOLD_DAYS`, so the two concepts stay consistent (no adjustment happens before the muscle is even flagged as a detraining risk). Tunable later once there's real usage data, same treatment as every other "estimated" table in this project (volume landmarks, goal-projection default rates, deficit-rate modifier).

Returns a **suggestion with a stated reason string**, not an auto-applied change — the user confirms or overrides, per the locked decision. What the application layer does with a rejected/overridden suggestion is out of this module's scope.

### Worked example (mirrored in `autoCorrection.test.ts`)

Last working weight 80kg, 20 days since last load (in the 14-27 day tier): suggested weight = `80 * 0.9 = 72kg`.

## Deload trigger — no new code

Already fully implemented by `acwr.ts`'s `shouldDeload()` (ACWR danger zone OR 2+ consecutive held APRE sessions). This phase doesn't add anything new here — it's referenced in this doc only to make the composition explicit: a complete "what should the engine suggest right now" picture combines `shouldDeload` (from `acwr.ts`) with `canAddMakeupSession`/`suggestResumptionWeight` (this module), evaluated per-muscle by the application layer, which is UI territory beyond this domain-logic-only project stage.

## Goal closure — no new code

Per **"Goal closure: passive only, no formal end-of-deadline review moment... the existing projection/warning system is treated as sufficient."** `goalProjection.ts`'s `isOnTrack`/`projectedCompletionDate` (Phase 5) already fully satisfy this — there is nothing additional to build here.
