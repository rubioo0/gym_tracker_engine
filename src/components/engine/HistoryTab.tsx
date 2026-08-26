import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getExerciseById, isPerHandEquipment } from '../../domain/exerciseLibrary/exerciseLibrary'
import { exportEngineWorkoutLogsToExcel, buildEngineExcelLogFileName } from '../../data/engineExcelLogExport'

/** Історія, rebuilt on the engine's own workoutLogs (per-set, not a single actualWeight), reusing the old History tab's list/row CSS. */
export function HistoryTab() {
  const { state, loaded } = useEngineState()
  const [exportMessage, setExportMessage] = useState('')

  if (!loaded) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="muted">Loading…</p>
        </article>
      </section>
    )
  }

  const logsNewestFirst = state.workoutLogs.slice().reverse()

  function handleExportExcel(): void {
    if (state.workoutLogs.length === 0) {
      setExportMessage('No logs to export.')
      return
    }

    try {
      const buffer = exportEngineWorkoutLogsToExcel(state.workoutLogs)
      const fileName = buildEngineExcelLogFileName()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setExportMessage(`Exported ${state.workoutLogs.length} workout log(s) to ${fileName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.'
      setExportMessage(`Excel export failed: ${message}`)
    }
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>History</h2>
        <div className="action-row">
          <button type="button" onClick={handleExportExcel} disabled={state.workoutLogs.length === 0}>
            Export Logs to Excel ({state.workoutLogs.length})
          </button>
        </div>
        {exportMessage ? <p className="note">{exportMessage}</p> : null}
        {logsNewestFirst.length === 0 ? (
          <p>No logs yet.</p>
        ) : (
          <ul className="list-plain">
            {logsNewestFirst.map((log) => (
              <li key={log.id} className="item-row item-row-stack">
                <div>
                  <strong>{new Date(log.completedAt).toLocaleString()}</strong>
                  <div className="muted">{log.successful ? 'Successful' : 'Not successful'}</div>
                  {log.note ? <div className="note">{log.note}</div> : null}
                </div>

                <div className="history-exercises">
                  {log.exerciseLogs.map((exerciseLog) => {
                    const exercise = getExerciseById(exerciseLog.exerciseId)
                    const perHand = exercise ? isPerHandEquipment(exercise) : false
                    return (
                      <div key={exerciseLog.exerciseId} className="history-row">
                        <span>{exercise?.nameEn ?? exerciseLog.exerciseId}</span>
                        <span>
                          {exerciseLog.skipped
                            ? 'skipped'
                            : exerciseLog.sets.map((s) => `${s.weightKg}kg${perHand ? '/hand' : ''}×${s.reps}`).join(', ') || 'no sets'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
