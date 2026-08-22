import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { PersistedState } from './state'

/**
 * Actions carry fully-constructed values (goal/specializationBlock/workoutLog
 * already built by the caller, ids/timestamps already generated) rather than
 * raw inputs — keeps the reducer itself a pure, deterministic state
 * transition with no id/date generation inside it. That impure work
 * belongs in the UI event handler that dispatches the action, not here.
 * LOG_WORKOUT mirrors the old app's own `logSession` reducer case
 * (domain/reducer.ts) exactly in spirit: one atomic "append this finished
 * workout" action, no separate start/draft/discard lifecycle around it.
 */
export type AppAction =
  | { type: 'SET_PROFILE'; profile: UserProfile }
  | { type: 'CREATE_GOAL'; goal: Goal; specializationBlock: SpecializationBlock }
  | { type: 'REPLACE_STATE'; state: PersistedState } // used both for load-on-mount hydration and for import — same "here is the full state" semantics
  | { type: 'LOG_WORKOUT'; workoutLog: WorkoutLog }

export function appReducer(state: PersistedState, action: AppAction): PersistedState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: action.profile }
    case 'CREATE_GOAL':
      return {
        ...state,
        goals: [...state.goals, action.goal],
        specializationBlocks: [...state.specializationBlocks, action.specializationBlock],
      }
    case 'REPLACE_STATE':
      return action.state
    case 'LOG_WORKOUT':
      return { ...state, workoutLogs: [...state.workoutLogs, action.workoutLog] }
    default:
      return state
  }
}
