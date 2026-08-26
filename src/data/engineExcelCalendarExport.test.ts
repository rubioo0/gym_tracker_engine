import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { exportEngineCalendarToExcel, buildEngineCalendarExcelFileName } from './engineExcelCalendarExport'
import type { CalendarEntryDetail } from '../application/calendarDetail'

function readRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

describe('exportEngineCalendarToExcel', () => {
  it('writes one row per exercise, tagged with the entry status', () => {
    const entries: CalendarEntryDetail[] = [
      {
        date: '2026-08-05',
        isProjected: false,
        workoutLogId: 'w1',
        exercises: [
          { exerciseId: 'Barbell_Curl', name: 'Barbell Curl', sets: 3, reps: 6, weightKg: 22.5, perHand: false, skipped: false },
        ],
      },
      {
        date: '2026-08-10',
        isProjected: true,
        exercises: [
          { exerciseId: 'Alternate_Hammer_Curl', name: 'Alternate Hammer Curl', sets: 3, reps: 10, weightKg: 12, perHand: true, skipped: false },
        ],
      },
    ]

    const rows = readRows(exportEngineCalendarToExcel(entries))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-08-05', status: 'logged', exerciseId: 'Barbell_Curl', weightKg: 22.5 })
    expect(rows[1]).toMatchObject({ date: '2026-08-10', status: 'projected', exerciseId: 'Alternate_Hammer_Curl', perHand: true })
  })

  it('writes a single blank-exercise row for an entry with no exercise detail (boundary condition)', () => {
    const entries: CalendarEntryDetail[] = [{ date: '2026-08-05', isProjected: true, exercises: [] }]
    const rows = readRows(exportEngineCalendarToExcel(entries))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ date: '2026-08-05', status: 'projected', exerciseId: '' })
  })

  it('is empty for no entries at all (boundary condition)', () => {
    expect(readRows(exportEngineCalendarToExcel([]))).toHaveLength(0)
  })
})

describe('buildEngineCalendarExcelFileName', () => {
  it('produces a .xlsx filename with a timestamp', () => {
    expect(buildEngineCalendarExcelFileName()).toMatch(/^gym-tracker-engine-calendar-.+\.xlsx$/)
  })
})
