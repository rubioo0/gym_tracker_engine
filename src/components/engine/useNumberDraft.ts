import { useState, type ChangeEvent } from 'react'

function formatValue(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

/**
 * Tracks a `type="number"` input's raw typed string as local state instead
 * of deriving the displayed value straight from a number — fixes a real
 * bug reported after live use: typing "9" then "0" over an existing value
 * could render back as "090" instead of "90".
 *
 * Root cause: React's controlled-input reconciliation only rewrites a
 * DOM node's `value` when the new committed value differs from the last
 * one it wrote. If two different keystrokes happen to parse to the same
 * number (or the field briefly round-trips through an unchanged value),
 * React skips the DOM write and the browser's own (sometimes stale, and
 * on iOS Safari sometimes caret-confused) displayed string is left as-is.
 * Keeping a plain string draft sidesteps this entirely: the draft changes
 * on every keystroke, so React always has a reason to sync the DOM.
 */
export function useNumberDraft(
  value: number | undefined,
  onCommit: (parsed: number | undefined) => void,
  options: { optional?: boolean } = {},
) {
  const [draft, setDraft] = useState(formatValue(value))
  // Tracks the last `value` we've rendered a draft for, so a change coming
  // from outside this input (a reset, a sibling control) can be noticed and
  // re-synced *during* render -- React's documented alternative to an
  // effect for "adjust state when a prop changes" (avoids an extra
  // commit-then-effect render pass, and setState-in-effect lint noise).
  const [lastSyncedValue, setLastSyncedValue] = useState(value)
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value)
    setDraft(formatValue(value))
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setDraft(raw)

    if (raw.trim() === '') {
      if (options.optional) onCommit(undefined)
      return
    }

    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) {
      onCommit(parsed)
    }
  }

  function onBlur() {
    if (draft.trim() === '' && options.optional) return
    const parsed = Number(draft)
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      // Invalid/blank on blur: revert the visible draft to the last real committed value.
      setDraft(formatValue(value))
    }
  }

  return { value: draft, onChange, onBlur }
}
