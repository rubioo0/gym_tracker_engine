import * as XLSX from 'xlsx'
import type { WorkoutLog } from '../domain/workoutLog/types'
import { getExerciseById } from '../domain/exerciseLibrary/exerciseLibrary'

const SHEET_NAME = 'Workout Logs'

const COLUMNS = [
  'logId',
  'completedAt',
  'successful',
  'sessionNote',
  'exerciseId',
  'exerciseName',
  'skipped',
  'difficulty',
  'exerciseNote',
  'setIndex',
  'role',
  'weightKg',
  'reps',
] as const

interface ExcelLogRow {
  logId: string
  completedAt: string
  successful: boolean
  sessionNote: string
  exerciseId: string
  exerciseName: string
  skipped: boolean
  difficulty: string
  exerciseNote: string
  setIndex: number | string
  role: string
  weightKg: number | string
  reps: number | string
}

/**
 * Engine-shaped equivalent of data/excelLogExport.ts (which is typed to the
 * old app's one-actual-weight-per-exercise WorkoutLog) — the engine's
 * WorkoutLog carries a full per-set breakdown (ramp + working, weightKg +
 * reps each), so one row per set rather than one row per exercise.
 */
function workoutLogToRows(log: WorkoutLog): ExcelLogRow[] {
  if (log.exerciseLogs.length === 0) {
    return [
      {
        logId: log.id,
        completedAt: log.completedAt,
        successful: log.successful,
        sessionNote: log.note ?? '',
        exerciseId: '',
        exerciseName: '',
        skipped: false,
        difficulty: '',
        exerciseNote: '',
        setIndex: '',
        role: '',
        weightKg: '',
        reps: '',
      },
    ]
  }

  return log.exerciseLogs.flatMap((exerciseLog): ExcelLogRow[] => {
    const exerciseName = getExerciseById(exerciseLog.exerciseId)?.nameEn ?? exerciseLog.exerciseId

    if (exerciseLog.skipped || exerciseLog.sets.length === 0) {
      return [
        {
          logId: log.id,
          completedAt: log.completedAt,
          successful: log.successful,
          sessionNote: log.note ?? '',
          exerciseId: exerciseLog.exerciseId,
          exerciseName,
          skipped: exerciseLog.skipped,
          difficulty: exerciseLog.difficulty ?? '',
          exerciseNote: exerciseLog.note ?? '',
          setIndex: '',
          role: '',
          weightKg: '',
          reps: '',
        },
      ]
    }

    return exerciseLog.sets.map((set, setIndex) => ({
      logId: log.id,
      completedAt: log.completedAt,
      successful: log.successful,
      sessionNote: log.note ?? '',
      exerciseId: exerciseLog.exerciseId,
      exerciseName,
      skipped: exerciseLog.skipped,
      difficulty: exerciseLog.difficulty ?? '',
      exerciseNote: exerciseLog.note ?? '',
      setIndex: setIndex + 1,
      role: set.role,
      weightKg: set.weightKg,
      reps: set.reps,
    }))
  })
}

export function exportEngineWorkoutLogsToExcel(logs: readonly WorkoutLog[]): ArrayBuffer {
  const rows: ExcelLogRow[] = logs.flatMap(workoutLogToRows)

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

export function buildEngineExcelLogFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `gym-tracker-engine-logs-${timestamp}.xlsx`
}
