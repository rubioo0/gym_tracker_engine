import { openDB } from 'idb'

export interface ExercisePhoto {
  exerciseId: string
  dataUrl: string
  savedAt: string
}

/**
 * A separate IndexedDB from photoStorage.ts's 'gem3' progress-photo store,
 * not a second object store bolted onto it -- that would require bumping
 * the shared database's version, and any later call to photoStorage.ts's
 * `openDB('gem3', 1)` would then throw (IndexedDB rejects opening at a
 * version lower than the database's current one). A dedicated database
 * has no such coupling.
 */
const DB_NAME = 'gem3-exercise-photos'
const STORE = 'exercisePhotos'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'exerciseId' })
    },
  })
}

/** One photo per exercise -- saving again overwrites the previous one (attaches permanently to the exercise, per the user's confirmed choice, but is always replaceable if they photographed the wrong machine). */
export async function saveExercisePhoto(exerciseId: string, dataUrl: string): Promise<void> {
  const db = await getDb()
  const photo: ExercisePhoto = { exerciseId, dataUrl, savedAt: new Date().toISOString() }
  await db.put(STORE, photo)
}

export async function loadExercisePhoto(exerciseId: string): Promise<ExercisePhoto | undefined> {
  const db = await getDb()
  return db.get(STORE, exerciseId)
}

export async function deleteExercisePhoto(exerciseId: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, exerciseId)
}
