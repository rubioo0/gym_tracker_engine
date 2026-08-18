import { describe, expect, it } from 'vitest'
import { buildFocusHistorySeed } from './focusHistory'
import { MUSCLE_GROUPS } from '../domain/muscles/muscleTaxonomy'
import type { SpecializationBlock } from '../domain/specialization/types'

describe('buildFocusHistorySeed', () => {
  it('seeds every muscle as never-focused (null) when there is no block history', () => {
    const result = buildFocusHistorySeed([], [])
    expect(result).toHaveLength(MUSCLE_GROUPS.length)
    expect(result.every((entry) => entry.lastFocusEndedAt === null)).toBe(true)
  })

  it('excludes injured muscles entirely from the candidate list', () => {
    const result = buildFocusHistorySeed([], ['back', 'chest'])
    expect(result).toHaveLength(MUSCLE_GROUPS.length - 2)
    expect(result.some((e) => e.muscleGroupId === 'back' || e.muscleGroupId === 'chest')).toBe(false)
  })

  it('uses the most recent ended block for a muscle with multiple past blocks', () => {
    const blocks: SpecializationBlock[] = [
      { goalId: 'g1', focusMuscle: 'chest', startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-02-01T00:00:00.000Z' },
      { goalId: 'g2', focusMuscle: 'chest', startedAt: '2026-06-01T00:00:00.000Z', endedAt: '2026-07-01T00:00:00.000Z' },
    ]
    const result = buildFocusHistorySeed(blocks, [])
    const chest = result.find((e) => e.muscleGroupId === 'chest')
    expect(chest?.lastFocusEndedAt).toBe('2026-07-01T00:00:00.000Z')
  })

  it('ignores a still-active (not-yet-ended) block — does not count as a "last focus ended" date (boundary condition)', () => {
    const blocks: SpecializationBlock[] = [
      { goalId: 'g1', focusMuscle: 'chest', startedAt: '2026-08-01T00:00:00.000Z', endedAt: null },
    ]
    const result = buildFocusHistorySeed(blocks, [])
    const chest = result.find((e) => e.muscleGroupId === 'chest')
    expect(chest?.lastFocusEndedAt).toBeNull()
  })
})
