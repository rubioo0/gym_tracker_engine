import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { mostRecentTopSet } from '../../application/sessionPrescription'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Your goal’s deadline has passed.',
  targetMet: 'You hit your target!',
  focusMuscleInjured: 'Your focus muscle is marked as injured.',
}

/**
 * Головна, rebuilt on the engine's own state. The old cards (Next Session /
 * Остання завершена сесія) and KPI strip are kept visually, but "Current
 * Mode"/"Active Tracks" have no new-engine analog (multi-track/mode were
 * explicitly retired) -- replaced with focus muscle and sessions-this-block.
 */
export function HomeTab({ onViewPlan, onGoToLog }: { onViewPlan: () => void; onGoToLog: () => void }) {
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

  const active = state.profile ? getActiveGoalAndBlock(state) : null
  const renewalReason =
    active && state.profile
      ? checkGoalNeedsRenewal(
          active.goal,
          active.block,
          state.profile,
          mostRecentTopSet(state.workoutLogs, active.goal.exerciseId)?.weightKg ?? null,
          new Date(),
        )
      : null
  const sessionsInBlock = active ? countSessionsInBlock(state.workoutLogs, active.block) : 0
  const lastWorkout = state.workoutLogs.length > 0 ? state.workoutLogs[state.workoutLogs.length - 1] : null

  return (
    <section className="panel-grid">
      <article className="card card-primary">
        <h2>Next Session</h2>
        {!state.profile ? (
          <p>Set up your profile first, on the Автопрофіль tab.</p>
        ) : !active ? (
          <p>No active goal yet. Create one on the Автопрофіль tab to start training.</p>
        ) : renewalReason ? (
          <>
            <p className="note">{RENEWAL_MESSAGES[renewalReason]}</p>
            <p className="muted">Set your next goal on the Автопрофіль tab.</p>
          </>
        ) : (
          <>
            <p className="next-session-title">{getExerciseById(active.goal.exerciseId)?.nameEn ?? active.goal.exerciseId}</p>
            <p>
              Focus: <strong>{active.block.focusMuscle}</strong> | Target:{' '}
              <strong>{active.goal.targetWeightKg}kg</strong> by {active.goal.deadline.slice(0, 10)}
            </p>
            <p>
              Sessions logged this block: <strong>{sessionsInBlock}</strong>
            </p>
            <div className="action-row">
              <button type="button" onClick={onViewPlan}>
                View Plan
              </button>
              <button type="button" onClick={onGoToLog}>
                Finish / Log Session
              </button>
            </div>
          </>
        )}
      </article>

      <article className="card">
        <h2>Остання завершена сесія</h2>
        {lastWorkout ? (
          <>
            <p className="next-session-title">{new Date(lastWorkout.completedAt).toLocaleString()}</p>
            <p>{lastWorkout.successful ? 'Successful' : 'Not successful'}</p>
            <p className="muted">
              Exercises:{' '}
              {lastWorkout.exerciseLogs
                .filter((e) => !e.skipped)
                .map((e) => getExerciseById(e.exerciseId)?.nameEn ?? e.exerciseId)
                .join(', ') || 'None (all skipped)'}
            </p>
            {lastWorkout.note ? <p className="note">{lastWorkout.note}</p> : null}
          </>
        ) : (
          <p>No logged sessions yet.</p>
        )}
      </article>
    </section>
  )
}
