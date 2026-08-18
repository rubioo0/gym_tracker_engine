# Body measurements — derivation

Source of truth for `measurements.ts`. Per the locked decision this is deliberately the simplest domain module in the project: **"flexible cadence, informational only... measurements stay a supporting signal, not a tracked goal or a cross-check on the deficit modifier."** No goal-feasibility math, no algorithm feeds off this data (unlike, say, `goalProjection.ts` or `acwr.ts`) — just display-oriented queries.

## Generic `MeasurementPoint`

Both `WeighIn` (a single weight series) and `CircumferenceMeasurement` (one series *per body part*, since waist/chest/bicep/etc. are independent trends) are mapped down to a shared `{ date, value }` shape before being queried, so `latestMeasurement`/`measurementTrend` are written once instead of duplicated per measurement kind. `weighInsToPoints`/`circumferenceMeasurementsToPoints` do that mapping (the latter also filters to one body part, since mixing waist and bicep numbers into one trend would be meaningless).

## `latestMeasurement`

The most recent point on or before `asOf`. `null` if there are no points at or before that date.

## `measurementTrend`

Change in value between the earliest and latest point within a trailing window (`asOf - windowDays` through `asOf`, inclusive both ends). Requires at least 2 points in the window to be meaningful — `null` otherwise (matches the "informational, not a hard input" spirit: no invented trend from a single data point).

### Worked example (mirrored in `measurements.test.ts`)

Weigh-ins at 82.0kg (10 days ago) and 81.2kg (2 days ago), 30-day window, `asOf` today: `measurementTrend` returns `81.2 - 82.0 = -0.8` (i.e. down 0.8kg over the window) — negative meaning weight loss, positive meaning gain, by plain subtraction (no unit-per-week normalization; the trend is "how much changed within this window," not a rate).
