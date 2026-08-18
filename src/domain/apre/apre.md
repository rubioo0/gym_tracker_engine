# APRE (Autoregulating Progressive Resistance Exercise) — derivation

Source of truth for `apre.ts`. This is this project's adaptation of the protocol from Mann et al. (J Strength Cond Res, 2010) — see plan doc "Research findings on flagged deep-dive topics", topic 1, and the many locked decisions layered on top of it during grooming. **This is an adaptation, not the original clinical protocol** — the differences are called out explicitly below so nobody mistakes this for a literal implementation of the 2010 study.

## What the original protocol does, and what this project does differently

The original APRE-6/APRE-3 protocol: warm-up → 50% set → 75% set → an all-out AMRAP set at the working weight → a *fourth* set at a weight adjusted from a lookup table based on the AMRAP set's rep count, with separate adjustment tables for upper vs. lower body, in pound increments.

This project's adaptation, per locked decisions:
- **Rep target format**: a single target rep number per exercise (e.g. "10"), not an AMRAP-plus-lookup-table system — see plan doc "Rep target format: single target rep count per exercise... matches the validated protocol rather than adapting it to preserve today's authoring style" (the single-target-number choice IS the adaptation).
- **Ramp-set basis**: 50%/75% are computed directly off *last session's working weight* (`workoutLog.ts`'s `topSet`), not a true estimated 1RM — see plan doc "APRE ramp-set basis: % of last session's working weight."
- **No fourth adjustment set** — only one working set per session in this adaptation; its result directly determines *next session's* working weight, not a same-session fourth set.
- **Adjustment is binary, not a graduated lookup table**: hitting-or-beating the target reps increases the weight; missing the target holds it. See "Why no decrease" below.

## Ramp sets (`rampSets`)

```
rampSets(lastWorkingWeightKg) = [
  { weightKg: lastWorkingWeightKg * 0.5 },
  { weightKg: lastWorkingWeightKg * 0.75 },
]
```

These are *prescribed* ramp weights for the upcoming session (a planning-time function), not a log-processing one. They're intentionally left unrounded — real-world plate-loading increments are a UI/display concern for a later phase, not baked into this domain function.

### Worked example (mirrored in `apre.test.ts`)

Last session's working weight was 60kg: `rampSets(60)` → `[{ weightKg: 30 }, { weightKg: 45 }]`.

## Next working weight (`nextWorkingWeight`)

```
actualReps >= targetReps  ->  previousWorkingWeightKg + incrementKg   (progress)
actualReps <  targetReps  ->  previousWorkingWeightKg                  (hold)
```

### Why no automatic decrease

The original protocol's lookup table *does* decrease weight on a big miss. This project deliberately does not, for a reason grounded in an already-locked decision: **"Deload/regression trigger: reuses ACWR + APRE signals directly... the primary APRE lift fails to progress for 2+ consecutive sessions"** (plan doc, Phase 4). That decision only makes sense if a *single* miss just holds — if APRE itself decreased weight on every miss, there would be nothing left for the separate, ACWR-integrated deload mechanism to trigger on. Weight decreases are that later phase's responsibility, not this module's.

### Worked example (mirrored in `apre.test.ts`)

Previous working weight 60kg, target 10 reps, increment 2.5kg:
- Actual 10 reps (met target) -> `62.5`
- Actual 12 reps (beat target) -> `62.5` (same as meeting it exactly — this is a binary rule, not proportional to overshoot)
- Actual 8 reps (missed target) -> `60` (held, unchanged)
