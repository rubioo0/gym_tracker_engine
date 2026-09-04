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
    expect(screen.getByText('Панель керування тренуваннями')).toBeTruthy()
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
    expect((await screen.findByRole('alert')).textContent).toMatch(/не вдалося завантажити/i)
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
    expect((await screen.findByRole('alert')).textContent).toMatch(/не вдалося зберегти/i)
  })

  it('"План сесії" now shows the engine-driven Today content, not the old SessionPlanPanel', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    // Fresh disposable state has no engine profile yet, so the engine's own
    // guidance message should appear -- proof this tab is wired to the new
    // engine, not the old plannedSession/SessionPlanPanel logic.
    expect(await screen.findByText('Спершу налаштуйте профіль на вкладці Автопрофіль.')).toBeTruthy()
  })

  it('"Автопрофіль" renders the profile setup form', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Автопрофіль' }))
    // The engine's "loaded" flag flips asynchronously (even the disposable
    // stub repository resolves via a microtask), so this needs findBy*
    // rather than getBy* to wait past the initial "Loading…" render.
    expect(await screen.findByText('Профіль')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Зберегти профіль' })).toBeTruthy()
  })

  it('"Автопрофіль" suggests the least-recently-trained muscle for a new goal, not just the first in the list (pickNextFocus wiring)', async () => {
    const seedState: PersistedState = {
      profile: { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} },
      goals: [],
      // "chest" (MUSCLE_GROUPS[0], the old default) has an ended block, so
      // it's no longer "never focused" -- "back" (MUSCLE_GROUPS[1], still
      // never focused) should now be suggested instead.
      specializationBlocks: [
        { goalId: 'old-goal', focusMuscle: 'chest', startedAt: '2026-07-01T00:00:00.000Z', endedAt: '2026-07-15T00:00:00.000Z' },
      ],
      workoutLogs: [],
      confirmedSessionInputs: null,
    }
    renderApp(seedState)
    fireEvent.click(screen.getByRole('button', { name: 'Автопрофіль' }))
    expect(await screen.findByText(/Пропонований наступний фокус/)).toBeTruthy()
    // "Back" alone is ambiguous (it's also a <select> option) -- check the
    // actual wiring instead: the muscle-group picker's initial value.
    const muscleSelect = screen.getByLabelText("Група м'язів") as HTMLSelectElement
    expect(muscleSelect.value).toBe('back')
  })

  it('"Дані" (Data) tab renders without throwing', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(screen.getByText('Імпорт / Керування даними')).toBeTruthy()
  })

  it('"Дані" JSON import (textarea + Import JSON From Box) actually replaces old-tree state -- previously untested parsing path', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    await screen.findByText('Імпорт / Керування даними')

    const payload = {
      backupVersion: 2,
      exportedAt: '2026-08-01T00:00:00.000Z',
      storageVersion: 1,
      state: {
        programTemplates: [],
        focusRuns: [],
        workoutLogs: [
          {
            id: 'log-1',
            runId: 'run-1',
            templateId: 'template-1',
            sessionId: 'session-1',
            sessionName: 'Upper A',
            track: 'upper',
            completedAt: '2026-08-01T00:00:00.000Z',
            successful: true,
            exerciseLogs: [],
            optionalActivities: [],
            sessionNote: 'Round-trip test',
          },
        ],
        lastCompletedTrack: null,
        selectedRunId: null,
        showProgressionInsights: false,
      },
    }

    const textarea = screen.getByLabelText('JSON стану (застарілий/ручний імпорт)')
    fireEvent.change(textarea, { target: { value: JSON.stringify(payload) } })
    fireEvent.click(screen.getByRole('button', { name: 'Імпортувати JSON з поля' }))

    expect(await screen.findByText('Стан успішно імпортовано.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Експортувати застарілі логи в Excel (1)' })).toBeTruthy()
  })

  it(
    '"Дані" JSON import also restores real engine-tree data from an `engineState` key -- ' +
      'the exact regression reported: "неможливо експортувати логи зі сторінки даних" ' +
      '(a Data-tab backup previously only ever contained empty old-tree data)',
    async () => {
      renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
      await screen.findByText('Імпорт / Керування даними')

      const payload = {
        backupVersion: 3,
        exportedAt: '2026-09-03T00:00:00.000Z',
        storageVersion: 1,
        state: {
          programTemplates: [],
          focusRuns: [],
          workoutLogs: [],
          lastCompletedTrack: null,
          selectedRunId: null,
          showProgressionInsights: false,
        },
        engineState: SEEDED_STATE_WITH_ACTIVE_GOAL,
      }

      const textarea = screen.getByLabelText('JSON стану (застарілий/ручний імпорт)')
      fireEvent.change(textarea, { target: { value: JSON.stringify(payload) } })
      fireEvent.click(screen.getByRole('button', { name: 'Імпортувати JSON з поля' }))

      expect(await screen.findByText('Стан успішно імпортовано (включно з даними автономного модуля).')).toBeTruthy()

      // The engine tree (goal/block from SEEDED_STATE_WITH_ACTIVE_GOAL) is
      // really there now, not just the old tree -- proven via Головна,
      // which only ever reads engine state.
      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()
    },
  )

  it(
    'full "План сесії" -> "Завершити" flow: assembling a session, navigating to finish it, ' +
      'and submitting actually saves a workout log (the exact regression reported: ' +
      '"not saved as in old app" / "cannot end the training on Завершити")',
    async () => {
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
      // Generous budget: with every muscle now eligible for maintenance work
      // (landmarks.ts's 2026-09 mv fix), the default 45-minute draft can
      // legitimately crowd out an isolation goal exercise like Barbell Curl
      // in favor of higher-priority compounds -- this test is about the
      // finish flow, not time-crunch cutting.
      fireEvent.change(await screen.findByLabelText('Хвилин доступно сьогодні'), { target: { value: '300' } })
      fireEvent.click(screen.getByRole('button', { name: 'Зібрати мою сесію' }))

      const goToFinishButton = await screen.findByRole('button', { name: 'Перейти до Завершити' })
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()
      fireEvent.click(goToFinishButton)

      // Navigating to Завершити is plain tab navigation (App.tsx's onGoToFinish) --
      // it independently recomputes its own prescription, nothing was "started".
      expect(await screen.findByRole('heading', { name: 'Завершити тренування' })).toBeTruthy()
      expect(screen.getByText('Barbell Curl')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Завершити тренування' }))

      // Matches the old app's post-log navigation (regression from real use:
      // "поправити, завершити тренування не навігує після логування так як
      // стара апка") -- submitting takes the user straight to Головна, and
      // the workout was actually persisted, not just a local-only success
      // message: the "last completed session" card proves it.
      expect(await screen.findByRole('heading', { name: 'Остання завершена сесія' })).toBeTruthy()
      expect(screen.getAllByText(/Barbell Curl/).length).toBeGreaterThan(0)
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
      expect(await screen.findByRole('heading', { name: 'Перш ніж зібрати сьогоднішню сесію' })).toBeTruthy()
      // Generous budget -- see the comment on the flow test above for why.
      fireEvent.change(screen.getByLabelText('Хвилин доступно сьогодні'), { target: { value: '300' } })
      fireEvent.click(screen.getByRole('button', { name: 'Зібрати мою сесію' }))
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()

      // Nav away and back, without deliberately choosing to change anything.
      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))

      // Straight to the already-confirmed plan -- no re-ask, no way to have
      // accidentally landed on a different time budget.
      expect(await screen.findByText('Barbell Curl')).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Перш ніж зібрати сьогоднішню сесію' })).toBeNull()

      // The explicit override is still there for a deliberate change.
      fireEvent.click(screen.getByRole('button', { name: 'Змінити час / місце' }))
      expect(await screen.findByRole('heading', { name: 'Перш ніж зібрати сьогоднішню сесію' })).toBeTruthy()
    },
  )

  it('"Головна" shows engine-driven empty-state guidance on a fresh profile-less state, not the old plannedSession/lastWorkout cards', async () => {
    renderApp()
    expect(await screen.findByText('Спершу налаштуйте профіль на вкладці Автопрофіль.')).toBeTruthy()
    expect(screen.getByText('Ще немає залогованих сесій.')).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Переглянути план' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Завершити / залогувати сесію' })).toBeTruthy()
    expect(screen.getByText('Успішно')).toBeTruthy()
  })

  it('"Тренування" shows the active goal, and "End this goal early" actually ends it (no active goal afterward)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

    fireEvent.click(screen.getByRole('button', { name: 'Тренування' }))
    expect(await screen.findByText('Barbell Curl')).toBeTruthy()
    expect(screen.getByText('Ще немає завершених цілей.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Завершити ціль достроково' }))
    expect(await screen.findByText('Немає активної цілі. Встановіть її на вкладці Автопрофіль.')).toBeTruthy()
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
    expect(screen.getByText('20кг×5')).toBeTruthy()
  })

  it('"Історія" shows "No logs yet." on a fresh state', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Історія' }))
    expect(await screen.findByText('Ще немає логів.')).toBeTruthy()
  })

  it('"Календар" shows the active goal\'s focus, header stats, and at least one projected entry with exercise detail', async () => {
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)
    fireEvent.click(screen.getByRole('button', { name: 'Календар' }))
    expect(await screen.findByText('Barbell Curl', { exact: false })).toBeTruthy()
    expect(screen.getByText('Прогнозоване завершення цілі')).toBeTruthy()
    expect(document.querySelectorAll('.calendar-session.projected').length).toBeGreaterThan(0)

    // Expand the first session to confirm per-entry exercise detail renders.
    fireEvent.click(screen.getAllByRole('button', { name: /Сесія \d+/ })[0])
    expect(screen.getAllByText(/×/).length).toBeGreaterThan(0)
  })

  it('"Календар" points to Автопрофіль when there is no active goal', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Календар' }))
    expect(await screen.findByText('Ще немає активної цілі. Створіть її на вкладці Автопрофіль, щоб почати тренування.')).toBeTruthy()
  })

  it('"Статистика" renders KPIs, goal progress, PRs, the monthly bar chart, and the per-muscle ACWR section with a concrete computed value', async () => {
    // completedAt is relative to "now" (not a fixed date) so the acute-load
    // window assertion below stays correct regardless of which real day
    // this suite runs on -- StatsTab.tsx computes `asOf = new Date()`
    // internally with no injectable clock, so a fixed past date would
    // eventually fall outside the 7-day acute window and start failing.
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const seedWithLog: PersistedState = {
      ...SEEDED_STATE_WITH_ACTIVE_GOAL,
      workoutLogs: [
        {
          id: 'w1',
          completedAt: oneDayAgo,
          successful: true,
          exerciseLogs: [{ exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 22.5, reps: 5, role: 'working' }] }],
        },
      ],
    }
    renderApp(seedWithLog)
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }))
    expect(await screen.findByText('Всього тренувань')).toBeTruthy()
    expect(screen.getAllByText('Barbell Curl').length).toBeGreaterThan(0)
    expect(screen.getByText('Активність (місяці)')).toBeTruthy()
    expect(document.querySelectorAll('.stats-bar-fill').length).toBe(6) // 6 zero-filled months, always rendered
    expect(screen.getAllByText('Біцепс').length).toBeGreaterThan(0) // per-muscle ACWR section (also shown in the header KPI)
    // Concrete computed value, not just label presence: biceps is
    // Barbell_Curl's primary muscle, one working set logged yesterday ->
    // 1 hard set, safely inside the 7-day acute window.
    expect(screen.getByText(/Гостре \(7д\): 1 важк\. сетів/)).toBeTruthy()
    expect(screen.getAllByText(/Безпечна тижнева стеля: [\d.]+ сетів/).length).toBeGreaterThan(0)
  })

  it('"Статистика" renders empty-state messages on a fresh state without throwing', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }))
    expect(await screen.findByText('Всього тренувань')).toBeTruthy()
    expect(screen.getAllByText('Ще немає цілей.')).toHaveLength(2) // Goal Progress + Baseline sections
    expect(screen.getByText('Ще немає залогованих робочих сетів.')).toBeTruthy()
    expect(screen.getByText('Ще немає залогованих сетів.')).toBeTruthy()
  })

  it("Завершити uses the same plan already confirmed on План сесії, and forgets it again once the workout is logged (ready to ask fresh for the next one)", async () => {
    renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL)

    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зібрати мою сесію' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Перейти до Завершити' }))

    expect(await screen.findByText(/Використовується сьогоднішній план з "План сесії"/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Завершити тренування' }))
    // Submitting navigates to Головна now (matches the old app) -- proven by
    // the last-completed-session card rendering there.
    expect(await screen.findByRole('heading', { name: 'Остання завершена сесія' })).toBeTruthy()

    // confirmedSessionInputs was cleared by LOG_WORKOUT -- back on План сесії,
    // it asks fresh for the next (now-unlogged) session rather than reusing
    // the just-completed answer.
    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    expect(await screen.findByRole('heading', { name: 'Перш ніж зібрати сьогоднішню сесію' })).toBeTruthy()
  })

  it(
    'Завершити computes session duration from when the plan was confirmed on План сесії, minus deducted ' +
      'non-training time, and shows it in Історія (item 2: "додатковий час... і я пишу наприклад 20 хв")',
    async () => {
      const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString()
      const seedState: PersistedState = {
        ...SEEDED_STATE_WITH_ACTIVE_GOAL,
        confirmedSessionInputs: { availableMinutes: 300, noGymToday: false, confirmedAt: fortyMinutesAgo },
      }
      renderApp(seedState)

      fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))
      const deductInput = await screen.findByLabelText(/Додатковий нетренувальний час/)
      fireEvent.change(deductInput, { target: { value: '10' } })
      fireEvent.click(screen.getByRole('button', { name: 'Завершити тренування' }))

      fireEvent.click(await screen.findByRole('button', { name: 'Історія' }))
      // ~40 min elapsed since confirmedAt, minus 10 deducted -> 30.
      expect(await screen.findByText('⏱ 30 хв (−10 хв інше)')).toBeTruthy()
    },
  )

  it(
    'Завершити logs no duration fields at all when there was no captured start time -- graceful fallback, ' +
      'not a crash or a nonsense number',
    async () => {
      renderApp(SEEDED_STATE_WITH_ACTIVE_GOAL) // confirmedSessionInputs is null -- never visited План сесії

      fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))
      expect(screen.queryByLabelText(/Додатковий нетренувальний час/)).toBeNull()
      fireEvent.click(await screen.findByRole('button', { name: 'Завершити тренування' }))

      fireEvent.click(await screen.findByRole('button', { name: 'Історія' }))
      expect(screen.queryByText(/⏱/)).toBeNull()
    },
  )

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
      fireEvent.click(await screen.findByRole('button', { name: 'Скинути всі дані' }))

      fireEvent.click(screen.getByRole('button', { name: 'Головна' }))
      // Reset clears profile too, so Home falls back to its earliest guard
      // ("set up your profile") rather than the "no active goal" message --
      // either way, proof the seeded goal/profile/logs are all really gone.
      expect(await screen.findByText('Спершу налаштуйте профіль на вкладці Автопрофіль.')).toBeTruthy()
      expect(screen.getByText('Ще немає залогованих сесій.')).toBeTruthy()
    },
  )

