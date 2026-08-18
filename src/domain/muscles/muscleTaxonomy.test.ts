import { describe, expect, it } from 'vitest'
import {
  MUSCLE_GROUPS,
  getMuscleGroup,
  isLargeMuscleGroup,
  type MuscleGroupId,
} from './muscleTaxonomy'

// Golden-master: the exact set is a deliberate design decision (see
// muscleTaxonomy.md), not something that should silently drift as entries
// are added/removed/renamed.
const EXPECTED_LARGE: MuscleGroupId[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes']

describe('MUSCLE_GROUPS', () => {
  it('has exactly 17 entries', () => {
    expect(MUSCLE_GROUPS).toHaveLength(17)
  })

  it('has no duplicate ids', () => {
    const ids = MUSCLE_GROUPS.map((group) => group.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has non-empty English and Ukrainian labels', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(group.labelEn.length).toBeGreaterThan(0)
      expect(group.labelUk.length).toBeGreaterThan(0)
    }
  })

  it('marks exactly chest/back/quads/hamstrings/glutes as large, per program-design convention', () => {
    const large = MUSCLE_GROUPS.filter((g) => g.size === 'large').map((g) => g.id)
    expect(large.sort()).toEqual([...EXPECTED_LARGE].sort())
  })

  it('leaves the two-tier "detail" hook unpopulated in v1', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(group.detail).toBeUndefined()
    }
  })
})

describe('getMuscleGroup', () => {
  it('returns the matching definition', () => {
    expect(getMuscleGroup('chest').labelEn).toBe('Chest')
  })

  it('throws on an unknown id (defensive — should be unreachable given the MuscleGroupId type)', () => {
    // @ts-expect-error intentionally invalid id to test the runtime guard
    expect(() => getMuscleGroup('not-a-muscle')).toThrow()
  })
})

describe('isLargeMuscleGroup', () => {
  describe.each(EXPECTED_LARGE)('%s', (id) => {
    it('is large', () => {
      expect(isLargeMuscleGroup(id)).toBe(true)
    })
  })

  it('biceps is small (not large)', () => {
    expect(isLargeMuscleGroup('biceps')).toBe(false)
  })
})
