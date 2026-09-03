import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { appReducer } from '../../application/appReducer'
import { INITIAL_STATE } from '../../application/state'
import type { TrainingDataRepository } from '../../application/repository'
import { IndexedDbTrainingDataRepository } from '../../infrastructure/storage/indexedDbRepository'
import { EngineStateContext } from './engineStateContext'

/**
 * State/persistence for the autonomous-engine tabs (Setup/Today), kept
 * fully independent from the app's original `appReducer`/`storage.ts` —
 * separate reducer, separate IndexedDB database (`training-engine`, vs the
 * original app's localStorage + its own `gem3` photo DB) — so nothing here
 * can affect the existing tabs' data.
 */
export function EngineStateProvider({
  children,
  repository = new IndexedDbTrainingDataRepository(),
}: {
  children: ReactNode
  /** Injectable for testing; defaults to the real IndexedDB adapter. */
  repository?: TrainingDataRepository
}) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let cancelled = false
    repository
      .loadState()
      .then((loadedState) => {
        if (cancelled) return
        if (loadedState) {
          dispatch({ type: 'REPLACE_STATE', state: loadedState })
        }
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    repository
      .saveState(state)
      .then(() => {
        if (!cancelled) setSaveError(false)
      })
      .catch(() => {
        if (!cancelled) setSaveError(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded])

  return (
    <EngineStateContext.Provider value={{ state, dispatch, loaded }}>
      {loadError ? (
        <p role="alert" style={BANNER_STYLE}>
          Не вдалося завантажити збережені дані тренувань. Перезавантажте сторінку, щоб спробувати ще раз — ваші дані не стерто.
        </p>
      ) : null}
      {saveError ? (
        <p role="alert" style={BANNER_STYLE}>
          Не вдалося зберегти останню зміну — вона може бути втрачена, якщо закрити цю вкладку. Перевірте вільне місце на пристрої та спробуйте ще раз.
        </p>
      ) : null}
      {children}
    </EngineStateContext.Provider>
  )
}

const BANNER_STYLE = {
  margin: 0,
  padding: '0.5rem 1rem',
  background: '#7a1f1f',
  color: '#fff',
  textAlign: 'center' as const,
  fontSize: '0.9rem',
}
