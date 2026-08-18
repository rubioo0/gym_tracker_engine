# ACWR (Acute:Chronic Workload Ratio) — derivation

Source of truth for `acwr.ts`. Per-muscle load-monitoring math, adapted from sports-science injury-load literature (Gabbett/Hulin) — see plan doc "Research findings", topic 9, and "Real-world pain point surfaced".

## Acute and chronic load

- **Acute load**: sum of hard sets (from `workoutLog.ts`'s `hardSetCount`, already fraction-weighted for secondary muscles) for a muscle over the **last 7 days**.
- **Chronic load**: sum of hard sets over the **last 28 days**, converted to a **weekly average** (`÷ 4`) so it's comparable to the acute figure — acute and chronic must be in the same units (sets/week) for the ratio to mean anything.

```
ACWR = acuteLoad(last 7 days) / (chronicLoad(last 28 days) / 4)
```

This module takes pre-aggregated `{ date, hardSets }` entries for one specific muscle as input, rather than raw `WorkoutLog[]` — keeping it a small, composable pure function per the functional-core architecture. The application layer is responsible for turning a `WorkoutLog[]` + `ExerciseLibrary` lookup into these entries via `workoutLog.ts`'s `hardSetCount`, once per muscle.

### Cold-start handling

The chronic (28-day) window always fully *contains* the acute (7-day) window, so "chronic load is zero but acute load is nonzero" can never actually happen — any entry counted in acute is automatically counted in chronic too. `acwr()` returns `0` (no load, no risk) whenever chronic load is zero, which necessarily means acute is also zero.

This function's `number | null` return type does **not** yet solve a different, real cold-start problem: a user with only a few days of *any* tracked history gets an artificially volatile ratio, since a mostly-empty 28-day window produces an unstable weekly average. Deciding a minimum-tracked-days threshold for a genuine "insufficient data" signal is a real future refinement — not yet a locked decision, so not invented here. (An earlier version of this function tried to signal that via a `chronic === 0 && acute > 0` check; that branch was unreachable dead code given the window nesting above, caught by its own test failing — see git history.)

### Worked example (mirrored in `acwr.test.ts`)

10 hard sets in the last 7 days; 32 hard sets total in the last 28 days (weekly average = 8):
```
ACWR = 10 / (32 / 4) = 10 / 8 = 1.25
```

## Risk zones (`classifyAcwrZone`)

Per the IOC-consensus research already cited in the plan doc: sweet spot 0.8–1.3, injury risk 2-4x higher above 1.5.

```
ratio === null        -> 'insufficientData'
ratio < 0.8            -> 'low'       (below the sweet spot — early in a block, or a possible detraining watch if sustained)
0.8 <= ratio <= 1.3    -> 'safe'
1.3 < ratio <= 1.5     -> 'elevated'
ratio > 1.5            -> 'high'
```

## The 1.3 safety ceiling (`ACWR_SAFETY_CEILING`, `exceedsCeiling`)

Distinct from the zone classification above: this is the **hard limit** referenced by two other locked decisions — the plan-compression safety bound (Phase 9) and this module's own deload trigger (below). Both use the conservative end of the research range, not the looser 1.5: **"ACWR ceiling exact value: 1.3... matches the generally cautious posture already used elsewhere."** `exceedsCeiling(ratio)` is `true` when `ratio !== null && ratio > ACWR_SAFETY_CEILING`.

## Detraining-risk detection (`daysSinceLastLoad`, `isDetrainingRisk`)

Per the plan doc's "Real-world pain point surfaced": a muscle that's had a genuine break should be treated differently on resumption. Research cited earlier: meaningful atrophy onset starts within roughly 2 weeks of inactivity. `isDetrainingRisk` flags `true` once `daysSinceLastLoad >= 14` — the earlier end of the "~2-3 weeks" range the earlier research cited, chosen as an early-warning threshold rather than waiting for the more severe 3-week mark. This module only provides the **detection primitive**; deciding what to actually *do* about a detected gap (auto-suggested resumption weight, etc.) is a later phase's job — see the plan doc's "Real-world pain point" section.

## Deload trigger (`shouldDeload`)

Directly implements the locked decision: **"a deload is suggested when EITHER a muscle's ACWR crosses into the danger zone... OR the primary APRE lift fails to progress for 2+ consecutive sessions."**

```
shouldDeload(ratio, consecutiveHeldSessions) =
  exceedsCeiling(ratio) OR consecutiveHeldSessions >= 2
```

`consecutiveHeldSessions` is computed by `countConsecutiveHeldSessions()`, which walks a chronological list of `{ targetReps, actualReps }` APRE outcomes from the **most recent session backward**, counting how many in a row missed the target (per `apre.ts`'s `nextWorkingWeight` "hold" condition: `actualReps < targetReps`) before hitting one that progressed.

### Worked example (mirrored in `acwr.test.ts`)

Sessions in order, oldest to newest: `[{8,10}(miss), {10,10}(hit), {8,10}(miss), {7,10}(miss)]` — walking backward from the newest: session 4 missed (count=1), session 3 missed (count=2), session 2 hit → stop. `countConsecutiveHeldSessions` returns `2`, which alone is enough to trigger `shouldDeload` regardless of ACWR.
