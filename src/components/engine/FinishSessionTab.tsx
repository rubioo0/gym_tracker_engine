import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
import type { ExerciseDifficulty, SetEntry, WorkoutLog } from '../../domain/workoutLog/types'
import type { DraftExerciseLog } from '../../application/state'

/**
 * The other half of the merged flow: "План сесії" assembles + starts a
 * draft session (application/sessionPrescription.ts prefills weights via
 * APRE/repeat-last-weight), this tab lets you edit what you actually did
 * per set and finish it — same interaction shape as the old app's Log tab
 * (per-exercise card, skip toggle, difficulty), reusing its
 * .log-exercise-card/.log-checkbox-field/.log-input-grid classes, but
 * writing into the new engine's own WorkoutLog model instead of the old
 * app's plannedSession-based one.
 */
export function FinishSessionTab() {
  const { state, dispatch, loaded } = useEngineState()
  const [successful, setSuccessful] = useState(true)
  const [note, setNote] = useState('')

  if (!loaded) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="muted">Loading…</p>
        </article>
      </section>
    )
  }

  const draft = state.draftSession
  if (!draft) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>No workout in progress.</p>
          <p className="muted">Start one from the План сесії tab.</p>
        </article>
      </section>
    )
  }

  function findLog(exerciseId: string): DraftExerciseLog | undefined {
    return draft!.exerciseLogs.find((l) => l.exerciseId === exerciseId)
  }

  function updateSet(exerciseId: string, setIndex: number, patch: Partial<SetEntry>) {
    const log = findLog(exerciseId)
    if (!log) return
    const sets = log.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s))
    dispatch({ type: 'UPDATE_DRAFT_EXERCISE_LOG', exerciseId, exerciseLog: { ...log, sets } })
  }

  function toggleSkipped(exerciseId: string, skipped: boolean) {
    const log = findLog(exerciseId)
    if (!log) return
    dispatch({ type: 'UPDATE_DRAFT_EXERCISE_LOG', exerciseId, exerciseLog: { ...log, skipped } })
  }

  function setDifficulty(exerciseId: string, difficulty: ExerciseDifficulty | undefined) {
    const log = findLog(exerciseId)
    if (!log) return
    dispatch({ type: 'UPDATE_DRAFT_EXERCISE_LOG', exerciseId, exerciseLog: { ...log, difficulty } })
  }

  function finish() {
    const workoutLog: WorkoutLog = {
      id: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      successful,
      note: note || undefined,
      exerciseLogs: draft!.exerciseLogs,
    }
    dispatch({ type: 'FINISH_DRAFT_SESSION', workoutLog })
  }

  function discard() {
    if (window.confirm('Discard this workout without saving it?')) {
      dispatch({ type: 'DISCARD_DRAFT_SESSION' })
    }
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Завершити тренування</h2>
        <p className="muted">
          Started {new Date(draft.startedAt).toLocaleString()} — focus: {draft.focusMuscle}
        </p>

        {draft.exerciseLogs.map((log) => {
          const exercise = getExerciseById(log.exerciseId)
          return (
            <article key={log.exerciseId} className="log-exercise-card">
              <h3>{exercise?.nameEn ?? log.exerciseId}</h3>

              <label className="log-checkbox-field">
                Skip this exercise
                <input
                  type="checkbox"
                  checked={log.skipped}
                  onChange={(e) => toggleSkipped(log.exerciseId, e.target.checked)}
                />
              </label>

              {!log.skipped && (
                <>
                  {log.sets.map((set, i) => (
                    <div key={i} className="log-input-grid">
                      <label className="stacked-field">
                        {set.role === 'ramp' ? `Ramp set ${i + 1} — weight (kg)` : `Set ${i + 1} — weight (kg)`}
                        <input
                          type="number"
                          value={set.weightKg}
                          onChange={(e) => updateSet(log.exerciseId, i, { weightKg: Number(e.target.value) })}
                        />
                      </label>
                      <label className="stacked-field">
                        Reps
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => updateSet(log.exerciseId, i, { reps: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                  ))}
                  <label className="stacked-field">
                    Difficulty
                    <select
                      value={log.difficulty ?? ''}
                      onChange={(e) =>
                        setDifficulty(log.exerciseId, e.target.value === '' ? undefined : (e.target.value as ExerciseDifficulty))
                      }
                    >
                      <option value="">-</option>
                      <option value="easy">easy</option>
                      <option value="okay">okay</option>
                      <option value="hard">hard</option>
                    </select>
                  </label>
                </>
              )}
            </article>
          )
        })}

        <label className="log-checkbox-field">
          Session successful
          <input type="checkbox" checked={successful} onChange={(e) => setSuccessful(e.target.checked)} />
        </label>
        <label className="stacked-field">
          Note
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="action-row">
          <button type="button" onClick={finish}>
            Завершити тренування
          </button>
          <button type="button" onClick={discard}>
            Скасувати
          </button>
        </div>
      </article>
    </section>
  )
}
