import type { MuscleGroupId } from '../muscles/muscleTaxonomy'

export interface SessionMuscleAssignment {
  sessionIndex: number
  muscles: MuscleGroupId[]
}

/**
 * See sessionAssembly.md "Session split derivation" for the worked example.
 * The focus muscle appears in every session; each maintenance muscle
 * appears in exactly one session, round-robin by input order.
 */
export function assignMusclesToSessions(
  focusMuscle: MuscleGroupId,
  maintenanceMuscles: readonly MuscleGroupId[],
  sessionsPerWeek: number,
): SessionMuscleAssignment[] {
  if (sessionsPerWeek <= 0) {
    throw new Error('sessionsPerWeek must be positive')
  }
  const sessions: SessionMuscleAssignment[] = Array.from({ length: sessionsPerWeek }, (_, i) => ({
    sessionIndex: i,
    muscles: [focusMuscle],
  }))
  maintenanceMuscles.forEach((muscle, i) => {
    sessions[i % sessionsPerWeek].muscles.push(muscle)
  })
  return sessions
}
