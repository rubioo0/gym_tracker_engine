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
 *
 * Deliberately no "in-progress session" LOCK of any kind — matching the old
 * app's own model (its FocusRun.status='active' is a cheap, reversible
 * flag, not a lock; its Log tab reads a freshly-recomputed plan plus purely
 * ephemeral, page-local form state that's never persisted). An earlier
 * version of this file had a `draftSession` field that blocked "План сесії"
 * until it was finished or explicitly discarded — that produced a real
 * dead-end (started a workout, closed the tab, came back to a permanently
 * "in progress" screen). See application/sessionPrescription.ts and
 * components/engine/FinishSessionTab.tsx for how logging now works instead:
 * both screens recompute today's plan fresh from goals/specializationBlocks/
 * workoutLogs below, and FinishSessionTab holds its in-progress edits in
 * ordinary component state, exactly like the old app's exerciseInputs.
 *
 * `confirmedSessionInputs` is NOT a lock either — it never blocks any
 * screen or requires a "discard" — it's just the last time-budget/gym-access
 * answer the user gave on "План сесії", remembered so a casual revisit (nav
 * away and back) keeps showing the same plan instead of silently re-asking
 * and possibly assembling a different one. The explicit "Change time /
 * location" control always remains available to deliberately answer
 * differently. Cleared once the session is actually logged (LOG_WORKOUT),
 * ready to ask fresh for the next one — matching the app's "today means your
 * next unlogged session" design (session-count-based, not calendar-based).
 */
export interface ConfirmedSessionInputs {
  availableMinutes: number
  noGymToday: boolean
}

export interface PersistedState {
  profile: UserProfile | null
  goals: Goal[]
  specializationBlocks: SpecializationBlock[]
  workoutLogs: WorkoutLog[]
  weighIns: WeighIn[]
  circumferenceMeasurements: CircumferenceMeasurement[]
  confirmedSessionInputs: ConfirmedSessionInputs | null
}

export const INITIAL_STATE: PersistedState = {
  profile: null,
  goals: [],
  specializationBlocks: [],
  workoutLogs: [],
  weighIns: [],
  circumferenceMeasurements: [],
  confirmedSessionInputs: null,
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
    (v.confirmedSessionInputs === null ||
      v.confirmedSessionInputs === undefined ||
      typeof v.confirmedSessionInputs === 'object')
  )
}
