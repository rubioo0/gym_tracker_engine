import { createContext, type Dispatch } from 'react'
import type { AppAction } from '../../application/appReducer'
import type { PersistedState } from '../../application/state'

export interface EngineStateContextValue {
  state: PersistedState
  dispatch: Dispatch<AppAction>
  /** False until the initial load-from-repository attempt has completed — screens can use this to show a loading state instead of briefly rendering INITIAL_STATE as if it were real. */
  loaded: boolean
}

export const EngineStateContext = createContext<EngineStateContextValue | null>(null)
