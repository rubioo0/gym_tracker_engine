import * as XLSX from 'xlsx'
import type { CalendarEntryDetail } from '../application/calendarDetail'

const SHEET_NAME = 'Calendar'

const COLUMNS = [
  'date',
  'status',
  'exerciseId',
  'exerciseName',
  'sets',
  'reps',
  'weightKg',
  'perHand',
  'skipped',
] as const

interface ExcelCalendarRow {
  date: string
  status: string
  exerciseId: string
  exerciseName: string
  sets: number | string
  reps: number | string
  weightKg: number | string
  perHand: boolean
  skipped: boolean
}

function entryToRows(entry: CalendarEntryDetail): ExcelCalendarRow[] {
  const status = entry.isProjected ? 'projected' : 'logged'

  if (entry.exercises.length === 0) {
    return [
      { date: entry.date, status, exerciseId: '', exerciseName: '', sets: '', reps: '', weightKg: '', perHand: false, skipped: false },
    ]
  }

  return entry.exercises.map((exercise) => ({
    date: entry.date,
    status,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps ?? '',
    weightKg: exercise.weightKg ?? '',
    perHand: exercise.perHand,
    skipped: exercise.skipped,
  }))
}

/** Engine-shaped equivalent of data/excelCalendarExport.ts (typed to the old tree's fixed-session-count ProgramCalendar) -- one row per exercise per calendar entry. */
export function exportEngineCalendarToExcel(entries: readonly CalendarEntryDetail[]): ArrayBuffer {
  const rows: ExcelCalendarRow[] = entries.flatMap(entryToRows)

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...COLUMNS],
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  }) as ArrayBuffer
}

export function buildEngineCalendarExcelFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `gym-tracker-engine-calendar-${timestamp}.xlsx`
}
