import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'
import type { WeighIn, CircumferenceMeasurement } from '../domain/measurements/types'

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
}

export const INITIAL_STATE: PersistedState = {
  profile: null,
  goals: [],
  specializationBlocks: [],
  workoutLogs: [],
  weighIns: [],
  circumferenceMeasurements: [],
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
    Array.isArray(v.circumferenceMeasurements)
  )
}
