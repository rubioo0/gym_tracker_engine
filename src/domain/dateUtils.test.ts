import { describe, expect, it } from 'vitest'
import { localDateKey, parseLocalDateKey } from './dateUtils'

describe('localDateKey', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    expect(localDateKey(new Date(2026, 7, 5))).toBe('2026-08-05')
  })

  it('pads single-digit month and day', () => {
    expect(localDateKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('accepts a full ISO timestamp string', () => {
    expect(localDateKey('2026-08-25T12:00:00.000Z')).toBe(localDateKey(new Date('2026-08-25T12:00:00.000Z')))
  })
})

describe('parseLocalDateKey', () => {
  it('round-trips through localDateKey', () => {
    const key = '2026-08-25'
    expect(localDateKey(parseLocalDateKey(key))).toBe(key)
  })

  it('parses at local midnight, not UTC midnight', () => {
    const parsed = parseLocalDateKey('2026-08-25')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(7)
    expect(parsed.getDate()).toBe(25)
    expect(parsed.getHours()).toBe(0)
  })
})
