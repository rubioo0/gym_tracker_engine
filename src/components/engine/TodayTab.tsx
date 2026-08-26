import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { assembleTodaysSession } from '../../application/sessionOrchestration'
import { mostRecentTopSet, prescribeSession } from '../../application/sessionPrescription'
import { recentExerciseHistory } from '../../application/exerciseHistory'
import { ExerciseDetailModal } from './ExerciseDetailModal'
import './EngineTabs.css'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Your goal’s deadline has passed.',
  targetMet: 'You hit your target!',
  focusMuscleInjured: 'Your focus muscle is marked as injured.',
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
  const [draftNoGym, setDraftNoGym] = useState(state.confirmedSessionInputs?.noGymToday ?? false)
  const [openSlotIndex, setOpenSlotIndex] = useState<number | null>(null)

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

  if (!state.confirmedSessionInputs || editingInputs) {
    return (
      <section className="panel-grid">
        <article className="card">
          <h2>Before we assemble today's session</h2>
          <label className="stacked-field inline-field">
            Minutes available today
            <input
              type="number"
              min={1}
              value={draftMinutes}
              onChange={(e) => setDraftMinutes(Number(e.target.value))}
            />
          </label>
          <label className="log-checkbox-field inline-field">
            No gym today
            <input type="checkbox" checked={draftNoGym} onChange={(e) => setDraftNoGym(e.target.checked)} />
          </label>
          <div className="action-row">
            <button
              type="button"
              onClick={() => {
                dispatch({
                  type: 'CONFIRM_SESSION_INPUTS',
                  inputs: { availableMinutes: draftMinutes, noGymToday: draftNoGym },
                })
                setEditingInputs(false)
              }}
            >
              Assemble my session
            </button>
          </div>
        </article>
      </section>
    )
  }

  const { availableMinutes, noGymToday } = state.confirmedSessionInputs
  const completedSessionsInBlock = countSessionsInBlock(state.workoutLogs, active.block)
  const slots = assembleTodaysSession({
    focusMuscle: active.block.focusMuscle,
    goalExerciseId: active.goal.exerciseId,
    injuredMuscles: state.profile.injuredMuscles,
    sessionsPerWeek: state.profile.sessionsPerWeek,
    completedSessionsInBlock,
    noGymToday,
    availableMinutes,
  })
  // Prescription (target weight/reps) and recent history, same math the
  // Завершити screen already uses — shown here too so the card carries the
  // same at-a-glance info the old app's exercise cards did (sets/reps/
  // weight/last-3-history), not just a bare set count.
  const prescriptions = prescribeSession(slots, active.goal, blockWorkoutLogs)

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <div className="action-row">
          <button type="button" onClick={() => setEditingInputs(true)}>
            Change time / location
          </button>
        </div>
        <h2>Today's session — focus: {active.block.focusMuscle}</h2>
        {slots.length === 0 ? (
          <p>Nothing to show — try a larger time budget.</p>
        ) : (
          <ol className="exercise-card-list" aria-label="Today's exercises">
            {slots.map((slot, i) => {
              const working = prescriptions[i]?.sets.find((s) => s.role === 'working')
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
                      {slot.isGoalPriority ? <span className="exercise-type-badge">Goal</span> : null}
                    </div>
                    <h3 className="exercise-card-title">{slot.exercise.nameEn}</h3>
                    <div className="exercise-card-metrics">
                      <span className="exercise-chip">
                        <strong>Sets</strong>
                        {slot.sets}
                      </span>
                      {working ? (
                        <>
                          <span className="exercise-chip">
                            <strong>Reps</strong>
                            {working.targetReps}
                          </span>
                          <span className="exercise-chip">
                            <strong>Weight</strong>
                            {working.weightKg}kg
                          </span>
                        </>
                      ) : null}
                      <span className="exercise-chip">
                        <strong>Muscle</strong>
                        {slot.muscleGroupId}
                      </span>
                    </div>
                    {history.length > 0 ? (
                      <div className="exercise-card-history">
                        {history.map((entry) => (
                          <span key={entry.completedAt} className="exercise-history-chip">
                            {entry.weightKg}kg×{entry.reps} ({entry.completedAt.slice(0, 10)})
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
          onClose={() => setOpenSlotIndex(null)}
        />
      ) : null}
    </section>
  )
}
