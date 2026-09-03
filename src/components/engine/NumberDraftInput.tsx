import type { InputHTMLAttributes } from 'react'
import { useNumberDraft } from './useNumberDraft'

interface NumberDraftInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'onBlur'> {
  value: number | undefined
  onCommit: (parsed: number | undefined) => void
  /** Allow the field to be blanked out (commits `undefined` when left empty). Defaults to false — an empty/invalid draft just reverts to the last committed value on blur instead. */
  optional?: boolean
}

/** Drop-in replacement for `<input type="number">` that fixes the controlled-input digit-garbling bug — see useNumberDraft.ts for the root cause. Usable both at a component's top level and inside a `.map()` (each instance owns its own hook state, unlike calling the hook directly in a loop). */
export function NumberDraftInput({ value, onCommit, optional, ...rest }: NumberDraftInputProps) {
  const draft = useNumberDraft(value, onCommit, { optional })
  return <input type="number" {...rest} value={draft.value} onChange={draft.onChange} onBlur={draft.onBlur} />
}
