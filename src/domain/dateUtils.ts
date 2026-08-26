/**
 * Local (not UTC) calendar-day key, e.g. "2026-08-25" for whatever day the
 * given instant falls on in the browser's own timezone. Distinct from
 * `date.toISOString().slice(0, 10)`, which returns the UTC calendar day and
 * can land on a different date near midnight for any non-UTC user — a
 * workout logged at 23:00 local time can cross into the next UTC day,
 * silently shifting which ACWR window/calendar cell it's counted in.
 */
export function localDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a "YYYY-MM-DD" local-date-key back into a Date at LOCAL midnight —
 * the inverse of localDateKey. Deliberately not `new Date(key)`: a bare
 * date-only string is parsed as UTC midnight per the ECMAScript spec, which
 * would silently reintroduce the same UTC/local mismatch this module exists
 * to avoid.
 */
export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
