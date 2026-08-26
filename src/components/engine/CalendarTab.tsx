import { useState } from 'react'
import { useEngineState } from './useEngineState'
import { getActiveGoalAndBlock, workoutLogsInBlock } from '../../application/activeGoal'
import { projectUpcomingSessions, calculateAvgDaysBetweenSessions } from '../../application/sessionCadence'
import { buildCalendarEntryDetails } from '../../application/calendarDetail'
import { mostRecentTopSet } from '../../application/sessionPrescription'
import {
  projectedCompletionDate,
  isOnTrack,
  ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE,
} from '../../domain/goals/goalProjection'
import type { ExperienceLevel } from '../../domain/profile/types'
import { getExerciseById } from '../../domain/exerciseLibrary/exerciseLibrary'
import { parseLocalDateKey } from '../../domain/dateUtils'
import { exportEngineCalendarToExcel, buildEngineCalendarExcelFileName } from '../../data/engineExcelCalendarExport'
import './CalendarTab.css'

function formatDateKey(dateKey: string): string {
  return parseLocalDateKey(dateKey).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}

function formatWeight(weightKg: number | undefined, perHand: boolean): string {
  if (typeof weightKg !== 'number') return '-'
  return `${weightKg}kg${perHand ? '/hand' : ''}`
}

/**
 * Календар, rebuilt: same expandable-session-list visual shape as the old
 * app's ProgramCalendarView (ported CSS, components/engine/CalendarTab.css),
 * but with no fixed session-count/template to iterate against -- dates come
 * from sessionCadence.ts's learned-cadence projection, and per-entry
 * exercise detail from calendarDetail.ts (real logs for the past, a live
 * assembleTodaysSession/prescribeSession preview for the future). Header
 * stats swap the old "estimated end of the 16-session program" for the
 * engine's own goal-deadline projection (goalProjection.ts, already wired
 * into FocusTab) -- a better fit than reinventing a fixed-length estimate
 * for a model that has none.
 */
export function CalendarTab() {
  const { state, loaded } = useEngineState()
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [exportMessage, setExportMessage] = useState('')

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

  const { goal, block } = active
  const blockWorkoutLogs = workoutLogsInBlock(state.workoutLogs, block)
  const rawEntries = projectUpcomingSessions(block, state.workoutLogs, new Date())
  const entries = buildCalendarEntryDetails(rawEntries, state, active)
  const exerciseName = getExerciseById(goal.exerciseId)?.nameEn ?? goal.exerciseId

  const avgDays = calculateAvgDaysBetweenSessions(blockWorkoutLogs)
  const currentWeightKg = mostRecentTopSet(blockWorkoutLogs, goal.exerciseId)?.weightKg ?? goal.startingWeightKg
  const experienceLevel: ExperienceLevel = state.profile?.experienceByMuscle[block.focusMuscle] ?? 'beginner'
  const weeklyRateKg = ESTIMATED_WEEKLY_RATE_KG_BY_EXPERIENCE[experienceLevel]
  const projectedEnd = projectedCompletionDate(currentWeightKg, goal.targetWeightKg, weeklyRateKg, new Date())
  const onTrack = isOnTrack(currentWeightKg, goal.targetWeightKg, goal.deadline, weeklyRateKg, new Date())

  function toggle(index: number): void {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleExportExcel(): void {
    try {
      const buffer = exportEngineCalendarToExcel(entries)
      const fileName = buildEngineCalendarExcelFileName()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setExportMessage(`Exported calendar to ${fileName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.'
      setExportMessage(`Excel export failed: ${message}`)
    }
  }

  return (
    <section className="panel-grid">
      <article className="card card-wide">
        <h2>Calendar — focus: {block.focusMuscle}</h2>
        <p className="muted">Goal exercise: {exerciseName}</p>

        <div className="action-row">
          <button type="button" onClick={handleExportExcel} disabled={entries.length === 0}>
            Export Calendar to Excel
          </button>
        </div>
        {exportMessage ? <p className="note">{exportMessage}</p> : null}

        <div className="calendar-header">
          <div className="calendar-header-stat">
            <strong>Started</strong>
            {new Date(block.startedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
          </div>
          <div className="calendar-header-stat">
            <strong>Projected goal completion</strong>
            {projectedEnd === null
              ? 'unavailable'
              : `${projectedEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}${onTrack ? '' : ' (behind deadline)'}`}
          </div>
          <div className="calendar-header-stat">
            <strong>Avg. days between sessions</strong>
            {avgDays.toFixed(1)}
          </div>
        </div>

        {entries.length === 0 ? (
          <p>Nothing to show yet.</p>
        ) : (
          <div className="calendar-sessions">
            {entries.map((entry, index) => (
              <div key={index} className={`calendar-session ${entry.isProjected ? 'projected' : 'completed'}`}>
                <button type="button" className="session-header" onClick={() => toggle(index)}>
                  <span className="session-number">Session {index + 1}</span>
                  <span className="session-name">
                    {entry.exercises.length} exercise{entry.exercises.length !== 1 ? 's' : ''}
                  </span>
                  {entry.isProjected ? (
                    <span className="session-status projected">→ {formatDateKey(entry.date)}</span>
                  ) : (
                    <span className="session-status">✓ {formatDateKey(entry.date)}</span>
                  )}
                </button>

                {expanded.has(index) && (
                  <div className="session-exercises">
                    {entry.exercises.length === 0 ? (
                      <p className="muted">No exercise detail available.</p>
                    ) : (
                      entry.exercises.map((exercise) => (
                        <div key={exercise.exerciseId} className="exercise-row">
                          <div className="exercise-name">{exercise.name}</div>
                          <div className="exercise-details">
                            <div className="exercise-meta">
                              {exercise.sets} × {exercise.reps ?? '-'}
                            </div>
                            <div className="exercise-weight">
                              <span className={exercise.perHand ? 'per-side' : 'total'}>
                                {formatWeight(exercise.weightKg, exercise.perHand)}
                              </span>
                            </div>
                            {exercise.skipped ? <div className="exercise-skipped">Skipped</div> : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
