import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { assembleTodaysSession } from '../../application/sessionOrchestration'
import { prescribeSession, mostRecentTopSet, shouldDeloadGoalExercise } from '../../application/sessionPrescription'
import { recentExerciseHistory } from '../../application/exerciseHistory'
import { getExerciseById, isPerHandEquipment } from '../../domain/exerciseLibrary/exerciseLibrary'
import type { ExerciseDifficulty, SetEntry, WorkoutLog } from '../../domain/workoutLog/types'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Your goal’s deadline has passed.',
  targetMet: 'You hit your target!',
  focusMuscleInjured: 'Your focus muscle is marked as injured.',
}

/**
 * A generous fixed time budget for the logging screen only, so nothing
 * gets time-cut here regardless of whatever was picked minutes earlier on
 * План сесії — showing the fuller candidate list and letting the user mark
 * unused exercises "skip" is more forgiving than risking a mismatch. The
 * old app's own Log tab never had a time-budget concept to reconcile in
 * the first place (see reducer.ts's logSession — no cutting logic at all).
 */
const GENEROUS_MINUTES_FOR_LOGGING = 240

interface EditableExerciseLog {
  exerciseId: string
  sets: SetEntry[]
  skipped: boolean
  difficulty?: ExerciseDifficulty
}

/**
 * Independently recomputes today's plan every render (same guard chain and
 * same assembleTodaysSession call as TodayTab) and holds in-progress edits
 * in ordinary component state — exactly like the old app's Log tab held
 * exerciseInputs locally in App.tsx, never in the persisted reducer state.
 * Nothing here can leave the user "stuck": closing the tab mid-edit just
 * drops the unsaved local state, and reopening gives a fresh form seeded
 * from the current prescription again.
 */
