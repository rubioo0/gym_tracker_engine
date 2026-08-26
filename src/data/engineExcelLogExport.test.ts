import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { exportEngineWorkoutLogsToExcel, buildEngineExcelLogFileName } from './engineExcelLogExport'
import type { WorkoutLog } from '../domain/workoutLog/types'

function readRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

describe('exportEngineWorkoutLogsToExcel', () => {
  it('writes one row per set, across exercises and logs', () => {
    const logs: WorkoutLog[] = [
      {
        id: 'log-1',
        completedAt: '2026-08-20T10:00:00.000Z',
        successful: true,
        note: 'Great session',
        exerciseLogs: [
          {
            exerciseId: 'Barbell_Curl',
            skipped: false,
            difficulty: 'okay',
            sets: [
              { weightKg: 20, reps: 5, role: 'ramp' },
              { weightKg: 30, reps: 5, role: 'working' },
              { weightKg: 30, reps: 5, role: 'working' },
            ],
          },
        ],
      },
    ]

    const rows = readRows(exportEngineWorkoutLogsToExcel(logs))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      logId: 'log-1',
      completedAt: '2026-08-20T10:00:00.000Z',
      successful: true,
      sessionNote: 'Great session',
      exerciseId: 'Barbell_Curl',
      setIndex: 1,
      role: 'ramp',
      weightKg: 20,
      reps: 5,
    })
    expect(rows[2]).toMatchObject({ setIndex: 3, role: 'working', weightKg: 30, reps: 5 })
  })

  it('resolves the exercise name from the library', () => {
    const logs: WorkoutLog[] = [
      {
        id: 'log-1',
        completedAt: '2026-08-20T10:00:00.000Z',
        successful: true,
        exerciseLogs: [
          { exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: 5, role: 'working' }] },
        ],
      },
    ]
    const rows = readRows(exportEngineWorkoutLogsToExcel(logs))
    expect(rows[0].exerciseName).toBe('Barbell Curl')
  })

  it('writes a single blank-set row for a skipped exercise', () => {
    const logs: WorkoutLog[] = [
      {
        id: 'log-1',
        completedAt: '2026-08-20T10:00:00.000Z',
        successful: true,
        exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: true, sets: [] }],
      },
    ]
    const rows = readRows(exportEngineWorkoutLogsToExcel(logs))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ exerciseId: 'Barbell_Curl', skipped: true, role: '' })
  })

  it('writes a single row for a log with no exercises at all (boundary condition)', () => {
    const logs: WorkoutLog[] = [{ id: 'log-empty', completedAt: '2026-08-20T10:00:00.000Z', successful: true, exerciseLogs: [] }]
    const rows = readRows(exportEngineWorkoutLogsToExcel(logs))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ logId: 'log-empty' })
  })

  it('is empty for no logs at all (boundary condition)', () => {
    expect(readRows(exportEngineWorkoutLogsToExcel([]))).toHaveLength(0)
  })
})

describe('buildEngineExcelLogFileName', () => {
  it('produces a .xlsx filename with a timestamp', () => {
    expect(buildEngineExcelLogFileName()).toMatch(/^gym-tracker-engine-logs-.+\.xlsx$/)
  })
})
