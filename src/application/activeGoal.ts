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
  const blockStart = new Date(block.startedAt).getTime()
  return workoutLogs.filter((log) => new Date(log.completedAt).getTime() >= blockStart).length
}
