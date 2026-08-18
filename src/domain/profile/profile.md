# User profile — derivation

Source of truth for `profile.ts`. Mostly a data container (see `types.ts`); the two functions here are the only real logic.

## Injury exclusion (`isMuscleExcluded`)

Direct implementation of the locked decision: **"Fitbod-style binary toggle — mark a muscle injured, it's fully excluded from generated workouts, manually un-marked once healed. No severity grading, no auto-expiry."** `isMuscleExcluded` is a plain membership check against `profile.injuredMuscles` — no time-based logic, no partial/intensity-limited exclusion. Ships with a UI-level "not medical advice, consult a professional" disclaimer (not this module's concern — that's copy, not logic).

## Deficit rate modifier (`deficitRateModifier`)

Implements: **"Nutrition/deficit tracking: revises the earlier 'stored only' decision specifically for deficit magnitude — a rough caloric-deficit estimate... used as a modifier on progression-projection expectations, since research found deficit size... has a real, literature-backed effect on expected strength progress."**

The underlying research (plan doc, topic 7): a moderate deficit (~300-500 kcal/day) still allows real strength progress; deficits beyond ~500 kcal/day measurably blunt gains. This module doesn't track actual calories (per the "simple label, not a number" decision) — it maps the three labels to a progression-rate multiplier:

```
notDieting   -> 1.0   (no adjustment — maintenance or surplus, expectations unaffected)
smallDeficit -> 0.85  (moderate deficit — research says still allows real progress, mild softening)
bigDeficit   -> 0.5   (aggressive deficit — research says measurably blunts gains, larger softening)
```

**Honesty note**: these exact multiplier values are the project's own reasonable estimates, not numbers pulled directly from a study — the cited research establishes the qualitative effect (moderate deficit ≈ fine, large deficit ≈ meaningfully slower) but not a precise multiplier. Flagged the same way volume-landmark "estimated" rows and the goal-projection default rates are: usable now, tunable later once there's real usage data to check them against.

### Worked example (mirrored in `profile.test.ts`)

An observed/assumed rate of `1.0` kg/week under `bigDeficit` becomes `1.0 * 0.5 = 0.5` kg/week for projection purposes — the goal-projection module (`goalProjection.ts`) is expected to apply this multiplier to whatever rate it's using, not compute it itself.
