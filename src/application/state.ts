import type { UserProfile } from '../domain/profile/types'
import type { Goal } from '../domain/goals/types'
import type { SpecializationBlock } from '../domain/specialization/types'
import type { WorkoutLog } from '../domain/workoutLog/types'

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
  /**
   * When the user confirmed this plan on "План сесії" -- the session's
   * real start time, used by FinishSessionTab to compute actual training
   * duration (minus any non-training time the user deducts before
   * submitting). Optional so older persisted/imported state and existing
   * fixtures without it still validate; its absence is exactly the signal
   * FinishSessionTab uses to skip duration tracking gracefully rather than
   * showing a nonsense number.
   */
  confirmedAt?: string
  /**
   * How many of `availableMinutes` go to the pool rather than the gym --
   * item 3 from real-usage feedback (auto-split time between gym and
   * pool). The gym-exercise time budget passed to `assembleTodaysSession`
   * is `availableMinutes - poolMinutes`, computed identically on both
   * "План сесії" and "Завершити" so they never assemble different
   * sessions from the same confirmed inputs. Optional, defaults to 0 when
   * absent (older persisted state, fixtures).
   */
  poolMinutes?: number
}

export interface PersistedState {
  profile: UserProfile | null
  goals: Goal[]
  specializationBlocks: SpecializationBlock[]
  workoutLogs: WorkoutLog[]
  confirmedSessionInputs: ConfirmedSessionInputs | null
}

/** Gym-exercise time budget after subtracting pool time -- the single source of truth both "План сесії" and "Завершити" use so they never assemble different sessions from the same confirmed inputs. */
export function gymMinutesFrom(inputs: ConfirmedSessionInputs): number {
  return Math.max(0, inputs.availableMinutes - (inputs.poolMinutes ?? 0))
}

export const INITIAL_STATE: PersistedState = {
  profile: null,
  goals: [],
  specializationBlocks: [],
  workoutLogs: [],
  confirmedSessionInputs: null,
}

/** Runtime shape check for imported JSON — see ui/SetupScreen.tsx's import flow. Deliberately loose (checks top-level keys/types only, not deep validation) since this only guards against importing an unrelated/corrupt file, not a full schema validator. Extra unknown fields (e.g. weighIns/circumferenceMeasurements in a backup exported before that dead schema was removed) are harmlessly ignored, not rejected. */
export function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.profile === null || typeof v.profile === 'object') &&
    Array.isArray(v.goals) &&
    Array.isArray(v.specializationBlocks) &&
    Array.isArray(v.workoutLogs) &&
    (v.confirmedSessionInputs === null ||
      v.confirmedSessionInputs === undefined ||
      typeof v.confirmedSessionInputs === 'object')
  )
}
