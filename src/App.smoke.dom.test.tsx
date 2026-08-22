// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { EngineStateProvider } from './components/engine/EngineStateProvider'
import type { TrainingDataRepository } from './application/repository'

/**
 * Component-level smoke tests, added after a real regression this session
 * (the merged "Today" content silently failed to render, and every
 * existing test — all pure-function/reducer-level — passed anyway, because
 * none of them ever actually rendered a component). These render the real
 * App tree and click through tabs, so a blank-page-class bug fails a test
 * instead of only surfacing when a person happens to look at the browser.
 *
 * Storage is fully disposable and never touches real browser data:
 * - The old app's reducer reads/writes via `localStorage`, which jsdom
 *   provides as a fresh in-memory implementation per test run — not the
 *   real browser's storage for this origin.
 * - The engine's `EngineStateProvider` takes an injectable in-memory stub
 *   repository here instead of the real IndexedDB adapter, so no IndexedDB
 *   is touched at all (jsdom doesn't implement it, and doesn't need to).
 */
function disposableEngineRepository(): TrainingDataRepository {
  return {
    loadState: async () => null,
    saveState: async () => {},
  }
}

function renderApp() {
  return render(
    <EngineStateProvider repository={disposableEngineRepository()}>
      <App />
    </EngineStateProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('App smoke test', () => {
  it('renders the tab bar with the original tabs plus only the new Setup tab (Today was merged into План сесії)', () => {
    renderApp()
    for (const label of [
      'Головна',
      'Програми',
      'Тренування',
      'План сесії',
      'Завершити',
      'Історія',
      'Календар',
      'Статистика',
      'Фото',
      'Дані',
      'Автопрофіль',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: 'Сьогодні' })).toBeNull()
  })

  it('shows the home tab by default without throwing', () => {
    renderApp()
    expect(screen.getByText('Training Control Panel')).toBeTruthy()
  })

  it('"План сесії" now shows the engine-driven Today content, not the old SessionPlanPanel', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    // Fresh disposable state has no engine profile yet, so the engine's own
    // guidance message should appear -- proof this tab is wired to the new
    // engine, not the old plannedSession/SessionPlanPanel logic.
    expect(await screen.findByText('Set up your profile first, on the Setup tab.')).toBeTruthy()
  })

  it('"Автопрофіль" renders the profile setup form', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Автопрофіль' }))
    // The engine's "loaded" flag flips asynchronously (even the disposable
    // stub repository resolves via a microtask), so this needs findBy*
    // rather than getBy* to wait past the initial "Loading…" render.
    expect(await screen.findByText('Profile')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeTruthy()
  })

  it('"Дані" (Data) tab renders without throwing', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(screen.getByText('Import / Data Management')).toBeTruthy()
  })
})
