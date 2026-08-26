import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { PersistedState } from './state'

export interface ActiveGoalAndBlock {
  goal: Goal
  block: SpecializationBlock
}

/** The single active (not-yet-ended) specialization block and its goal, if one exists — per the single-focus model, there is at most one. */
export function getActiveGoalAndBlock(state: PersistedState): ActiveGoalAndBlock | null {
  const block = state.specializationBlocks.find((b) => b.endedAt === null)
  if (!block) return null
  const goal = state.goals.find((g) => g.id === block.goalId)
  if (!goal) return null
  return { goal, block }
}

/** How many sessions have been logged since the block started — the session-count-based rotation-slot input for sessionOrchestration.ts (grooming finding #7: "today" is session-count-based, not calendar-based). */
export function countSessionsInBlock(workoutLogs: readonly WorkoutLog[], block: SpecializationBlock): number {
  return workoutLogsInBlock(workoutLogs, block).length
}

/**
 * Logs scoped to the active block's timeframe — used anywhere a previous,
 * unrelated block's history on the same exercise must not be mistaken for
 * this block's progress (goal-renewal checks, today's prescription). A
 * second goal cycle on an exercise you've trained before would otherwise
 * see the old block's top set and could be born already "target met."
 * Display-only history (recent-lifts chips) intentionally keeps using the
 * unfiltered log list — showing all-time history there is desirable, this
 * scoping is only for logic that decides what's "current."
 */
export function workoutLogsInBlock(workoutLogs: readonly WorkoutLog[], block: SpecializationBlock): WorkoutLog[] {
  const blockStart = new Date(block.startedAt).getTime()
  return workoutLogs.filter((log) => new Date(log.completedAt).getTime() >= blockStart)
}
