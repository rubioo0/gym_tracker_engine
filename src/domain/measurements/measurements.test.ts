import { describe, expect, it } from 'vitest'
import {
  weighInsToPoints,
  circumferenceMeasurementsToPoints,
  latestMeasurement,
  measurementTrend,
} from './measurements'
import type { CircumferenceMeasurement, WeighIn } from './types'

const ASOF = new Date('2026-08-15T00:00:00.000Z')
function daysAgo(n: number): string {
  return new Date(ASOF.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('weighInsToPoints / circumferenceMeasurementsToPoints', () => {
  it('maps weigh-ins to generic points', () => {
    const weighIns: WeighIn[] = [{ id: '1', date: daysAgo(1), weightKg: 80.5 }]
    expect(weighInsToPoints(weighIns)).toEqual([{ date: daysAgo(1), value: 80.5 }])
  })

  it('filters circumference measurements to one body part', () => {
    const measurements: CircumferenceMeasurement[] = [
      { id: '1', date: daysAgo(1), bodyPart: 'waist', circumferenceCm: 85 },
      { id: '2', date: daysAgo(1), bodyPart: 'bicep', circumferenceCm: 38 },
    ]
    expect(circumferenceMeasurementsToPoints(measurements, 'waist')).toEqual([{ date: daysAgo(1), value: 85 }])
  })
})

describe('latestMeasurement', () => {
  it('returns the most recent point on or before asOf', () => {
    const points = [
      { date: daysAgo(10), value: 82.0 },
      { date: daysAgo(2), value: 81.2 },
    ]
    expect(latestMeasurement(points, ASOF)).toEqual({ date: daysAgo(2), value: 81.2 })
  })

  it('ignores points after asOf (boundary condition)', () => {
    const points = [{ date: daysAgo(-1), value: 99 }] // "tomorrow" relative to ASOF
    expect(latestMeasurement(points, ASOF)).toBeNull()
  })

  it('returns null for no points at all (boundary condition)', () => {
    expect(latestMeasurement([], ASOF)).toBeNull()
  })
})

describe('measurementTrend (worked example from measurements.md)', () => {
  it('computes the change between earliest and latest point in the window', () => {
    const points = [
      { date: daysAgo(10), value: 82.0 },
      { date: daysAgo(2), value: 81.2 },
    ]
    expect(measurementTrend(points, ASOF, 30)).toBeCloseTo(-0.8, 5)
  })

  it('returns null with fewer than 2 points in the window (boundary condition)', () => {
    const points = [{ date: daysAgo(2), value: 81.2 }]
    expect(measurementTrend(points, ASOF, 30)).toBeNull()
  })

  it('excludes points outside the window (boundary condition)', () => {
    const points = [
      { date: daysAgo(60), value: 85.0 }, // outside a 30-day window
      { date: daysAgo(2), value: 81.2 },
    ]
    expect(measurementTrend(points, ASOF, 30)).toBeNull() // only 1 point falls in-window
  })

  it('includes a point exactly at the window boundary (boundary condition)', () => {
    const points = [
      { date: daysAgo(30), value: 82.0 },
      { date: daysAgo(0), value: 81.0 },
    ]
    expect(measurementTrend(points, ASOF, 30)).toBeCloseTo(-1.0, 5)
  })
})
