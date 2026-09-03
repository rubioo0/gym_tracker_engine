// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { NumberDraftInput } from './NumberDraftInput'

afterEach(() => cleanup())

function RequiredHarness({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial)
  const [commits, setCommits] = useState<number[]>([])
  return (
    <>
      <NumberDraftInput
        aria-label="num"
        value={value}
        onCommit={(n) => {
          if (n === undefined) return
          setValue(n)
          setCommits((prev) => [...prev, n])
        }}
      />
      <output data-testid="commits">{commits.join(',')}</output>
    </>
  )
}

function OptionalHarness({ initial }: { initial: number | undefined }) {
  const [value, setValue] = useState<number | undefined>(initial)
  return (
    <>
      <NumberDraftInput aria-label="num" optional value={value} onCommit={setValue} />
      <output data-testid="value">{value === undefined ? 'undefined' : value}</output>
    </>
  )
}

describe('NumberDraftInput', () => {
  it('commits the correctly parsed number for a value with a leading zero (e.g. typed "090")', () => {
    // Note: a native `type="number"` DOM node sanitizes its own `.value`
    // getter (strips the leading zero) regardless of framework -- that part
    // is out of JS's control and harmless (090 === 90 numerically). What
    // this hook actually fixes is React's controlled-input DOM-write skip:
    // see the next test.
    render(<RequiredHarness initial={45} />)
    const input = screen.getByLabelText('num') as HTMLInputElement
    fireEvent.change(input, { target: { value: '090' } })
    expect(screen.getByTestId('commits').textContent).toBe('90')
  })

  it('re-syncs the displayed value on every keystroke, even when the parsed number round-trips to the same committed value as before (the actual React skip-write scenario the bug report described)', () => {
    // Typing "450" then "45": the final commit (45) equals the ORIGINAL
    // initial value. A plain `value={numberState}` controlled input can
    // leave a stale/garbled DOM string in exactly this case, because React
    // sees the committed value is unchanged from what it last wrote and
    // skips touching the DOM node. Because this hook re-derives `draft`
    // (and therefore the rendered `value`) from a string that changes on
    // every keystroke, the field always ends up showing the correct digits.
    render(<RequiredHarness initial={45} />)
    const input = screen.getByLabelText('num') as HTMLInputElement
    fireEvent.change(input, { target: { value: '450' } })
    expect(input.value).toBe('450')
    fireEvent.change(input, { target: { value: '45' } })
    expect(input.value).toBe('45')
    expect(screen.getByTestId('commits').textContent).toBe('450,45')
  })

  it('reverts to the last committed value on blur when left empty (required field)', () => {
    render(<RequiredHarness initial={45} />)
    const input = screen.getByLabelText('num') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    fireEvent.blur(input)
    expect(input.value).toBe('45')
  })

  it('commits undefined when cleared and optional', () => {
    render(<OptionalHarness initial={30} />)
    const input = screen.getByLabelText('num') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByTestId('value').textContent).toBe('undefined')
    fireEvent.blur(input)
    expect(input.value).toBe('')
  })
})
