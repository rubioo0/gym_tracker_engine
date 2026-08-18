/**
 * Training-emphasis is a separate, independent axis from the profile's
 * deficitLabel (body-composition phase) — see plan doc "Existing `mode`/
 * `track` fields... Target rep count selection" clarification: "training
 * emphasis (strength/hypertrophy...) and 'goal type' (mass gain/
 * maintenance/fat loss...) are two separate, independent fields... You
 * could, for example, be in a cut phase while training in a
 * strength-focused rep range at the same time."
 */
export type TrainingEmphasis = 'strength' | 'hypertrophy'

/**
 * A per-exercise strength goal — see plan doc "Goal semantics: per-exercise
 * strength target + deadline (not body-composition)" and "Goal shape: all
 * goals are incremental... no separate single-event/peak-performance goal
 * type".
 */
export interface Goal {
  id: string
  exerciseId: string
  startingWeightKg: number
  targetWeightKg: number
  deadline: string // ISO date
  createdAt: string // ISO date
  trainingEmphasis: TrainingEmphasis
}
