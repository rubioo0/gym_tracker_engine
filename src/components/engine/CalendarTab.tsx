import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock } from '../../application/activeGoal'
import { projectUpcomingSessions } from '../../application/sessionCadence'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'

/**
 * Календар, rebuilt: same list shape as the old ProgramCalendarView (✓
 * logged / → projected, dated), but with no fixed session-count/template to
 * iterate against, dates come from application/sessionCadence.ts's learned-
 * cadence projection over the active block's real workoutLogs instead.
 */
export function CalendarTab() {
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

  const active = getActiveGoalAndBlock(state)
  if (!active) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p>No active goal yet. Create one on the Автопрофіль tab to start training.</p>
        </article>
      </section>
    )
  }

  const entries = projectUpcomingSessions(active.block, state.workoutLogs, new Date())
  const exerciseName = getExerciseById(active.goal.exerciseId)?.nameEn ?? active.goal.exerciseId

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Calendar — focus: {active.block.focusMuscle}</h2>
        <p className="muted">Goal exercise: {exerciseName}</p>
        {entries.length === 0 ? (
          <p>Nothing to show yet.</p>
        ) : (
          <ul className="list-plain">
            {entries.map((entry, i) => (
              <li key={i} className="item-row">
                <span>{entry.isProjected ? '→' : '✓'} {entry.date}</span>
                <span className="muted">{entry.isProjected ? 'projected' : 'logged'}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
