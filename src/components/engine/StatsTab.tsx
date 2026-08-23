import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock } from '../../application/activeGoal'
import { buildMuscleLoadEntries } from '../../application/muscleLoadHistory'
import { projectedCompletionDate, isOnTrack, ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE } from '../../domain/goals/goalProjection'
import { acuteLoad, chronicLoad, acwr, classifyAcwrZone, isDetrainingRisk } from '../../domain/acwr/acwr'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
import { MUSCLE_GROUPS } from '../../domain/muscles/muscleTaxonomy'
import type { Goal } from '../../domain/goals/types'
import type { ExperienceLevel } from '../../domain/profile/types'
import type { WorkoutLog } from '../../domain/workoutLog/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function weekStart(date: Date): number {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setHours(0, 0, 0, 0)
  return d.getTime() - day * MS_PER_DAY
}

function maxWorkingWeight(workoutLogs: readonly WorkoutLog[], exerciseId: string): { weightKg: number; completedAt: string } | null {
  let best: { weightKg: number; completedAt: string } | null = null
  for (const log of workoutLogs) {
    for (const exerciseLog of log.exerciseLogs) {
      if (exerciseLog.skipped || exerciseLog.exerciseId !== exerciseId) continue
      for (const set of exerciseLog.sets) {
        if (set.role !== 'working') continue
        if (!best || set.weightKg > best.weightKg) {
          best = { weightKg: set.weightKg, completedAt: log.completedAt }
        }
      }
    }
  }
  return best
}

/**
 * Статистика, rebuilt: ports the old StatsTab's 5 sections onto engine data
 * (summary KPIs, consistency streak, goal progress via goalProjection.ts,
 * exercise PRs, baseline->current gain), plus a new 6th section surfacing
 * acwr.ts's per-muscle load math (built in Phase 4, never wired into any UI
 * until now) via application/muscleLoadHistory.ts's aggregation.
 */
