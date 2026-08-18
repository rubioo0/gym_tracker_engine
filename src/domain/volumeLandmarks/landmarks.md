# Volume landmarks — derivation

Per-muscle weekly hard-set budgets (MV/MEV/MAV/MRV), per Dr. Mike Israetel / Renaissance Periodization's Volume Landmarks framework:

- **MV** (Maintenance Volume) — minimum weekly sets to hold onto current size. Used for non-focus muscles during a specialization block.
- **MEV** (Minimum Effective Volume) — minimum weekly sets that actually drives growth.
- **MAV** (Maximum Adaptive Volume) — the range where most of the growth happens; published as a range (`mavLow`–`mavHigh`), not a single number.
- **MRV** (Maximum Recoverable Volume) — upper ceiling before returns flatten/reverse; the specialization-focus muscle progresses toward this.

## Sourcing honesty (important — do not treat all 17 rows as equally sourced)

RP's own published tables give concrete figures for the major, commonly-programmed groups: chest, back, quads, hamstrings, glutes, front/rear delts, traps, biceps, triceps, calves, abs, forearms. Those 13 rows below are modeled on commonly-cited RP figures with reasonable confidence.

**Four rows — `obliques`, `adductors`, `abductors`, `neck` — do NOT have a standard published RP landmark entry.** RP's hypertrophy guides don't typically program these as standalone targets (obliques get incidental work from ab training; adductors/abductors from compound lower-body work; neck is rarely a dedicated hypertrophy target). Their figures here are conservative estimates modeled on similar small-muscle-group magnitudes (traps/forearms), explicitly flagged in code as `sourceConfidence: 'estimated'` rather than `'published'`. **Do not treat these four as verified research figures** — they're placeholders until better sourcing exists or real usage data suggests better numbers.

## Derived caps (session/monthly from weekly)

Per the locked "one weekly number" decision: session cap = weekly ÷ planned frequency (sets/week ÷ sessions/week that muscle is trained); monthly cap ≈ weekly × (52/12 ≈ 4.33). Simple arithmetic, no separate numbers to maintain.

## Worked example (mirrored in `landmarks.test.ts`)

Chest: `mev=8, mavLow=12, mavHigh=20, mrv=22` (weekly sets). If chest is trained 2x/week: `sessionCap(chest, 2) = weeklyCapForPhase(chest) / 2`. Using MRV as the phase's weekly figure (22 sets/week, focus-muscle scenario): `22 / 2 = 11` sets/session. Monthly: `22 * (52/12) ≈ 95.3` sets/month.
