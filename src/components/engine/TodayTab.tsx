import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { assembleTodaysSession } from '../../application/sessionOrchestration'
import { gymMinutesFrom } from '../../application/state'
import { mostRecentTopSet, prescribeSession, goalHeldStreak, shouldDeloadGoalExercise } from '../../application/sessionPrescription'
import { recentExerciseHistory } from '../../application/exerciseHistory'
import { isPerHandEquipment } from '../../domain/exerciseLibrary/exerciseLibrary'
import { getMuscleGroup } from '../../domain/muscles/muscleTaxonomy'
import { ExerciseDetailModal } from './ExerciseDetailModal'
import { NumberDraftInput } from './NumberDraftInput'
import './EngineTabs.css'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Дедлайн вашої цілі минув.',
  targetMet: 'Ви досягли цілі!',
  focusMuscleInjured: 'Вашу фокус-групу м’язів позначено як травмовану.',
}

/**
 * A pure viewer, like the old app's SessionPlanPanel: everything here is
 * recomputed fresh from persisted goals/specializationBlocks/workoutLogs on
 * every render, nothing is "started" or locked. Actual logging happens in
 * FinishSessionTab (Завершити), which independently recomputes its own
 * prescription — the two tabs are connected only by a plain navigation
 * button, never by a shared piece of state that could get stuck.
 *
 * The time/gym-access answer IS remembered (`state.confirmedSessionInputs`,
 * cleared once a workout is actually logged) so a casual revisit — nav away
 * and back, without deliberately choosing to change anything — keeps
 * showing the same plan instead of silently re-asking and possibly
 * assembling a different one. This is not a lock: "Change time / location"
 * always remains available, and nothing here ever blocks the screen.
 */
