import { useContext } from 'react'
import { EngineStateContext, type EngineStateContextValue } from './engineStateContext'

export function useEngineState(): EngineStateContextValue {
  const context = useContext(EngineStateContext)
  if (!context) {
    throw new Error('useEngineState must be used within an EngineStateProvider')
  }
  return context
}
