import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { mostRecentTopSet } from '../../application/sessionPrescription'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
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
          <p className="muted">Loading…</p>
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
    if (!window.confirm('End the active goal now? You can set a new one on the Автопрофіль tab afterward.')) return
    dispatch({ type: 'END_GOAL', endedAt: new Date().toISOString() })
  }

  return (
    <section className="panel-grid">
      <article className="card card-primary">
        <h2>Active</h2>
        {active ? <ActiveBlockCard active={active} onEndGoal={endGoal} /> : <p>No active goal. Set one on the Автопрофіль tab.</p>}
      </article>

      <article className="card">
        <h2>History</h2>
        {endedBlocks.length === 0 ? (
          <p className="muted">No ended goals yet.</p>
        ) : (
          <ul className="list-plain">
            {endedBlocks.map((block) => {
              const goal = state.goals.find((g) => g.id === block.goalId)
              const exercise = goal ? getExerciseById(goal.exerciseId) : undefined
              return (
                <li key={block.goalId} className="item-row item-row-stack">
                  <div>
                    <strong>{exercise?.nameEn ?? goal?.exerciseId ?? 'Unknown exercise'}</strong>
                    <div className="muted">
                      Focus: {block.focusMuscle} | {block.startedAt.slice(0, 10)} → {block.endedAt!.slice(0, 10)}
                    </div>
                    {goal ? (
                      <div className="muted">
                        {goal.startingWeightKg}kg → {goal.targetWeightKg}kg (target)
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
        Focus: <strong>{block.focusMuscle}</strong> | Started {block.startedAt.slice(0, 10)}
      </p>
      <p>
        {goal.startingWeightKg}kg -&gt; {goal.targetWeightKg}kg by {goal.deadline.slice(0, 10)}
      </p>
      <p>
        Current: <strong>{currentWeightKg}kg</strong> | Sessions logged this block: <strong>{sessionsInBlock}</strong>
      </p>
      <p className={onTrack ? 'note' : 'muted'}>
        {projected === null
          ? 'Projection unavailable (no positive progress rate).'
          : onTrack
            ? `On track — projected completion ${projected.toISOString().slice(0, 10)}.`
            : `Behind schedule — projected completion ${projected.toISOString().slice(0, 10)}, after the deadline.`}
      </p>
      <div className="action-row">
        <button type="button" onClick={onEndGoal}>
          End this goal early
        </button>
      </div>
    </>
  )
}
