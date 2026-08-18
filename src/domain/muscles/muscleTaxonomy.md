# Muscle taxonomy — derivation

Source of truth for `muscleTaxonomy.ts`. See plan doc (`here-are-some-of-tranquil-willow.md`) "Decisions locked" for the full discussion; this file is the per-module derivation note referenced by that plan's testing strategy.

## Why these 17 groups, at this granularity

Consumer-level granularity was chosen deliberately over anatomical detail (individual heads of triceps/biceps, lats vs. rhomboids vs. traps as separate entries): no visualization library or exercise dataset reliably supports finer resolution, and most exercises don't have real per-sub-muscle data anyway — finer tags would be invented precision, not sourced fact.

The 17 groups are the union of:
- `react-body-highlighter`'s supported set (trapezius, chest, biceps, triceps, forearm, front-deltoids, back-deltoids, abs, obliques, adductors, hamstrings, quadriceps, abductors, calves, gluteal, neck) — chosen so the future body-heatmap visualization (a later phase) can render directly against this taxonomy with no translation layer.
- `back` added explicitly — surprisingly absent from the highlighter's own list, but essential; free-exercise-db and every real exercise dataset tag lats/back separately from traps.
- `head` dropped — not a trainable muscle group for this app's purposes.

## Two-tier extensibility

Each entry can carry an optional `detail?: string[]` field for future sub-muscle tags (e.g. `back` → `['lats', 'rhomboids', 'lower-back']`) without breaking anything that only reads the top-level `id`. Not populated in v1 — this is the hook, not the implementation, per the "simple now, expandable later" design decision.

## Size tier

Each group carries `size: 'large' | 'small'`, used by the exercise-count-per-muscle decision (large muscles get 2-3 exercises per session, small muscles get 1-2) and by volume-landmark magnitude expectations (large muscles tolerate more weekly sets). Assignment follows standard program-design convention (chest/back/quads/hamstrings/glutes = large; everything else = small) — see plan doc topic 11 research findings.

## Worked example (mirrored in `muscleTaxonomy.test.ts`)

`MUSCLE_GROUPS` has exactly 17 entries, no duplicate `id`s, and `chest` / `back` / `quads` / `hamstrings` / `glutes` are the only `size: 'large'` entries — everything else is `size: 'small'`.
