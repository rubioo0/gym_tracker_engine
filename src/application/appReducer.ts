import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { ConfirmedSessionInputs, PersistedState } from './state'

/**
 * Actions carry fully-constructed values (goal/specializationBlock/workoutLog
 * already built by the caller, ids/timestamps already generated) rather than
 * raw inputs — keeps the reducer itself a pure, deterministic state
 * transition with no id/date generation inside it. That impure work
 * belongs in the UI event handler that dispatches the action, not here.
 * LOG_WORKOUT mirrors the old app's own `logSession` reducer case
 * (domain/reducer.ts) exactly in spirit: one atomic "append this finished
 * workout" action, no separate start/draft/discard lifecycle around it.
 * CONFIRM_SESSION_INPUTS is not a lock (see state.ts's doc comment on
 * `confirmedSessionInputs`) — just remembering the last time/gym answer.
 * END_GOAL is the manual counterpart to the automatic renewal triggers in
 * goalStatus.ts (deadline passed / target met / focus muscle injured) —
 * lets the user deliberately abandon the active goal/block instead of
 * waiting for one of those to fire.
 */
export type AppAction =
  | { type: 'SET_PROFILE'; profile: UserProfile }
  | { type: 'CREATE_GOAL'; goal: Goal; specializationBlock: SpecializationBlock }
  | { type: 'REPLACE_STATE'; state: PersistedState } // used both for load-on-mount hydration and for import — same "here is the full state" semantics
  | { type: 'LOG_WORKOUT'; workoutLog: WorkoutLog }
  | { type: 'CONFIRM_SESSION_INPUTS'; inputs: ConfirmedSessionInputs }
  | { type: 'END_GOAL'; endedAt: string }

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
      // Clears confirmedSessionInputs too: this session is done, so the next
      // visit to "План сесії" should ask fresh for the next one rather than
      // keep reusing today's now-completed answer.
      return { ...state, workoutLogs: [...state.workoutLogs, action.workoutLog], confirmedSessionInputs: null }
    case 'CONFIRM_SESSION_INPUTS':
      return { ...state, confirmedSessionInputs: action.inputs }
    case 'END_GOAL':
      return {
        ...state,
        specializationBlocks: state.specializationBlocks.map((block) =>
          block.endedAt === null ? { ...block, endedAt: action.endedAt } : block,
        ),
      }
    default:
      return state
  }
}
