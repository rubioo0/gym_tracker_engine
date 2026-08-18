import { describe, expect, it } from 'vitest'
import { assignMusclesToSessions } from './sessionSplit'

describe('assignMusclesToSessions (worked example from sessionAssembly.md)', () => {
  it('puts the focus muscle in every session and round-robins maintenance muscles', () => {
    const result = assignMusclesToSessions('chest', ['back', 'biceps', 'triceps', 'quads'], 3)
    expect(result).toEqual([
      { sessionIndex: 0, muscles: ['chest', 'back', 'quads'] },
      { sessionIndex: 1, muscles: ['chest', 'biceps'] },
      { sessionIndex: 2, muscles: ['chest', 'triceps'] },
    ])
  })

  it('gives every session just the focus muscle when there are no maintenance muscles (boundary condition)', () => {
    const result = assignMusclesToSessions('chest', [], 2)
    expect(result).toEqual([
      { sessionIndex: 0, muscles: ['chest'] },
      { sessionIndex: 1, muscles: ['chest'] },
    ])
  })

  it('produces exactly one session for sessionsPerWeek = 1 (boundary condition)', () => {
    const result = assignMusclesToSessions('chest', ['back'], 1)
    expect(result).toEqual([{ sessionIndex: 0, muscles: ['chest', 'back'] }])
  })

  it('throws for a non-positive sessionsPerWeek (boundary condition)', () => {
    expect(() => assignMusclesToSessions('chest', [], 0)).toThrow()
    expect(() => assignMusclesToSessions('chest', [], -1)).toThrow()
  })
})