it('"Фото" (Photos) tab renders without throwing', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Фото' }))
    expect(await screen.findByText('Фото прогресу')).toBeTruthy()
  })

  it('AI Assistant panel opens without throwing and prompts for an API key when none is configured', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити AI тренера' }))
    expect(screen.getByRole('dialog', { name: 'AI Тренер' })).toBeTruthy()
    expect(screen.getByText('Налаштування Gemini AI')).toBeTruthy()
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
      // A generous time budget: with every muscle now eligible for
      // maintenance work (landmarks.ts's 2026-09 mv fix), the default
      // 45-minute draft can legitimately crowd out an isolation goal
      // exercise like Barbell Curl in favor of higher-priority compounds --
      // this test is about the card's UI content, not time-crunch cutting.
      fireEvent.change(await screen.findByLabelText('Хвилин доступно сьогодні'), { target: { value: '300' } })
      fireEvent.click(screen.getByRole('button', { name: 'Зібрати мою сесію' }))

      expect(await screen.findAllByText('Reps')).not.toHaveLength(0)
      expect(screen.getAllByText('Weight').length).toBeGreaterThan(0)
      expect(screen.getByText('20kg×5 (2026-08-20)')).toBeTruthy()

      // Opening the card's detail modal shows the fuller history section too.
      fireEvent.click(screen.getByText('Barbell Curl'))
      expect(await screen.findByText(/Історія \(1 сесій/)).toBeTruthy()
    },
  )

  it('shows a deload suggestion on План сесії after 2+ consecutive held sessions for the goal exercise (shouldDeloadGoalExercise wiring)', async () => {
    const targetReps = 5 // TARGET_REPS_BY_EMPHASIS.strength -- SEEDED_STATE_WITH_ACTIVE_GOAL's goal is 'strength'
    const seedWithHeldLogs: PersistedState = {
      ...SEEDED_STATE_WITH_ACTIVE_GOAL,
      workoutLogs: [
        {
          id: 'w1',
          completedAt: '2026-08-10T10:00:00.000Z',
          successful: true,
          exerciseLogs: [
            { exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: targetReps - 1, role: 'working' }] },
          ],
        },
        {
          id: 'w2',
          completedAt: '2026-08-15T10:00:00.000Z',
          successful: true,
          exerciseLogs: [
            { exerciseId: 'Barbell_Curl', skipped: false, sets: [{ weightKg: 20, reps: targetReps - 1, role: 'working' }] },
          ],
        },
      ],
    }
    renderApp(seedWithHeldLogs)
    fireEvent.click(screen.getByRole('button', { name: 'План сесії' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зібрати мою сесію' }))
    expect(await screen.findByText(/Рекомендовано розвантаження/)).toBeTruthy()
  })
})