export function TodayTab({ onGoToFinish }: { onGoToFinish?: () => void }) {
  const { state, dispatch, loaded } = useEngineState()

  const [editingInputs, setEditingInputs] = useState(false)
  const [draftMinutes, setDraftMinutes] = useState(state.confirmedSessionInputs?.availableMinutes ?? 45)
  const [draftPoolMinutes, setDraftPoolMinutes] = useState(state.confirmedSessionInputs?.poolMinutes ?? 0)
  const [draftNoGym, setDraftNoGym] = useState(state.confirmedSessionInputs?.noGymToday ?? false)
  const [openSlotIndex, setOpenSlotIndex] = useState<number | null>(null)
  // UI-only advisory, not a loggable exercise -- deliberately outside
  // assembleTodaysSession/prescribeSession (no time-budget or domain
  // involvement) and not persisted, since nothing asked for it to be
  // tracked over time. Resets on every remount, same as openSlotIndex.
  const [warmupDone, setWarmupDone] = useState(false)

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

  if (!state.confirmedSessionInputs || editingInputs) {
    return (
      <section className="panel-grid">
        <article className="card">
          <h2>Перш ніж зібрати сьогоднішню сесію</h2>
          <label className="stacked-field inline-field">
            Хвилин доступно сьогодні
            <NumberDraftInput
              min={1}
              value={draftMinutes}
              onCommit={(n) => {
                if (n !== undefined) setDraftMinutes(n)
              }}
            />
          </label>
          <label className="stacked-field inline-field">
            З цього — басейн (хв)
            <NumberDraftInput
              min={0}
              value={draftPoolMinutes}
              onCommit={(n) => {
                if (n !== undefined) setDraftPoolMinutes(n)
              }}
            />
          </label>
          <label className="log-checkbox-field inline-field">
            Сьогодні без залу
            <input type="checkbox" checked={draftNoGym} onChange={(e) => setDraftNoGym(e.target.checked)} />
          </label>
          <div className="action-row">
            <button
              type="button"
              onClick={() => {
                dispatch({
                  type: 'CONFIRM_SESSION_INPUTS',
                  inputs: {
                    availableMinutes: draftMinutes,
                    poolMinutes: draftPoolMinutes,
                    noGymToday: draftNoGym,
                    confirmedAt: new Date().toISOString(),
                  },
                })
                setEditingInputs(false)
              }}
            >
              Зібрати мою сесію
            </button>
          </div>
        </article>
      </section>
    )
  }

  const { noGymToday, poolMinutes } = state.confirmedSessionInputs
  const completedSessionsInBlock = countSessionsInBlock(state.workoutLogs, active.block)
  const slots = assembleTodaysSession({
    focusMuscle: active.block.focusMuscle,
    goalExerciseId: active.goal.exerciseId,
    injuredMuscles: state.profile.injuredMuscles,
    sessionsPerWeek: state.profile.sessionsPerWeek,
    completedSessionsInBlock,
    noGymToday,
    availableMinutes: gymMinutesFrom(state.confirmedSessionInputs),
  })
  // Deload check needs the FULL workout history for accurate ACWR windows
  // (physical fatigue doesn't reset at a block boundary) alongside the
  // block-scoped history for the held-streak half of the same decision —
  // see shouldDeloadGoalExercise's own doc comment.
  const deloadGoalExercise = shouldDeloadGoalExercise(
    state.workoutLogs,
    blockWorkoutLogs,
    active.block.focusMuscle,
    active.goal,
  )
  // Prescription (target weight/reps) and recent history, same math the
  // Завершити screen already uses — shown here too so the card carries the
  // same at-a-glance info the old app's exercise cards did (sets/reps/
  // weight/last-3-history), not just a bare set count.
  const prescriptions = prescribeSession(slots, active.goal, blockWorkoutLogs, { deloadGoalExercise })

  return (
    <section className="panel-grid">
      {slots.length > 0 ? (
        <article className="card">
          <h2>🏃 Розминка (5-10 хв)</h2>
          <p className="muted">
            Перед тренуванням порадимо 5-10 хв легкого кардіо (бігова доріжка, велотренажер тощо), щоб розігріти
            м'язи та суглоби. Не входить у бюджет часу вправ — це порада, не вправа для логування.
          </p>
          <label className="log-checkbox-field">
            Розминку зроблено
            <input type="checkbox" checked={warmupDone} onChange={(e) => setWarmupDone(e.target.checked)} />
          </label>
        </article>
      ) : null}

      <article className="card card-wide">
        <div className="action-row">
          <button type="button" onClick={() => setEditingInputs(true)}>
            Змінити час / місце
          </button>
        </div>
        <h2>Сьогоднішня сесія — фокус: {getMuscleGroup(active.block.focusMuscle).labelUk}</h2>
        {poolMinutes ? <p className="muted">🏊 {poolMinutes} хв басейн (не входить у бюджет вправ у залі)</p> : null}
        {deloadGoalExercise ? (
          <p className="note">
            ⚠️ Рекомендовано розвантаження для цільової вправи — перевантаження (ACWR) або застій 2+ сесії. Прогресію
            призупинено цю сесію; за потреби зменшіть вагу самостійно, якщо вона все ще здається важкою.
          </p>
        ) : null}
        {slots.length === 0 ? (
          <p>Немає що показати — спробуйте більший бюджет часу.</p>
        ) : (
          <ol className="exercise-card-list" aria-label="Сьогоднішні вправи">
            {slots.map((slot, i) => {
              const working = prescriptions[i]?.sets.find((s) => s.role === 'working')
              const rampCount = prescriptions[i]?.sets.filter((s) => s.role === 'ramp').length ?? 0
              const history = recentExerciseHistory(state.workoutLogs, slot.exercise.id, 3)
              return (
                <li key={i} className="exercise-card-item">
                  <button
                    type="button"
                    className={slot.isGoalPriority ? 'exercise-card exercise-card-active' : 'exercise-card'}
                    aria-pressed={openSlotIndex === i}
                    onClick={() => setOpenSlotIndex(i)}
                  >
                    <div className="exercise-card-header">
                      <span className="exercise-card-order">#{i + 1}</span>
                      {slot.isGoalPriority ? <span className="exercise-type-badge">Ціль</span> : null}
                    </div>
                    <h3 className="exercise-card-title">{slot.exercise.nameEn}</h3>
                    <div className="exercise-card-metrics">
                      <span className="exercise-chip">
                        <strong>Sets</strong>
                        {slot.sets}
                        {rampCount > 0 ? ` (+${rampCount} розм.)` : ''}
                      </span>
                      {working ? (
                        <>
                          <span className="exercise-chip">
                            <strong>Reps</strong>
                            {working.targetReps}
                          </span>
                          <span className="exercise-chip">
                            <strong>Weight</strong>
                            {working.weightKg}kg{isPerHandEquipment(slot.exercise) ? ' /hand' : ''}
                          </span>
                        </>
                      ) : null}
                      <span className="exercise-chip">
                        <strong>Muscle</strong>
                        {getMuscleGroup(slot.muscleGroupId).labelUk}
                      </span>
                    </div>
                    {history.length > 0 ? (
                      <div className="exercise-card-history">
                        {history.map((entry) => (
                          <span key={entry.completedAt} className="exercise-history-chip">
                            {entry.weightKg}kg{isPerHandEquipment(slot.exercise) ? '/hand' : ''}×{entry.reps} ({entry.completedAt.slice(0, 10)})
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        {slots.length > 0 ? (
          <div className="action-row">
            <button type="button" onClick={onGoToFinish}>
              Перейти до Завершити
            </button>
          </div>
        ) : null}
      </article>

      {openSlotIndex !== null && slots[openSlotIndex] ? (
        <ExerciseDetailModal
          exercise={slots[openSlotIndex].exercise}
          sets={slots[openSlotIndex].sets}
          isGoalPriority={slots[openSlotIndex].isGoalPriority}
          prescribedSets={prescriptions[openSlotIndex]?.sets}
          history={recentExerciseHistory(state.workoutLogs, slots[openSlotIndex].exercise.id, 10)}
          heldStreak={slots[openSlotIndex].isGoalPriority ? goalHeldStreak(blockWorkoutLogs, active.goal) : undefined}
          goalTrainingEmphasis={active.goal.trainingEmphasis}
          deloaded={slots[openSlotIndex].isGoalPriority && deloadGoalExercise}
          onClose={() => setOpenSlotIndex(null)}
        />
      ) : null}
    </section>
  )
}
