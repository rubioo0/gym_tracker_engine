import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { mostRecentTopSet } from '../../application/sessionPrescription'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
import { getMuscleGroup } from '../../domain/muscles/muscleTaxonomy'
import { projectedCompletionDate, isOnTrack } from '../../domain/goals/goalProjection'
import { ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE } from '../../domain/goals/goalProjection'
import type { ExperienceLevel } from '../../domain/profile/types'
import type { Goal } from '../../domain/goals/types'
import type { SpecializationBlock } from '../../domain/specialization/types'

/**
 * Тренування, rebuilt: the old app's FocusRun list (pause/resume/switch
 * between several simultaneous programs) has no analog here -- the new
 * engine deliberately keeps one active goal/block at a time. This shows
 * that one active block (with real progress, via the already-built but
 * previously unwired goalProjection.ts) plus a history list of ended ones,
 * matching the old Runs tab's grouped-list visual shape.
 */
export function FocusTab() {
  const { state, dispatch, loaded } = useEngineState()

  if (!loaded) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="muted">Завантаження…</p>
        </article>
      </section>
    )
  }

  const active = getActiveGoalAndBlock(state)

  const endedBlocks = state.specializationBlocks
    .filter((b) => b.endedAt !== null)
    .slice()
    .sort((a, b) => (b.endedAt! < a.endedAt! ? -1 : 1))

  function endGoal() {
    if (!window.confirm('Завершити активну ціль зараз? Потім можна встановити нову на вкладці Автопрофіль.')) return
    dispatch({ type: 'END_GOAL', endedAt: new Date().toISOString() })
  }

  return (
    <section className="panel-grid">
      <article className="card card-primary">
        <h2>Активна</h2>
        {active ? (
          <ActiveBlockCard active={active} onEndGoal={endGoal} />
        ) : (
          <p>Немає активної цілі. Встановіть її на вкладці Автопрофіль.</p>
        )}
      </article>

      <article className="card">
        <h2>Історія</h2>
        {endedBlocks.length === 0 ? (
          <p className="muted">Ще немає завершених цілей.</p>
        ) : (
          <ul className="list-plain">
            {endedBlocks.map((block) => {
              const goal = state.goals.find((g) => g.id === block.goalId)
              const exercise = goal ? getExerciseById(goal.exerciseId) : undefined
              return (
                <li key={block.goalId} className="item-row item-row-stack">
                  <div>
                    <strong>{exercise?.nameEn ?? goal?.exerciseId ?? 'Невідома вправа'}</strong>
                    <div className="muted">
                      Фокус: {getMuscleGroup(block.focusMuscle).labelUk} | {block.startedAt.slice(0, 10)} →{' '}
                      {block.endedAt!.slice(0, 10)}
                    </div>
                    {goal ? (
                      <div className="muted">
                        {goal.startingWeightKg}кг → {goal.targetWeightKg}кг (ціль)
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </article>
    </section>
  )
}

function ActiveBlockCard({
  active,
  onEndGoal,
}: {
  active: { goal: Goal; block: SpecializationBlock }
  onEndGoal: () => void
}) {
  const { state } = useEngineState()
  const { goal, block } = active
  const exercise = getExerciseById(goal.exerciseId)
  const sessionsInBlock = countSessionsInBlock(state.workoutLogs, block)

  const lastTopSet = mostRecentTopSet(workoutLogsInBlock(state.workoutLogs, block), goal.exerciseId)
  const currentWeightKg = lastTopSet?.weightKg ?? goal.startingWeightKg

  const experienceLevel: ExperienceLevel = state.profile?.experienceByMuscle[block.focusMuscle] ?? 'beginner'
  const weeklyRateKg = ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[experienceLevel]
  const projected = projectedCompletionDate(currentWeightKg, goal.targetWeightKg, weeklyRateKg, new Date())
  const onTrack = isOnTrack(currentWeightKg, goal.targetWeightKg, goal.deadline, weeklyRateKg, new Date())

  return (
    <>
      <p className="next-session-title">{exercise?.nameEn ?? goal.exerciseId}</p>
      <p>
        Фокус: <strong>{getMuscleGroup(block.focusMuscle).labelUk}</strong> | Розпочато {block.startedAt.slice(0, 10)}
      </p>
      <p>
        {goal.startingWeightKg}кг -&gt; {goal.targetWeightKg}кг до {goal.deadline.slice(0, 10)}
      </p>
      <p>
        Поточна: <strong>{currentWeightKg}кг</strong> | Залоговано сесій у цьому блоці: <strong>{sessionsInBlock}</strong>
      </p>
      <p className={onTrack ? 'note' : 'muted'}>
        {projected === null
          ? 'Прогноз недоступний (немає позитивного темпу прогресу).'
          : onTrack
            ? `За графіком — прогнозоване завершення ${projected.toISOString().slice(0, 10)}.`
            : `Відстає від графіку — прогнозоване завершення ${projected.toISOString().slice(0, 10)}, після дедлайну.`}
      </p>
      <div className="action-row">
        <button type="button" onClick={onEndGoal}>
          Завершити ціль достроково
        </button>
      </div>
    </>
  )
}