export function FinishSessionTab() {
  const { state, dispatch, loaded } = useEngineState()
  const [noGymToday, setNoGymToday] = useState(false)
  const [successful, setSuccessful] = useState(true)
  const [note, setNote] = useState('')
  const [edits, setEdits] = useState<EditableExerciseLog[] | null>(null)
  const [justFinished, setJustFinished] = useState(false)

  if (!loaded) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="muted">Loading…</p>
        </article>
      </section>
    )
  }
  if (!state.profile) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>Set up your profile first, on the Setup tab.</p>
        </article>
      </section>
    )
  }

  const active = getActiveGoalAndBlock(state)
  if (!active) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>No active goal yet. Create one on the Setup tab to start training.</p>
        </article>
      </section>
    )
  }

  const blockWorkoutLogs = workoutLogsInBlock(state.workoutLogs, active.block)
  const currentWeightKg = mostRecentTopSet(blockWorkoutLogs, active.goal.exerciseId)?.weightKg ?? null
  const renewalReason = checkGoalNeedsRenewal(active.goal, active.block, state.profile, currentWeightKg, new Date())
  if (renewalReason) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="note">{RENEWAL_MESSAGES[renewalReason]}</p>
          <p className="muted">Set your next goal on the Setup tab.</p>
        </article>
      </section>
    )
  }

  // Prefer whatever the user already confirmed on "План сесії" — same plan,
  // logged against, no risk of drifting from what they actually saw there.
  // Falls back to a generous default (+ its own editable checkbox below)
  // only when they came here without ever visiting that tab first.
  const effectiveNoGymToday = state.confirmedSessionInputs?.noGymToday ?? noGymToday
  const effectiveAvailableMinutes = state.confirmedSessionInputs?.availableMinutes ?? GENEROUS_MINUTES_FOR_LOGGING

  const completedSessionsInBlock = countSessionsInBlock(state.workoutLogs, active.block)
  const slots = assembleTodaysSession({
    focusMuscle: active.block.focusMuscle,
    goalExerciseId: active.goal.exerciseId,
    injuredMuscles: state.profile.injuredMuscles,
    sessionsPerWeek: state.profile.sessionsPerWeek,
    completedSessionsInBlock,
    noGymToday: effectiveNoGymToday,
    availableMinutes: effectiveAvailableMinutes,
  })

  const deloadGoalExercise = shouldDeloadGoalExercise(state.workoutLogs, blockWorkoutLogs, active.block.focusMuscle, active.goal)

  function seedEdits(): EditableExerciseLog[] {
    const prescriptions = prescribeSession(slots, active!.goal, blockWorkoutLogs, { deloadGoalExercise })
    return prescriptions.map((p) => ({
      exerciseId: p.exerciseId,
      skipped: false,
      sets: p.sets.map((s) => ({ weightKg: s.weightKg, reps: s.targetReps, role: s.role })),
    }))
  }

  const currentEdits = edits ?? seedEdits()

  function updateExercise(exerciseId: string, patch: Partial<EditableExerciseLog>) {
    setEdits(currentEdits.map((log) => (log.exerciseId === exerciseId ? { ...log, ...patch } : log)))
  }

  function updateSet(exerciseId: string, setIndex: number, patch: Partial<SetEntry>) {
    const log = currentEdits.find((l) => l.exerciseId === exerciseId)
    if (!log) return
    updateExercise(exerciseId, { sets: log.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) })
  }

  function finish() {
    const workoutLog: WorkoutLog = {
      id: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      successful,
      note: note || undefined,
      exerciseLogs: currentEdits,
    }
    dispatch({ type: 'LOG_WORKOUT', workoutLog })
    setEdits(null)
    setSuccessful(true)
    setNote('')
    setJustFinished(true)
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Завершити тренування</h2>
        {justFinished ? <p className="note">Workout saved. Logging a fresh one below.</p> : null}
        {deloadGoalExercise ? (
          <p className="note">
            ⚠️ Deload suggested for your goal exercise — overloaded (ACWR) or stalled for 2+ sessions. Progression is
            paused this session; consider reducing the weight yourself if it still feels heavy.
          </p>
        ) : null}
        <p className="muted">Focus: {active.block.focusMuscle}</p>

        {state.confirmedSessionInputs ? (
          <p className="muted">Using today's plan from План сесії ({effectiveAvailableMinutes} min{effectiveNoGymToday ? ', no gym' : ''}).</p>
        ) : (
          <label className="log-checkbox-field inline-field">
            No gym today
            <input
              type="checkbox"
              checked={noGymToday}
              onChange={(e) => {
                setNoGymToday(e.target.checked)
                setEdits(null)
                setJustFinished(false)
              }}
            />
          </label>
        )}

        {currentEdits.map((log) => {
          const exercise = getExerciseById(log.exerciseId)
          const history = recentExerciseHistory(state.workoutLogs, log.exerciseId, 3)
          return (
            <article key={log.exerciseId} className="log-exercise-card">
              <h3>{exercise?.nameEn ?? log.exerciseId}</h3>
              {history.length > 0 ? (
                <div className="exercise-card-history">
                  {history.map((entry) => (
                    <span key={entry.completedAt} className="exercise-history-chip">
                      {entry.weightKg}kg{exercise && isPerHandEquipment(exercise) ? '/hand' : ''}×{entry.reps} ({entry.completedAt.slice(0, 10)})
                    </span>
                  ))}
                </div>
              ) : null}

              <label className="log-checkbox-field">
                Skip this exercise
                <input
                  type="checkbox"
                  checked={log.skipped}
                  onChange={(e) => {
                    setJustFinished(false)
                    updateExercise(log.exerciseId, { skipped: e.target.checked })
                  }}
                />
              </label>

              {!log.skipped && (
                <>
                  {log.sets.map((set, i) => (
                    <div key={i} className="log-input-grid">
                      <label className="stacked-field">
                        {(() => {
                          const unit = exercise && isPerHandEquipment(exercise) ? 'kg per hand' : 'kg'
                          return set.role === 'ramp' ? `Ramp set ${i + 1} — weight (${unit})` : `Set ${i + 1} — weight (${unit})`
                        })()}
                        <input
                          type="number"
                          value={set.weightKg}
                          onChange={(e) => {
                            setJustFinished(false)
                            updateSet(log.exerciseId, i, { weightKg: Number(e.target.value) })
                          }}
                        />
                      </label>
                      <label className="stacked-field">
                        Reps
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => {
                            setJustFinished(false)
                            updateSet(log.exerciseId, i, { reps: Number(e.target.value) })
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <label className="stacked-field">
                    Difficulty
                    <select
                      value={log.difficulty ?? ''}
                      onChange={(e) => {
                        setJustFinished(false)
                        updateExercise(log.exerciseId, {
                          difficulty: e.target.value === '' ? undefined : (e.target.value as ExerciseDifficulty),
                        })
                      }}
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
          <input
            type="checkbox"
            checked={successful}
            onChange={(e) => {
              setJustFinished(false)
              setSuccessful(e.target.checked)
            }}
          />
        </label>
        <label className="stacked-field">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setJustFinished(false)
              setNote(e.target.value)
            }}
          />
        </label>

        <div className="action-row">
          <button type="button" onClick={finish}>
            Завершити тренування
          </button>
        </div>
      </article>
    </section>
  )
}
