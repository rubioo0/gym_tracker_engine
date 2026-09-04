/**
 * Full per-set actual-performance capture — see plan doc "Decisions
 * locked": "Actual-performance logging: full per-set (weight + reps
 * each)". This is the raw data every downstream phase (APRE, ACWR,
 * volume landmarks, goal projection) reads from; it captures only what
 * was actually performed, not any planned/target values.
 */
export type SetRole = 'ramp' | 'working'

export interface SetEntry {
  weightKg: number
  reps: number
  /**
   * 'working' for a real working set; 'ramp' for an APRE-style warm-up/ramp
   * set (see plan doc: "APRE ramp sets & volume counting: ramp sets
   * excluded from the weekly volume budget"). Exercises not driven by APRE
   * (e.g. maintenance-mode "repeat last weight") have no ramp sets at all —
   * every logged set there is 'working'.
   */
  role: SetRole
}

/** Matches the old app's ExerciseDifficulty; kept manual per the "session
 * success flag: stays manual" decision — this is the per-exercise analogue.
 */
export type ExerciseDifficulty = 'easy' | 'okay' | 'hard'

export interface ExerciseLog {
  exerciseId: string
  sets: SetEntry[]
  skipped: boolean
  difficulty?: ExerciseDifficulty
  note?: string
}

export interface WorkoutLog {
  id: string
  completedAt: string // ISO timestamp
  exerciseLogs: ExerciseLog[]
  /** Manual, not auto-derived from performance — see plan doc "Session
   * success flag: stays manual". */
  successful: boolean
  note?: string
  /**
   * Duration tracking (item 2 from real-usage feedback): `startedAt` is
   * copied from `ConfirmedSessionInputs.confirmedAt` at log time,
   * `deductedMinutes` is whatever non-training time the user subtracted
   * (bathroom break, chatting, etc.) on the finish screen, and
   * `activeMinutes` is the resulting `completedAt - startedAt` minus that
   * deduction. All three are omitted together when there was no captured
   * start time (e.g. logging without ever visiting "План сесії" first) —
   * there is deliberately no way to have one without the others.
   */
  startedAt?: string
  deductedMinutes?: number
  activeMinutes?: number
}
