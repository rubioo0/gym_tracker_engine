# Session assembly — derivation

Source of truth for `sessionAssembly.ts`. Implements the locked decisions for turning muscle/volume targets into an actual session: split derivation, duration estimation, time-crunch cuts, exercise ordering, and home-friendly substitution.

## Session-duration estimate (`estimateSessionDurationMinutes`)

Per **"Session-duration estimate: input only, no duration display to the user... the engine still needs an internal, rough duration estimate to know when the time-crunch-cut logic should trigger."**

```
estimateSessionDurationMinutes(totalWorkingSets) = totalWorkingSets * ESTIMATED_MINUTES_PER_WORKING_SET (3)
```

**Honesty note**: `3` minutes/working-set is a rough, commonly-cited rule-of-thumb average (covering the set itself plus rest between sets) — not derived from a specific study, and deliberately not exercise-specific, since rest/tempo are "descriptive only for v1" (not modeled precisely enough to justify more granularity here). This is a real number the engine acts on internally, but it is never shown to the user as a claimed precise prediction, consistent with the locked decision. Ramp sets (APRE) are excluded from `totalWorkingSets`, same as they're excluded from volume counting elsewhere — a ramp set still takes real time, but this function only receives working-set counts from its caller, which should account for ramp time separately if ever needed.

## Time-crunch cuts (`cutExercisesToFitBudget`)

Per **"Time-crunch cuts: cut whole exercises, keep sets-per-remaining-exercise — protects meaningful volume on higher-priority... exercises rather than thinning volume across everything."**

Takes a list of exercises **already ordered highest-priority-first** (the caller's job — typically the output of `orderExercises` below) and repeatedly drops the **last** (lowest-priority) exercise until the estimated duration fits the budget, or only one exercise remains. Never cuts down to zero — a session needs at least one exercise, even if it alone exceeds the stated time budget; that's a caller-level concern (e.g. surfacing a warning), not this function's.

### Worked example (mirrored in `sessionAssembly.test.ts`)

Three exercises at 4 sets each (12 total, ~36 min estimated) with a 25-minute budget: dropping the last exercise leaves 8 sets (~24 min), which fits — so the lowest-priority exercise is cut, the other two survive with their sets unchanged (per "keep sets-per-remaining-exercise", not thinned).

## Exercise ordering (`orderExercises`)

Per **"NSCA tiering (power → compound → isolation) as the outer structure, goal-priority within the compound tier."** This project's exercise data (from `free-exercise-db`) only distinguishes `'compound' | 'isolation' | null` — there is no separate "power" category to sort on, so the ordering collapses to two tiers: compound-or-unknown-mechanic first, then isolation... no — **compound first, then everything else** (isolation and unrecognized/`null` mechanic together, since an unknown mechanic shouldn't be assumed lower-fatigue than a known isolation move, but also shouldn't be promoted above confirmed compounds). Within each tier, goal-priority exercises (whatever serves the active specialization focus) sort first — implemented as a stable sort, so equal-priority items within a tier keep their original (caller-supplied) relative order.

## Home-friendly substitution (`findHomeFriendlySubstitute`)

Per **"Exercise substitution basis: muscle + mechanic compatibility only... Substitutes are chosen from the tagged library by matching primary muscle + movement pattern"** and **"the engine substitutes bodyweight/home-friendly alternatives for just that session"** when the per-session "no gym today" flag is set.

`HOME_FRIENDLY_EQUIPMENT = { 'body only', 'bands' }` — the two equipment tags in this project's exercise-library vocabulary that don't require gym machinery. If the original exercise is already home-friendly, it's returned unchanged (no substitution needed). Otherwise, the function prefers a candidate matching **both** primary muscle and `mechanic` (the "movement pattern" match from the decision), falling back to a primary-muscle-only match if no same-mechanic candidate exists, and `null` if nothing home-friendly targets that muscle at all.

## Session split derivation (`assignMusclesToSessions`, in `sessionSplit.ts`)

Per **"Session split: derived from the volume math... the split is computed by packing required sets into however many sessions/week fit the time budget"** and the research finding that frequency itself barely matters once weekly volume is matched — this doesn't need to be a hard optimization problem.

Given the single-focus specialization model (Phase 6): the **focus muscle appears in every session that week** (it needs the most volume, progressing toward MRV, so it gets maximum frequency); **each maintenance muscle appears in exactly one session per week**, distributed round-robin across the available sessions (maintenance volume, MV, is low enough that one session's worth is normally sufficient — and per-muscle *set counts* within a session are Phase 6's `targetWeeklySets` divided by however many sessions that muscle actually appears in, which this function doesn't compute itself, just the muscle-to-session mapping).

### Worked example (mirrored in `sessionSplit.test.ts`)

Focus muscle `chest`, maintenance muscles `[back, biceps, triceps, quads]` (input order), 3 sessions/week. Each maintenance muscle `i` goes to `session[i % 3]`:
```
session 0: [chest, back, quads]   (back is index 0 -> 0%3=0; quads is index 3 -> 3%3=0)
session 1: [chest, biceps]        (index 1 -> 1%3=1)
session 2: [chest, triceps]       (index 2 -> 2%3=2)
```

