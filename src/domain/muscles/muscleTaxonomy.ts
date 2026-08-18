/**
 * The fixed set of trainable muscle groups. See muscleTaxonomy.md for why
 * this granularity and this exact list were chosen.
 */
export type MuscleGroupId =
  | 'chest'
  | 'back'
  | 'traps'
  | 'front_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'neck'

export type MuscleGroupSize = 'large' | 'small'

export interface MuscleGroupDefinition {
  id: MuscleGroupId
  labelEn: string
  labelUk: string
  size: MuscleGroupSize
  /**
   * Two-tier extensibility hook: optional finer sub-muscle tags (e.g. back ->
   * ['lats', 'rhomboids', 'lower-back']). Not populated in v1 — see
   * muscleTaxonomy.md "Two-tier extensibility".
   */
  detail?: string[]
}

export const MUSCLE_GROUPS: readonly MuscleGroupDefinition[] = [
  { id: 'chest', labelEn: 'Chest', labelUk: 'Груди', size: 'large' },
  { id: 'back', labelEn: 'Back', labelUk: 'Спина', size: 'large' },
  { id: 'traps', labelEn: 'Trapezius', labelUk: 'Трапеції', size: 'small' },
  { id: 'front_delts', labelEn: 'Front Deltoids', labelUk: 'Передні дельти', size: 'small' },
  { id: 'rear_delts', labelEn: 'Rear Deltoids', labelUk: 'Задні дельти', size: 'small' },
  { id: 'biceps', labelEn: 'Biceps', labelUk: 'Біцепс', size: 'small' },
  { id: 'triceps', labelEn: 'Triceps', labelUk: 'Трицепс', size: 'small' },
  { id: 'forearms', labelEn: 'Forearms', labelUk: 'Передпліччя', size: 'small' },
  { id: 'abs', labelEn: 'Abs', labelUk: 'Прес', size: 'small' },
  { id: 'obliques', labelEn: 'Obliques', labelUk: 'Косі м’язи', size: 'small' },
  { id: 'quads', labelEn: 'Quadriceps', labelUk: 'Квадрицепс', size: 'large' },
  { id: 'hamstrings', labelEn: 'Hamstrings', labelUk: 'Біцепс стегна', size: 'large' },
  { id: 'glutes', labelEn: 'Glutes', labelUk: 'Сідниці', size: 'large' },
  { id: 'calves', labelEn: 'Calves', labelUk: 'Литки', size: 'small' },
  { id: 'adductors', labelEn: 'Adductors', labelUk: 'Привідні м’язи стегна', size: 'small' },
  { id: 'abductors', labelEn: 'Abductors', labelUk: 'Відвідні м’язи стегна', size: 'small' },
  { id: 'neck', labelEn: 'Neck', labelUk: 'Шия', size: 'small' },
]

const MUSCLE_GROUP_BY_ID: ReadonlyMap<MuscleGroupId, MuscleGroupDefinition> = new Map(
  MUSCLE_GROUPS.map((group) => [group.id, group]),
)

export function getMuscleGroup(id: MuscleGroupId): MuscleGroupDefinition {
  const group = MUSCLE_GROUP_BY_ID.get(id)
  if (!group) {
    throw new Error(`Unknown muscle group id: ${id}`)
  }
  return group
}

export function isLargeMuscleGroup(id: MuscleGroupId): boolean {
  return getMuscleGroup(id).size === 'large'
}
