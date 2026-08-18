# Specialization-block engine — derivation

Source of truth for `specialization.ts`. Implements three locked decisions: rotation via the lagging index, maintenance-volume assignment, and the primary/accessory exercise structure.

## Rotation (`pickNextFocus`)

Per **"Lagging index formula: time since last focus block — whichever muscle has gone longest without being the active focus is suggested next."**

- A muscle that has **never** been focus (`lastFocusEndedAt === null`) is treated as having gone the longest — it outranks every muscle with a real date, no matter how old.
- Among muscles that have all been focus before, the one with the **oldest** `lastFocusEndedAt` wins.
- Injured muscles (per `profile.ts`'s `isMuscleExcluded`) are filtered out by the caller before calling this function — it's given a candidate list, not the full taxonomy, to stay a pure function with no cross-module lookups inside it.
- Ties (identical dates, or multiple never-focused muscles) are broken by **input array order** — a deterministic, if arbitrary, tie-break; real-world exact-timestamp ties are vanishingly unlikely in practice.

This is the auto-suggestion only — per **"engine auto-suggests the next focus... user confirms or overrides"** — the actual UI confirmation step lives in a later phase.

### Worked example (mirrored in `specialization.test.ts`)

Three candidates: `chest` last focused 60 days ago, `back` never focused, `quads` last focused 30 days ago. `pickNextFocus` returns `back` (never-focused beats any real date).

## The "no two majors at once" rule (`violatesMajorPairingRule`)

Per **"never specialize two major muscle groups simultaneously... 'no two majors at once' rule as a hard constraint on any suggestion or manual pick."** The current model only ever has one active focus muscle (see `types.ts`), so this can't fire from `pickNextFocus` alone today — it's provided as a standalone, independently-testable guard for wherever a proposed focus set (whether length 1 or more, if the model is ever extended to allow paired minor-muscle specialization per the cited research) needs validating: `true` if 2 or more of the given muscles are `size: 'large'` in the taxonomy.

## Maintenance-volume assignment (`targetWeeklySets`)

Per **"non-focus muscles get roughly their MV, focus muscle progresses toward MRV."** Directly reads the two fields already defined in `volumeLandmarks.ts`'s `VolumeLandmark`:

```
targetWeeklySets(landmark, isFocus) = isFocus ? landmark.mrv : landmark.mv
```

## Exercise count and primary/accessory structure

Per **"large muscle groups get 2-3 exercises, small muscle groups get 1-2... one compound main lift plus accessories."** `EXERCISE_COUNT_BY_SIZE` picks a single concrete default from each range — the **upper** end (large: 3, small: 2) — so every focus muscle gets at least one accessory beyond its main lift, matching "main lift **plus accessories**" (plural-leaning) rather than the lower end which could leave a small muscle with only its main lift and nothing else.

`selectPrimaryAndAccessories(candidates, size)` picks the **first exercise in the candidate list with `mechanic: 'compound'`** as the primary lift (falling back to the first candidate at all if none are compound), then fills the remaining `EXERCISE_COUNT_BY_SIZE[size] - 1` slots from the rest of the list **in list order**, skipping the chosen primary. This is deliberately simple — **candidate ordering/filtering (by equipment availability, injury exclusion, user preference, etc.) is the caller's job, not this function's**; ranking "which specific compound exercise is best" is Phase 7 (session assembly) territory, not solved here.
