import { openDB, type IDBPDatabase } from 'idb'
import type { TrainingDataRepository } from '../../application/repository'
import type { PersistedState } from '../../application/state'

const DB_NAME = 'training-engine'
const DB_VERSION = 1
const STORE_NAME = 'state'
const STATE_KEY = 'app-state'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

/**
 * Whole-app-state persisted as a single record in one object store — see
 * application/state.ts's PersistedState doc comment for why a single blob
 * rather than multiple stores/indexes.
 */
export class IndexedDbTrainingDataRepository implements TrainingDataRepository {
  async loadState(): Promise<PersistedState | null> {
    const db = await getDb()
    const state = await db.get(STORE_NAME, STATE_KEY)
    return (state as PersistedState | undefined) ?? null
  }

  async saveState(state: PersistedState): Promise<void> {
    const db = await getDb()
    await db.put(STORE_NAME, state, STATE_KEY)
  }
}
