# Workout log — derivation

Source of truth for `workoutLog.ts`. Per plan doc "Decisions locked": actual-performance logging is full per-set (weight + reps each), not a summary. This module holds the raw capture types (`types.ts`) plus the pure functions everything downstream (future APRE/ACWR/volume-landmark phases) will read from.

## Hard-set counting (`hardSetCount`)

Implements two already-locked decisions together:
- **Muscle-load metric**: hard-set count, not tonnage — "matching how RP volume landmarks are actually published (sets/week, not tonnage)".
- **Secondary-muscle load fraction: 0.5×** — "a secondary-muscle set counts as half a set toward that muscle's weekly volume budget".

A completed (non-skipped), **working** (`role: 'working'`, not `'ramp'`) set contributes:
- `1.0` toward a muscle group the exercise lists as **primary**
- `0.5` toward a muscle group the exercise lists as **secondary**
- `0` toward any other muscle group, and `0` for every set if the exercise log is `skipped`

Ramp sets (`role: 'ramp'`) never contribute, regardless of muscle role — per "APRE ramp sets & volume counting: ramp sets excluded from the weekly volume budget... only true working sets count toward MEV/MAV/MRV." `totalVolumeKg` and `topSet` apply the same working-set-only filter, for consistency.

The function takes the exercise's `primaryMuscles`/`secondaryMuscles` (from `exerciseLibrary.ts`) as parameters rather than looking them up internally — domain functions stay pure, with no I/O or cross-module lookups inside them, per the confirmed functional-core architecture.

### Worked example (mirrored in `workoutLog.test.ts`)

An `ExerciseLog` with 4 completed sets, for an exercise whose `primaryMuscles = ['chest']` and `secondaryMuscles = ['triceps', 'front_delts']`:
- `hardSetCount(log, ['chest'])` → `4 × 1.0 = 4`
- `hardSetCount(log, ['triceps'])` → `4 × 0.5 = 2`
- `hardSetCount(log, ['back'])` → `0` (not targeted at all)

## Total volume (`totalVolumeKg`)

Standard tonnage: `Σ (weightKg × reps)` across all sets in a non-skipped `ExerciseLog`. Not currently used by any locked decision's math (the app deliberately uses set-count landmarks, not tonnage — see above) — provided as a general-purpose stat (e.g. for a future PR-tracking or stats view), not a load-management input.

## Top set (`topSet`)

Returns the set with the highest `weightKg` (ties broken by higher `reps`). This is the anticipated input for the future APRE phase's ramp-set basis — "APRE ramp-set basis: % of last session's working weight" — but that wiring happens in the Phase 3 APRE module, not here; this module only exposes the raw "what was the working weight" query.
