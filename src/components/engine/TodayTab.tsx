import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { assembleTodaysSession } from '../../application/sessionOrchestration'
import { prescribeSession } from '../../application/sessionPrescription'
import type { DraftExerciseLog } from '../../application/state'
import { ExerciseDetailModal } from './ExerciseDetailModal'
import './EngineTabs.css'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Your goal’s deadline has passed.',
  targetMet: 'You hit your target!',
  focusMuscleInjured: 'Your focus muscle is marked as injured.',
}

export function TodayTab({ onSessionStarted }: { onSessionStarted?: () => void }) {
  const { state, dispatch, loaded } = useEngineState()

  const [availableMinutes, setAvailableMinutes] = useState(45)
  const [noGymToday, setNoGymToday] = useState(false)
  const [inputsConfirmed, setInputsConfirmed] = useState(false)
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

  const renewalReason = checkGoalNeedsRenewal(active.goal, active.block, state.profile, null, new Date())
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

  if (state.draftSession) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="note">
            A workout is already in progress (started {new Date(state.draftSession.startedAt).toLocaleTimeString()}).
          </p>
          <p className="muted">Go to the Завершити tab to log it and finish.</p>
          <div className="action-row">
            <button type="button" onClick={() => dispatch({ type: 'DISCARD_DRAFT_SESSION' })}>
              Discard this workout
            </button>
          </div>
        </article>
      </section>
    )
  }

  if (!inputsConfirmed) {
    return (
      <section className="panel-grid">
        <article className="card">
          <h2>Before we assemble today's session</h2>
          <label className="stacked-field inline-field">
            Minutes available today
            <input
              type="number"
              min={1}
              value={availableMinutes}
              onChange={(e) => setAvailableMinutes(Number(e.target.value))}
            />
          </label>
          <label className="log-checkbox-field inline-field">
            No gym today
            <input type="checkbox" checked={noGymToday} onChange={(e) => setNoGymToday(e.target.checked)} />
          </label>
          <div className="action-row">
            <button type="button" onClick={() => setInputsConfirmed(true)}>
              Assemble my session
            </button>
          </div>
        </article>
      </section>
    )
  }

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

  function startSession() {
    const prescriptions = prescribeSession(slots, active!.goal, state.workoutLogs)
    const exerciseLogs: DraftExerciseLog[] = prescriptions.map((p) => ({
      exerciseId: p.exerciseId,
      skipped: false,
      sets: p.sets.map((s) => ({ weightKg: s.weightKg, reps: s.targetReps, role: s.role })),
    }))
    dispatch({
      type: 'START_DRAFT_SESSION',
      draftSession: { startedAt: new Date().toISOString(), focusMuscle: active!.block.focusMuscle, exerciseLogs },
    })
    onSessionStarted?.()
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <div className="action-row">
          <button type="button" onClick={() => setInputsConfirmed(false)}>
            Change time / location
          </button>
        </div>
        <h2>Today's session — focus: {active.block.focusMuscle}</h2>
        {slots.length === 0 ? (
          <p>Nothing to show — try a larger time budget.</p>
        ) : (
          <ol className="exercise-card-list" aria-label="Today's exercises">
            {slots.map((slot, i) => (
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
                    <span className="exercise-chip">
                      <strong>Muscle</strong>
                      {slot.muscleGroupId}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        )}
        {slots.length > 0 ? (
          <div className="action-row">
            <button type="button" onClick={startSession}>
              Почати тренування
            </button>
          </div>
        ) : null}
      </article>

      {openSlotIndex !== null && slots[openSlotIndex] ? (
        <ExerciseDetailModal
          exercise={slots[openSlotIndex].exercise}
          sets={slots[openSlotIndex].sets}
          isGoalPriority={slots[openSlotIndex].isGoalPriority}
          onClose={() => setOpenSlotIndex(null)}
        />
      ) : null}
    </section>
  )
}
