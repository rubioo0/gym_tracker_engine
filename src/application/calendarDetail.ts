import type { PersistedState } from './state'
import type { ActiveGoalAndBlock } from './activeGoal'
import { countSessionsInBlock, workoutLogsInBlock } from './activeGoal'
import { assembleTodaysSession } from './sessionOrchestration'
import { prescribeSession } from './sessionPrescription'
import type { CalendarEntry } from './sessionCadence'
import { getExerciseById, isPerHandEquipment } from '../domain/exerciseLibrary/exerciseLibrary'
import { topSet } from '../domain/workoutLog/workoutLog'

export interface CalendarExerciseDetail {
  exerciseId: string
  name: string
  sets: number
  /** Target (projected entries) or actually-logged (past entries) top-set reps — undefined only if genuinely unavailable. */
  reps?: number
  /** Target (projected) or actually-logged (past) top-set weight. */
  weightKg?: number
  perHand: boolean
  skipped: boolean
}

export interface CalendarEntryDetail extends CalendarEntry {
  exercises: CalendarExerciseDetail[]
}

const DEFAULT_PROJECTION_MINUTES = 45

/**
 * Attaches per-date exercise detail to sessionCadence.ts's bare
 * {date,isProjected} entries — the old app's ProgramCalendarView could
 * expand a session because it iterated a fixed, pre-built template; the
 * engine has no such fixed structure, so past entries are read back from
 * the real logged WorkoutLog, and future entries are a preview built by
 * calling the same assembleTodaysSession/prescribeSession the Session/Log
 * tabs use for "today" — showing what the engine would currently prescribe
 * at that point in the rotation, not a simulation of future progression.
 */
export function buildCalendarEntryDetails(
  entries: readonly CalendarEntry[],
  state: PersistedState,
  active: ActiveGoalAndBlock,
): CalendarEntryDetail[] {
  const profile = state.profile
  if (!profile) return entries.map((entry) => ({ ...entry, exercises: [] }))

  const { goal, block } = active
  const blockWorkoutLogs = workoutLogsInBlock(state.workoutLogs, block)
  const baseCompletedSessions = countSessionsInBlock(state.workoutLogs, block)
  const availableMinutes = state.confirmedSessionInputs?.availableMinutes ?? DEFAULT_PROJECTION_MINUTES

  let projectedIndex = 0

  return entries.map((entry): CalendarEntryDetail => {
    if (!entry.isProjected) {
      const log = state.workoutLogs.find((l) => l.id === entry.workoutLogId)
      const exercises: CalendarExerciseDetail[] = log
        ? log.exerciseLogs.map((exerciseLog) => {
            const exercise = getExerciseById(exerciseLog.exerciseId)
            const top = topSet(exerciseLog)
            return {
              exerciseId: exerciseLog.exerciseId,
              name: exercise?.nameEn ?? exerciseLog.exerciseId,
              sets: exerciseLog.sets.filter((s) => s.role === 'working').length,
              reps: top?.reps,
              weightKg: top?.weightKg,
              perHand: exercise ? isPerHandEquipment(exercise) : false,
              skipped: exerciseLog.skipped,
            }
          })
        : []
      return { ...entry, exercises }
    }

    const slots = assembleTodaysSession({
      focusMuscle: block.focusMuscle,
      goalExerciseId: goal.exerciseId,
      injuredMuscles: profile.injuredMuscles,
      sessionsPerWeek: profile.sessionsPerWeek,
      completedSessionsInBlock: baseCompletedSessions + projectedIndex,
      noGymToday: false,
      availableMinutes,
    })
    const prescriptions = prescribeSession(slots, goal, blockWorkoutLogs)
    projectedIndex += 1

    const exercises: CalendarExerciseDetail[] = slots.map((slot, i) => {
      const working = prescriptions[i]?.sets.find((s) => s.role === 'working')
      return {
        exerciseId: slot.exercise.id,
        name: slot.exercise.nameEn,
        sets: slot.sets,
        reps: working?.targetReps,
        weightKg: working?.weightKg,
        perHand: isPerHandEquipment(slot.exercise),
        skipped: false,
      }
    })
    return { ...entry, exercises }
  })
}
