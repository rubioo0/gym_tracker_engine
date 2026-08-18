/**
 * Body measurements — per the locked decision: "flexible cadence,
 * informational only... measurements stay a supporting signal, not a
 * tracked goal or a cross-check on the deficit modifier." No fixed
 * schedule is modeled; entries are logged whenever the user chooses to.
 */

export type BodyPart = 'waist' | 'chest' | 'hips' | 'bicep' | 'thigh' | 'neck'

export interface WeighIn {
  id: string
  date: string // ISO
  weightKg: number
}

export interface CircumferenceMeasurement {
  id: string
  date: string // ISO
  bodyPart: BodyPart
  circumferenceCm: number
}
