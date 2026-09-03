import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { assembleTodaysSession } from '../../application/sessionOrchestration'
import { prescribeSession, mostRecentTopSet, shouldDeloadGoalExercise } from '../../application/sessionPrescription'
import { recentExerciseHistory } from '../../application/exerciseHistory'
import { getExerciseById, isPerHandEquipment } from '../../domain/exerciseLibrary/exerciseLibrary'
import { getMuscleGroup } from '../../domain/muscles/muscleTaxonomy'
import { NumberDraftInput } from './NumberDraftInput'
import type { ExerciseDifficulty, SetEntry, WorkoutLog } from '../../domain/workoutLog/types'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Дедлайн вашої цілі минув.',
  targetMet: 'Ви досягли цілі!',
  focusMuscleInjured: 'Вашу фокус-групу м’язів позначено як травмовану.',
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
export function FinishSessionTab({ onFinished }: { onFinished?: () => void }) {
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
          <p className="muted">Завантаження…</p>
        </article>
      </section>
    )
  }
  if (!state.profile) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>Спершу налаштуйте профіль на вкладці Автопрофіль.</p>
        </article>
      </section>
    )
  }

  const active = getActiveGoalAndBlock(state)
  if (!active) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>Ще немає активної цілі. Створіть її на вкладці Автопрофіль, щоб почати тренування.</p>
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
          <p className="muted">Встановіть наступну ціль на вкладці Автопрофіль.</p>
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
    // Matches the old app's handleSubmitLog, which navigated to Home right
    // after logging — onFinished is optional so the component still works
    // standalone (e.g. in tests) without a navigation callback wired up.
    onFinished?.()
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Завершити тренування</h2>
        {justFinished ? <p className="note">Тренування збережено. Нижче — форма для наступного.</p> : null}
        {deloadGoalExercise ? (
          <p className="note">
            ⚠️ Рекомендовано розвантаження для цільової вправи — перевантаження (ACWR) або застій 2+ сесії. Прогресію
            призупинено цю сесію; за потреби зменшіть вагу самостійно, якщо вона все ще здається важкою.
          </p>
        ) : null}
        <p className="muted">Фокус: {getMuscleGroup(active.block.focusMuscle).labelUk}</p>

        {state.confirmedSessionInputs ? (
          <p className="muted">
            Використовується сьогоднішній план з "План сесії" ({effectiveAvailableMinutes} хв
            {effectiveNoGymToday ? ', без залу' : ''}).
          </p>
        ) : (
          <label className="log-checkbox-field inline-field">
            Сьогодні без залу
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
          const rampCount = log.sets.filter((s) => s.role === 'ramp').length
          const workingCount = log.sets.filter((s) => s.role === 'working').length
          return (
            <article key={log.exerciseId} className="log-exercise-card">
              <h3>{exercise?.nameEn ?? log.exerciseId}</h3>
              {!log.skipped && rampCount > 0 ? (
                <p className="muted">
                  {workingCount} робочих підходи (+{rampCount} розминкових = {log.sets.length} рядків нижче)
                </p>
              ) : null}
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
                Пропустити цю вправу
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
                        <NumberDraftInput
                          value={set.weightKg}
                          onCommit={(n) => {
                            if (n === undefined) return
                            setJustFinished(false)
                            updateSet(log.exerciseId, i, { weightKg: n })
                          }}
                        />
                      </label>
                      <label className="stacked-field">
                        Reps
                        <NumberDraftInput
                          value={set.reps}
                          onCommit={(n) => {
                            if (n === undefined) return
                            setJustFinished(false)
                            updateSet(log.exerciseId, i, { reps: n })
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <label className="stacked-field">
                    Складність
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
                      <option value="easy">легко</option>
                      <option value="okay">нормально</option>
                      <option value="hard">важко</option>
                    </select>
                  </label>
                </>
              )}
            </article>
          )
        })}

        <label className="log-checkbox-field">
          Сесія успішна
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
          Нотатка
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
