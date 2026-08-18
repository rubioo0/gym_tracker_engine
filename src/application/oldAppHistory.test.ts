import { describe, expect, it } from 'vitest'
import { suggestStartingWeightFromOldApp } from './oldAppHistory'
import type { WorkoutLog } from '../domain/types'

function log(completedAt: string, exerciseName: string, actualWeight: number | undefined, weightUnit?: string): WorkoutLog {
  return {
    id: completedAt,
    runId: 'r1',
    templateId: 't1',
    sessionId: 's1',
    sessionName: 'Session',
    track: 'upper',
    completedAt,
    successful: true,
    exerciseLogs: [{ exerciseId: 'e1', exerciseName, completed: true, skipped: false, actualWeight, weightUnit }],
    optionalActivities: [],
  }
}

describe('suggestStartingWeightFromOldApp', () => {
  it('returns null when the exercise has no old-app alias at all', () => {
    expect(suggestStartingWeightFromOldApp([], 'not-a-real-id')).toBeNull()
  })

  it('returns null when the exercise has an alias but no matching logs exist', () => {
    expect(suggestStartingWeightFromOldApp([log('2026-01-01T00:00:00.000Z', 'Some Other Exercise', 50)], 'Barbell_Curl')).toBeNull()
  })

  it('returns the most recent logged weight for the aliased exercise name', () => {
    const logs = [
      log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 30),
      log('2026-02-01T00:00:00.000Z', 'Barbell Curl', 35),
    ]
    expect(suggestStartingWeightFromOldApp(logs, 'Barbell_Curl')).toBe(35)
  })

  it('ignores entries with no actualWeight (skipped exercises)', () => {
    const logs = [
      log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 30),
      log('2026-02-01T00:00:00.000Z', 'Barbell Curl', undefined),
    ]
    expect(suggestStartingWeightFromOldApp(logs, 'Barbell_Curl')).toBe(30)
  })

  it('converts lbs logs to kg', () => {
    const logs = [log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 100, 'lbs')]
    const result = suggestStartingWeightFromOldApp(logs, 'Barbell_Curl')
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(45.359237, 5)
  })

  it('treats a missing weightUnit as kg (boundary condition — matches old app convention)', () => {
    const logs = [log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 40, undefined)]
    expect(suggestStartingWeightFromOldApp(logs, 'Barbell_Curl')).toBe(40)
  })

  it('exactly-equal completedAt timestamps do not throw and resolve to one of the matches (boundary condition)', () => {
    const logs = [
      log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 30),
      log('2026-01-01T00:00:00.000Z', 'Barbell Curl', 32),
    ]
    expect(suggestStartingWeightFromOldApp(logs, 'Barbell_Curl')).not.toBeNull()
  })
})
