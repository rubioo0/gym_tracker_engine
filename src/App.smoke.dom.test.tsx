// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { EngineStateProvider } from './components/engine/EngineStateProvider'
import type { TrainingDataRepository } from './application/repository'
import type { PersistedState } from './application/state'

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

function renderApp(seedState?: PersistedState) {
  const repository: TrainingDataRepository = seedState
    ? { loadState: async () => seedState, saveState: async () => {} }
    : disposableEngineRepository()
  return render(
    <EngineStateProvider repository={repository}>
      <App />
    </EngineStateProvider>,
  )
}

const SEEDED_STATE_WITH_ACTIVE_GOAL: PersistedState = {
  profile: { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} },
  goals: [
    {
      id: 'g1',
      exerciseId: 'Barbell_Curl',
      startingWeightKg: 20,
      targetWeightKg: 30,
      deadline: '2027-01-01T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
      trainingEmphasis: 'strength',
    },
  ],
  specializationBlocks: [{ goalId: 'g1', focusMuscle: 'biceps', startedAt: '2026-08-01T00:00:00.000Z', endedAt: null }],
  workoutLogs: [],
  weighIns: [],
  circumferenceMeasurements: [],
  confirmedSessionInputs: null,
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
    // Regression: the Programs tab (template CRUD/AI generator/CSV import)
    // was removed entirely — it had zero effect on real training, since
    // nothing in session assembly ever read ProgramTemplate data.
    expect(screen.queryByRole('button', { name: 'Програми' })).toBeNull()
  })

  it('shows the home tab by default without throwing', () => {
    renderApp()
    expect(screen.getByText('Training Control Panel')).toBeTruthy()
  })

  it('shows a banner (not a silent failure) when the engine state fails to load', async () => {
    const repository: TrainingDataRepository = {
      loadState: async () => {
        throw new Error('boom')
      },
      saveState: async () => {},
    }
    render(
      <EngineStateProvider repository={repository}>
        <App />
      </EngineStateProvider>,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't load/i)
  })

  it('shows a banner (not a silent failure) when the engine state fails to save', async () => {
    const repository: TrainingDataRepository = {
      loadState: async () => null,
      saveState: async () => {
        throw new Error('boom')
      },
    }
    render(
      <EngineStateProvider repository={repository}>
        <App />
      </EngineStateProvider>,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't save/i)
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

  it(
    'full "План сесії" -> "Завершити" flow: assembling a session, navigating to finish it, ' +
      'and submitting actually saves a workout log (the exact regression reported: ' +
      '"not saved as in old app" / "cannot end the training on Завершити")',
    async () => {
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Assemble my session' }))

      const goToFinishButton = await screen.findByRole('button', { name: 'Перейти до Завершити' })
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()
      fireEvent.click(goToFinishButton)

      // Navigating to Завершити is plain tab navigation (App.tsx's onGoToFinish) --
      // it independently recomputes its own prescription, nothing was "started".
      expect(await screen.findByRole('heading', { name: 'Завершити тренування' })).toBeTruthy()
      expect(screen.getByText('Barbell Curl')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Завершити тренування' }))

      // The workout was actually persisted (not just a local-only success message):
      // a fresh form appears immediately, ready to log another one -- because there
      // is no "already logged" lock, exactly like the old app's Log tab.
      expect(await screen.findByText('Workout saved. Logging a fresh one below.')).toBeTruthy()
      expect(screen.getByText('Barbell Curl')).toBeTruthy()
    },
  )

  it(
    'regression guard: revisiting "План сесії" never shows a blocking ' +
      '"already in progress" message -- the exact scenario that broke ("I cant open again")',
    async () => {
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

      for (let visit = 0; visit < 3; visit++) {
        fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
        fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
        expect(screen.queryByText(/already in progress/i)).toBeNull()
        expect(screen.queryByText('Discard this workout')).toBeNull()
      }
    },
  )

  it(
    "a casual revisit to План сесії (nav away and back) keeps today's confirmed plan " +
      "instead of silently re-asking and possibly assembling a different one -- " +
      'the follow-up bug report: "if i started it already, i shouldn\'t be able to start again with different time available"',
    async () => {
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
      expect(await screen.findByRole('heading', { name: "Before we assemble today's session" })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Assemble my session' }))
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()

      // Nav away and back, without deliberately choosing to change anything.
      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))

      // Straight to the already-confirmed plan -- no re-ask, no way to have
      // accidentally landed on a different time budget.
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()
      expect(screen.queryByRole('heading', { name: "Before we assemble today's session" })).toBeNull()

      // The explicit override is still there for a deliberate change.
      fireEvent.click(screen.getByRole('button', { name: 'Change time / location' }))
      expect(await screen.findByRole('heading', { name: "Before we assemble today's session" })).toBeTruthy()
    },
  )

  it('"Головна" shows engine-driven empty-state guidance on a fresh profile-less state, not the old plannedSession/lastWorkout cards', async () => {
    renderApp()
    expect(await screen.findByText('Set up your profile first, on the Автопрофіль tab.')).toBeTruthy()
    expect(screen.getByText('No logged sessions yet.')).toBeTruthy()
  })

  it('"Головна" shows the active goal and a real logged session once one exists', async () => {
    const seedWithLog: PersistedState = {
      ...SEEDED_STATE_WITH_ACTIVE_GOAL,
      workoutLogs: [
        {
          id: 'w1',
          completedAt: '2026-08-20T10:00:00.000Z',
          successful: true,
          exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: 5, role: 'working' }] }],
        },
      ],
    }
    renderApp(seedWithLog)
    expect(await screen.findByText('Barbell Curl')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View Plan' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finish / Log Session' })).toBeTruthy()
    expect(screen.getByText('Successful')).toBeTruthy()
  })

  it('"Тренування" shows the active goal, and "End this goal early" actually ends it (no active goal afterward)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

    fireEvent.click(screen.getByRole('button', { name: 'Тренування' }))
    expect(await screen.findByText('Barbell Curl')).toBeTruthy()
    expect(screen.getByText('No ended goals yet.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'End this goal early' }))
    expect(await screen.findByText('No active goal. Set one on the Автопрофіль tab.')).toBeTruthy()
    expect(screen.getByText('Barbell Curl')).toBeTruthy() // now shows up in history instead
  })

  it('"Історія" lists a seeded workout log (engine data, not the old legacy WorkoutLog model)', async () => {
    const seedWithLog: PersistedState = {
      ...SEEDED_STATE_WITH_ACTIVE_GOAL,
      workoutLogs: [
        {
          id: 'w1',
          completedAt: '2026-08-20T10:00:00.000Z',
          successful: true,
          note: 'Felt strong',
          exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: 5, role: 'working' }] }],
        },
      ],
    }
    renderApp(seedWithLog)
    fireEvent.click(screen.getByRole('button', { name: 'Історія' }))
    expect(await screen.findByText('Barbell Curl')).toBeTruthy()
    expect(screen.getByText('Felt strong')).toBeTruthy()
    expect(screen.getByText('20kg×5')).toBeTruthy()
  })

  it('"Історія" shows "No logs yet." on a fresh state', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Історія' }))
    expect(await screen.findByText('No logs yet.')).toBeTruthy()
  })

  it('"Календар" shows the active goal\'s focus and at least one projected entry', async () => {
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)
    fireEvent.click(screen.getByRole('button', { name: 'Календар' }))
    expect(await screen.findByText('Barbell Curl', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('projected').length).toBeGreaterThan(0)
  })

  it('"Календар" points to Автопрофіль when there is no active goal', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Календар' }))
    expect(await screen.findByText('No active goal yet. Create one on the Автопрофіль tab to start training.')).toBeTruthy()
  })

  it('"Статистика" renders KPIs, goal progress, PRs, and the new per-muscle ACWR section without throwing', async () => {
    const seedWithLog: PersistedState = {
      ...SEEDED_STATE_WITH_ACTIVE_GOAL,
      workoutLogs: [
        {
          id: 'w1',
          completedAt: '2026-08-20T10:00:00.000Z',
          successful: true,
          exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 22.5, reps: 5, role: 'working' }] }],
        },
      ],
    }
    renderApp(seedWithLog)
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }))
    expect(await screen.findByText('Total workouts')).toBeTruthy()
    expect(screen.getAllByText('Barbell Curl').length).toBeGreaterThan(0)
    expect(screen.getByText('Biceps')).toBeTruthy() // per-muscle ACWR section
    expect(screen.getAllByText(/Acute \(7d\)/).length).toBeGreaterThan(0) // biceps (primary) + forearms (secondary)
  })

  it('"Статистика" renders empty-state messages on a fresh state without throwing', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }))
    expect(await screen.findByText('Total workouts')).toBeTruthy()
    expect(screen.getAllByText('No goals yet.')).toHaveLength(2) // Goal Progress + Baseline sections
    expect(screen.getByText('No working sets logged yet.')).toBeTruthy()
    expect(screen.getByText('No logged sets yet.')).toBeTruthy()
  })

  it("Завершити uses the same plan already confirmed on План сесії, and forgets it again once the workout is logged (ready to ask fresh for the next one)", async () => {
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Assemble my session' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Перейти до Завершити' }))

    expect(await screen.findByText(/Using today's plan from План сесії/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Завершити тренування' }))
    expect(await screen.findByText('Workout saved. Logging a fresh one below.')).toBeTruthy()

    // confirmedSessionInputs was cleared by LOG_WORKOUT -- back on План сесії,
    // it asks fresh for the next (now-unlogged) session rather than reusing
    // the just-completed answer.
    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    expect(await screen.findByRole('heading', { name: "Before we assemble today's session" })).toBeTruthy()
  })

  it(
    '"Reset All Data" (Дані tab) actually erases the engine\'s data too, not just the old app\'s -- ' +
      'the exact regression reported: "I wanted to erase all data but noticed it does not work"',
    async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

      // Confirm the engine data is really there before resetting.
      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Reset All Data' }))

      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      // Reset clears profile too, so Home falls back to its earliest guard
      // ("set up your profile") rather than the "no active goal" message --
      // either way, proof the seeded goal/profile/logs are all really gone.
      expect(await screen.findByText('Set up your profile first, on the Автопрофіль tab.')).toBeTruthy()
      expect(screen.getByText('No logged sessions yet.')).toBeTruthy()
    },
  )

it('"Фото" (Photos) tab renders without throwing', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Фото' }))
    expect(await screen.findByText('Фото прогресу')).toBeTruthy()
  })

  it(
    'exercise cards on План сесії show reps/weight and recent history, not just a bare set count -- ' +
      'UI-parity gap reported: "old app has on card sets, reps, weight, last three progression insides. in new app nothing"',
    async () => {
      const seedWithLog: PersistedState = {
        ...SEEDED_STATE_WITH_ACTIVE_GOAL,
        workoutLogs: [
          {
            id: 'w1',
            completedAt: '2026-08-20T10:00:00.000Z',
            successful: true,
            exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: 5, role: 'working' }] }],
          },
        ],
      }
      renderApp(seedWithLog)

      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Assemble my session' }))

      expect(await screen.findAllByText('Reps')).not.toHaveLength(0)
      expect(screen.getAllByText('Weight').length).toBeGreaterThan(0)
      expect(screen.getByText('20kg×5 (2026-08-20)')).toBeTruthy()

      // Opening the card's detail modal shows the fuller history section too.
      fireEvent.click(screen.getByText('Barbell Curl'))
      expect(await screen.findByText(/History \(1 session/)).toBeTruthy()
    },
  )
})
