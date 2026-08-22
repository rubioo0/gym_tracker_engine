import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { ExerciseDifficulty, SetEntry, WorkoutLog } from '../domain/workoutLog/types'
import type { WeighIn, CircumferenceMeasurement } from '../domain/measurements/types'
import type { MuscleGroupId } from '../domain/muscles/muscleTaxonomy'

/**
 * A workout that's been started (session assembled, prescription generated)
 * but not yet finished — the missing link between "План сесії" (assembles
 * and starts it) and "Завершити" (logs actual performance and finishes it).
 * Persisted (not just in-memory React state) so it survives a tab switch
 * or a page reload mid-workout, matching the old app's own resilience for
 * an in-progress FocusRun session. There is at most one at a time — no
 * concept of starting a second session before finishing/discarding this one.
 */
export interface DraftExerciseLog {
  exerciseId: string
  sets: SetEntry[]
  skipped: boolean
  difficulty?: ExerciseDifficulty
}

export interface DraftSession {
  startedAt: string // ISO timestamp
  focusMuscle: MuscleGroupId
  exerciseLogs: DraftExerciseLog[]
}

/**
 * Everything persisted between sessions. A single blob in one IndexedDB
 * record (see infrastructure/storage/indexedDbRepository.ts) rather than
 * multiple object stores/indexes — this is a single-user app with no
 * cross-cutting queries IndexedDB indexing would help with; all real
 * queries (per-muscle history, etc.) are computed by the domain layer's
 * pure functions over this loaded blob, not by the storage layer. Also
 * exactly what export/import serializes — see ui/SetupScreen.tsx.
 */
export interface PersistedState {
  profile: UserProfile | null
  goals: Goal[]
  specializationBlocks: SpecializationBlock[]
  workoutLogs: WorkoutLog[]
  weighIns: WeighIn[]
  circumferenceMeasurements: CircumferenceMeasurement[]
  draftSession: DraftSession | null
}

export const INITIAL_STATE: PersistedState = {
  profile: null,
  goals: [],
  specializationBlocks: [],
  workoutLogs: [],
  weighIns: [],
  circumferenceMeasurements: [],
  draftSession: null,
}

/** Runtime shape check for imported JSON — see ui/SetupScreen.tsx's import flow. Deliberately loose (checks top-level keys/types only, not deep validation) since this only guards against importing an unrelated/corrupt file, not a full schema validator. */
export function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.profile === null || typeof v.profile === 'object') &&
    Array.isArray(v.goals) &&
    Array.isArray(v.specializationBlocks) &&
    Array.isArray(v.workoutLogs) &&
    Array.isArray(v.weighIns) &&
    Array.isArray(v.circumferenceMeasurements) &&
    (v.draftSession === null || v.draftSession === undefined || typeof v.draftSession === 'object')
  )
}