export function StatsTab() {
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

  const asOf = new Date()
  const logs = state.workoutLogs
  const active = getActiveGoalAndBlock(state)

  // 1. Summary KPIs
  const totalWorkouts = logs.length
  const successfulCount = logs.filter((l) => l.successful).length
  const successRate = totalWorkouts > 0 ? Math.round((successfulCount / totalWorkouts) * 100) : 0
  const completedExerciseCount = logs.reduce((sum, l) => sum + l.exerciseLogs.filter((e) => !e.skipped).length, 0)

  // 2. Consistency: current streak of consecutive weeks with >=1 workout, and avg/week over trailing 12 weeks.
  const weekStartsWithWorkouts = new Set(logs.map((l) => weekStart(new Date(l.completedAt))))
  let streakWeeks = 0
  for (let w = weekStart(asOf); weekStartsWithWorkouts.has(w); w -= 7 * MS_PER_DAY) {
    streakWeeks++
  }
  const twelveWeeksAgo = asOf.getTime() - 12 * 7 * MS_PER_DAY
  const workoutsLast12Weeks = logs.filter((l) => new Date(l.completedAt).getTime() >= twelveWeeksAgo).length
  const avgPerWeek = (workoutsLast12Weeks / 12).toFixed(1)

  // 3. Goal progress: active goal plus every ended one.
  const allGoalBlocks = state.specializationBlocks
    .map((block) => ({ block, goal: state.goals.find((g) => g.id === block.goalId) }))
    .filter((x): x is { block: (typeof state.specializationBlocks)[number]; goal: Goal } => Boolean(x.goal))

  // 4. Exercise PRs: max working-set weight ever logged, per exercise.
  const exerciseIds = Array.from(new Set(logs.flatMap((l) => l.exerciseLogs.filter((e) => !e.skipped).map((e) => e.exerciseId))))
  const prs = exerciseIds
    .map((id) => ({ id, best: maxWorkingWeight(logs, id) }))
    .filter((x): x is { id: string; best: { weightKg: number; completedAt: string } } => Boolean(x.best))
    .sort((a, b) => b.best.weightKg - a.best.weightKg)

  // 6. Per-muscle ACWR/volume: only muscles with any logged data at all.
  const muscleStats = MUSCLE_GROUPS.map((muscle) => {
    const entries = buildMuscleLoadEntries(logs, muscle.id)
    if (entries.length === 0) return null
    const ratio = acwr(entries, asOf)
    return {
      muscle,
      acute: acuteLoad(entries, asOf),
      chronic: chronicLoad(entries, asOf),
      ratio,
      zone: classifyAcwrZone(ratio),
      detrainingRisk: isDetrainingRisk(entries, asOf),
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Summary</h2>
        <div className="header-kpis">
          <div className="kpi">
            <span>Total workouts</span>
            <strong>{totalWorkouts}</strong>
          </div>
          <div className="kpi">
            <span>Success rate</span>
            <strong>{successRate}%</strong>
          </div>
          <div className="kpi">
            <span>Active goals</span>
            <strong>{active ? 1 : 0}</strong>
          </div>
          <div className="kpi">
            <span>Completed exercises</span>
            <strong>{completedExerciseCount}</strong>
          </div>
        </div>
      </article>

      <article className="card">
        <h2>Consistency</h2>
        <p>
          Current streak: <strong>{streakWeeks} week(s)</strong>
        </p>
        <p>
          Avg workouts/week (last 12 weeks): <strong>{avgPerWeek}</strong>
        </p>
      </article>

      <article className="card">
        <h2>Goal Progress</h2>
        {allGoalBlocks.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <ul className="list-plain">
            {allGoalBlocks.map(({ block, goal }) => {
              const exercise = getExerciseById(goal.exerciseId)
              const experienceLevel: ExperienceLevel = state.profile?.experienceByMuscle[block.focusMuscle] ?? 'beginner'
              const weeklyRateKg = ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[experienceLevel]
              const currentWeightKg = maxWorkingWeight(logs, goal.exerciseId)?.weightKg ?? goal.startingWeightKg
              const projected = projectedCompletionDate(currentWeightKg, goal.targetWeightKg, weeklyRateKg, asOf)
              const onTrack = isOnTrack(currentWeightKg, goal.targetWeightKg, goal.deadline, weeklyRateKg, asOf)
              return (
                <li key={goal.id} className="item-row item-row-stack">
                  <div>
                    <strong>{exercise?.nameEn ?? goal.exerciseId}</strong>{' '}
                    {block.endedAt ? <span className="muted">(ended)</span> : <span className="note">(active)</span>}
                    <div className="muted">
                      {goal.startingWeightKg}kg → {goal.targetWeightKg}kg | current {currentWeightKg}kg
                    </div>
                    <div className="muted">
                      {projected === null
                        ? 'Projection unavailable.'
                        : `${onTrack ? 'On track' : 'Behind schedule'} — projected ${projected.toISOString().slice(0, 10)}`}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <article className="card">
        <h2>Exercise Personal Records</h2>
        {prs.length === 0 ? (
          <p className="muted">No working sets logged yet.</p>
        ) : (
          <ul className="list-plain">
            {prs.map(({ id, best }) => (
              <li key={id} className="item-row">
                <span>{getExerciseById(id)?.nameEn ?? id}</span>
                <span className="muted">
                  {best.weightKg}kg on {best.completedAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="card">
        <h2>Baseline → Current Progress</h2>
        {allGoalBlocks.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <ul className="list-plain">
            {allGoalBlocks.map(({ goal }) => {
              const currentWeightKg = maxWorkingWeight(logs, goal.exerciseId)?.weightKg ?? goal.startingWeightKg
              const gainKg = currentWeightKg - goal.startingWeightKg
              const gainPct = goal.startingWeightKg > 0 ? Math.round((gainKg / goal.startingWeightKg) * 100) : 0
              return (
                <li key={goal.id} className="item-row">
                  <span>{getExerciseById(goal.exerciseId)?.nameEn ?? goal.exerciseId}</span>
                  <span className="muted">
                    +{gainKg}kg ({gainPct}%)
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <article className="card card-wide">
        <h2>Per-Muscle Load (ACWR)</h2>
        {muscleStats.length === 0 ? (
          <p className="muted">No logged sets yet.</p>
        ) : (
          <ul className="list-plain">
            {muscleStats.map(({ muscle, acute, chronic, ratio, zone, detrainingRisk }) => (
              <li key={muscle.id} className="item-row item-row-stack">
                <div>
                  <strong>{muscle.labelEn}</strong>
                  <div className="muted">
                    Acute (7d): {acute} hard sets | Chronic (28d): {chronic} hard sets | ACWR:{' '}
                    {ratio === null ? 'n/a' : ratio.toFixed(2)} ({zone})
                  </div>
                  {detrainingRisk ? <div className="note">Detraining risk — no load in 14+ days.</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
