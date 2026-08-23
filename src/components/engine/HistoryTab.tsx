import { useEngineState } from './useEngineState'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'

/** Історія, rebuilt on the engine's own workoutLogs (per-set, not a single actualWeight), reusing the old History tab's list/row CSS. */
export function HistoryTab() {
  const { state, loaded } = useEngineState()

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

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>History</h2>
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
                  {log.exerciseLogs.map((exerciseLog) => (
                    <div key={exerciseLog.exerciseId} className="history-row">
                      <span>{getExerciseById(exerciseLog.exerciseId)?.nameEn ?? exerciseLog.exerciseId}</span>
                      <span>
                        {exerciseLog.skipped
                          ? 'skipped'
                          : exerciseLog.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ') || 'no sets'}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
