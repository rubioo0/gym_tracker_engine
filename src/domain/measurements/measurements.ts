import type { BodyPart, CircumferenceMeasurement, WeighIn } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface MeasurementPoint {
  date: string
  value: number
}

export function weighInsToPoints(weighIns: readonly WeighIn[]): MeasurementPoint[] {
  return weighIns.map((w) => ({ date: w.date, value: w.weightKg }))
}

/** Filters to one body part, since mixing e.g. waist and bicep numbers into one trend would be meaningless. */
export function circumferenceMeasurementsToPoints(
  measurements: readonly CircumferenceMeasurement[],
  bodyPart: BodyPart,
): MeasurementPoint[] {
  return measurements.filter((m) => m.bodyPart === bodyPart).map((m) => ({ date: m.date, value: m.circumferenceCm }))
}

/** Most recent point on or before `asOf`. See measurements.md. */
export function latestMeasurement(points: readonly MeasurementPoint[], asOf: Date): MeasurementPoint | null {
  const upToAsOf = points.filter((p) => new Date(p.date).getTime() <= asOf.getTime())
  if (upToAsOf.length === 0) return null
  return upToAsOf.reduce((latest, p) => (new Date(p.date).getTime() > new Date(latest.date).getTime() ? p : latest))
}

/**
 * Change in value between the earliest and latest point within the
 * trailing window. Requires >= 2 points in the window — null otherwise.
 * See measurements.md worked example.
 */
export function measurementTrend(
  points: readonly MeasurementPoint[],
  asOf: Date,
  windowDays: number,
): number | null {
  const windowStartMs = asOf.getTime() - windowDays * MS_PER_DAY
  const inWindow = points.filter((p) => {
    const t = new Date(p.date).getTime()
    return t >= windowStartMs && t <= asOf.getTime()
  })
  if (inWindow.length < 2) return null
  const sorted = [...inWindow].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return sorted[sorted.length - 1].value - sorted[0].value
}
