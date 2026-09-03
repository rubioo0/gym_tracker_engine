import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock } from '../../application/activeGoal'
import { checkGoalNeedsRenewal, type GoalRenewalReason } from '../../application/goalStatus'
import { mostRecentTopSet } from '../../application/sessionPrescription'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
import { getMuscleGroup } from '../../domain/muscles/muscleTaxonomy'

const RENEWAL_MESSAGES: Record<GoalRenewalReason, string> = {
  deadlinePassed: 'Дедлайн вашої цілі минув.',
  targetMet: 'Ви досягли цілі!',
  focusMuscleInjured: 'Вашу фокус-групу м’язів позначено як травмовану.',
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
          <p className="muted">Завантаження…</p>
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
        <h2>Наступна сесія</h2>
        {!state.profile ? (
          <p>Спершу налаштуйте профіль на вкладці Автопрофіль.</p>
        ) : !active ? (
          <p>Ще немає активної цілі. Створіть її на вкладці Автопрофіль, щоб почати тренування.</p>
        ) : renewalReason ? (
          <>
            <p className="note">{RENEWAL_MESSAGES[renewalReason]}</p>
            <p className="muted">Встановіть наступну ціль на вкладці Автопрофіль.</p>
          </>
        ) : (
          <>
            <p className="next-session-title">{getExerciseById(active.goal.exerciseId)?.nameEn ?? active.goal.exerciseId}</p>
            <p>
              Фокус: <strong>{getMuscleGroup(active.block.focusMuscle).labelUk}</strong> | Ціль:{' '}
              <strong>{active.goal.targetWeightKg}кг</strong> до {active.goal.deadline.slice(0, 10)}
            </p>
            <p>
              Залоговано сесій у цьому блоці: <strong>{sessionsInBlock}</strong>
            </p>
            <div className="action-row">
              <button type="button" onClick={onViewPlan}>
                Переглянути план
              </button>
              <button type="button" onClick={onGoToLog}>
                Завершити / залогувати сесію
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
            <p>{lastWorkout.successful ? 'Успішно' : 'Неуспішно'}</p>
            <p className="muted">
              Вправи:{' '}
              {lastWorkout.exerciseLogs
                .filter((e) => !e.skipped)
                .map((e) => getExerciseById(e.exerciseId)?.nameEn ?? e.exerciseId)
                .join(', ') || 'Немає (всі пропущені)'}
            </p>
            {lastWorkout.note ? <p className="note">{lastWorkout.note}</p> : null}
          </>
        ) : (
          <p>Ще немає залогованих сесій.</p>
        )}
      </article>
    </section>
  )
}
