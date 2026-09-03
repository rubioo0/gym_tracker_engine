import { useEffect, useMemo, useReducer, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  clearAppState,
  exportAppStateJson,
  exportCleanAppStateJson,
  importStateFromJson,
  loadAppState,
  saveAppState,
} from './data/storage'
import { seededProgramTemplates } from './data/seed'
import { exportWorkoutLogsToExcel, buildExcelLogFileName } from './data/excelLogExport'
import { importWorkoutLogsFromExcel } from './data/excelLogImport'
import { exportEngineWorkoutLogsToExcel, buildEngineExcelLogFileName } from './data/engineExcelLogExport'
import { appReducer } from './domain/reducer'
import { StatsTab as EngineStatsTab } from './components/engine/StatsTab'
import { AIAssistant } from './components/AIAssistant'
import { ProgressPhotos } from './components/photos/ProgressPhotos'
import { loadAISettings } from './services/geminiService'
import { SetupTab } from './components/engine/SetupTab'
import { TodayTab } from './components/engine/TodayTab'
import { FinishSessionTab } from './components/engine/FinishSessionTab'
import { HomeTab } from './components/engine/HomeTab'
import { FocusTab } from './components/engine/FocusTab'
import { HistoryTab } from './components/engine/HistoryTab'
import { CalendarTab } from './components/engine/CalendarTab'
import { useEngineState } from './components/engine/useEngineState'
import { getActiveGoalAndBlock, countSessionsInBlock } from './application/activeGoal'
import { getMuscleGroup } from './domain/muscles/muscleTaxonomy'
import { INITIAL_STATE as ENGINE_INITIAL_STATE, isPersistedState } from './application/state'
import './App.css'

type AppTab =
  | 'home'
  | 'runs'
  | 'session'
  | 'log'
  | 'history'
  | 'calendar'
  | 'stats'
  | 'photos'
  | 'data'
  | 'engineSetup'

const tabs: { id: AppTab; label: string }[] = [
  { id: 'home', label: 'Головна' },
  { id: 'runs', label: 'Тренування' },
  { id: 'session', label: 'План сесії' },
  { id: 'log', label: 'Завершити' },
  { id: 'history', label: 'Історія' },
  { id: 'calendar', label: 'Календар' },
  { id: 'stats', label: 'Статистика' },
  { id: 'photos', label: 'Фото' },
  { id: 'data', label: 'Дані' },
  { id: 'engineSetup', label: 'Автопрофіль' },
]

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState)
  const { state: engineState, dispatch: engineDispatch } = useEngineState()
  const engineActive = useMemo(() => getActiveGoalAndBlock(engineState), [engineState])
  const engineSessionsInBlock = useMemo(
    () => (engineActive ? countSessionsInBlock(engineState.workoutLogs, engineActive.block) : 0),
    [engineActive, engineState.workoutLogs],
  )
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [importText, setImportText] = useState('')
  const [dataMessage, setDataMessage] = useState('')

  useEffect(() => {
    const saved = saveAppState(state)
    if (!saved) {
      queueMicrotask(() => {
        setDataMessage(
          "Не вдалося зберегти останню зміну — можливо, локальне сховище пристрою заповнене. Звільніть місце або незабаром експортуйте резервну копію.",
        )
      })
    }
  }, [state])

  const aiSettings = loadAISettings()

  function handleTabChange(tab: AppTab): void {
    setActiveTab(tab)
  }

  function handleResetAllData(): void {
    const approved = window.confirm(
      'Це видалить усі тренування та логи, завантажить початкові шаблони, А ТАКОЖ стере ваш профіль автономного модуля, цілі та історію тренувань. Продовжити?',
    )
    if (!approved) {
      return
    }

    clearAppState()
    dispatch({
      type: 'clearAllData',
      templates: seededProgramTemplates,
    })
    engineDispatch({ type: 'REPLACE_STATE', state: ENGINE_INITIAL_STATE })
    setDataMessage('Стан скинуто до початкових шаблонів. Дані автономного модуля також стерто.')
  }

  function handleExportLogsExcel(): void {
    if (state.workoutLogs.length === 0) {
      setDataMessage('Немає логів для експорту.')
      return
    }

    try {
      const buffer = exportWorkoutLogsToExcel(state.workoutLogs)
      const fileName = buildExcelLogFileName()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)

      setDataMessage(`Експортовано ${state.workoutLogs.length} тренування(нь) у ${fileName}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Невідома помилка.'
      setDataMessage(`Помилка експорту в Excel: ${message}`)
    }
  }

  async function handleImportLogsExcel(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const logs = importWorkoutLogsFromExcel(buffer)
      if (!logs) {
        setDataMessage(
          'Помилка імпорту: не вдалося розпізнати файл Excel. Перевірте, що він містить потрібні колонки (logId, runId тощо).',
        )
        return
      }

      const approved = window.confirm(
        `Імпортувати ${logs.length} тренування(нь) з "${file.name}"? Це замінить усі поточні логи та перерахує лічильники тренувань.`,
      )
      if (!approved) {
        return
      }

      dispatch({ type: 'importLogs', logs })
      setDataMessage(
        `Імпортовано ${logs.length} тренування(нь) з ${file.name}. Лічильники тренувань перераховано.`,
      )
    } catch {
      setDataMessage('Не вдалося прочитати файл Excel.')
    }
  }

  // Combines both state trees into one downloadable file -- previously this
  // exported only the old tree, so a user whose real training data lives
  // entirely in the engine tree (every tab except Програми/Дані) got a
  // "backup" with empty workoutLogs/goals despite the button's name
  // ("неможливо експортувати логи зі сторінки даних" -- confirmed live by
  // an actual exported file during real use). `engineState` rides alongside
  // the existing `state` key so an old backup file still imports the same
  // way it always did.
  function downloadCombinedBackup(oldTreeJson: string, fileName: string): void {
    const combined = { ...JSON.parse(oldTreeJson), engineState }
    const text = JSON.stringify(combined, null, 2)
    const backupBlob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const backupUrl = URL.createObjectURL(backupBlob)
    const link = document.createElement('a')
    link.href = backupUrl
    link.download = fileName
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 0)
  }

  function handleExportState(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `training-os-backup-${timestamp}.json`
    downloadCombinedBackup(exportAppStateJson(state), fileName)
    setDataMessage(`Резервну копію завантажено: ${fileName} (включає дані автономного модуля)`)
  }

  function handleExportCleanState(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `training-os-backup-clean-${timestamp}.json`
    downloadCombinedBackup(exportCleanAppStateJson(state), fileName)
    setDataMessage(
      `Чисту копію завантажено: ${fileName} (архівні/завершені тренування виключено, лише активні/призупинені; включає дані автономного модуля)`,
    )
  }

  function handleExportEngineLogsExcel(): void {
    if (engineState.workoutLogs.length === 0) {
      setDataMessage('Немає логів автономного модуля для експорту.')
      return
    }

    try {
      const buffer = exportEngineWorkoutLogsToExcel(engineState.workoutLogs)
      const fileName = buildEngineExcelLogFileName()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)

      setDataMessage(`Експортовано ${engineState.workoutLogs.length} тренування(нь) автономного модуля у ${fileName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка.'
      setDataMessage(`Помилка експорту логів автономного модуля в Excel: ${message}`)
    }
  }

  /** Restores the engine tree from an `engineState` key alongside the old-tree payload, if present and valid -- older backup files (from before this existed) simply don't have the key, and are left alone. */
  function restoreEngineStateIfPresent(rawJson: string): boolean {
    try {
      const parsed = JSON.parse(rawJson) as { engineState?: unknown }
      if (isPersistedState(parsed.engineState)) {
        engineDispatch({ type: 'REPLACE_STATE', state: parsed.engineState })
        return true
      }
    } catch {
      // Old-tree import already succeeded by the time this runs; a parse
      // failure here just means no engine data to restore.
    }
    return false
  }

  function handleImportState(): void {
    const imported = importStateFromJson(importText)
    if (!imported) {
      setDataMessage('Помилка імпорту: недійсний JSON.')
      return
    }

    dispatch({ type: 'hydrate', payload: imported })
    const restoredEngine = restoreEngineStateIfPresent(importText)
    setDataMessage(`Стан успішно імпортовано${restoredEngine ? ' (включно з даними автономного модуля)' : ''}.`)
  }

  async function handleImportStateFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const imported = importStateFromJson(text)
      if (!imported) {
        setDataMessage('Помилка імпорту: недійсний JSON у файлі.')
        return
      }

      dispatch({ type: 'hydrate', payload: imported })
      const restoredEngine = restoreEngineStateIfPresent(text)
      setImportText(text)
      setDataMessage(`Імпортовано файл резервної копії: ${file.name}${restoredEngine ? ' (включно з даними автономного модуля)' : ''}`)
    } catch {
      setDataMessage('Не вдалося прочитати файл резервної копії.')
    }
  }

  return (
    <>
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Панель керування тренуваннями</h1>
          <p className="subtitle">
            Логіка на основі сесій. Швидкий перегляд плану перед тренуванням. Швидке логування після тренування.
          </p>
        </div>

        <div className="header-kpis">
          <div className="kpi">
            <span>Фокус-група</span>
            <strong>{engineActive ? getMuscleGroup(engineActive.block.focusMuscle).labelUk : 'Немає'}</strong>
          </div>
          <div className="kpi">
            <span>Сесій у цьому блоці</span>
            <strong>{engineSessionsInBlock}</strong>
          </div>
          <div className="kpi">
            <span>Логів історії</span>
            <strong>{engineState.workoutLogs.length}</strong>
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="Основні розділи">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? 'tab tab-active' : 'tab'}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'home' && (
        <HomeTab onViewPlan={() => handleTabChange('session')} onGoToLog={() => handleTabChange('log')} />
      )}

      {activeTab === 'runs' && <FocusTab />}

      {activeTab === 'session' && <TodayTab onGoToFinish={() => setActiveTab('log')} />}

      {activeTab === 'log' && <FinishSessionTab onFinished={() => setActiveTab('home')} />}

      {activeTab === 'history' && <HistoryTab />}

      {activeTab === 'calendar' && <CalendarTab />}

      {activeTab === 'stats' && <EngineStatsTab />}

      {activeTab === 'photos' && (
        <section className="panel-grid">
          <article className="card card-wide">
            <ProgressPhotos apiKey={aiSettings.apiKey} model={aiSettings.model} />
          </article>
        </section>
      )}

      {activeTab === 'data' && (
        <section className="panel-grid">
          <article className="card card-wide">
            <h2>Імпорт / Керування даними</h2>
            <p className="muted">
              Використовуйте резервні копії JSON, щоб зберегти дані тренувань у безпеці між оновленнями апки.
            </p>

            <div className="template-group">
              <h3>Резервна копія стану</h3>
              <p className="muted">
                Охоплює як ваші реальні дані тренувань (цілі, історію, профіль — дані, які використовує кожна
                вкладка, окрім Програми/Дані), так і застарілі дані Програми/Дані, в одному файлі. Використовуйте
                чисту копію при очищенні кешу чи оновленні апки (без архівних/завершених тренувань). Використовуйте
                повну копію, щоб зберегти всю історію.
              </p>
              <div className="action-row">
                <button type="button" onClick={handleExportCleanState}>
                  Завантажити чисту копію (рекомендовано)
                </button>
                <button type="button" onClick={handleExportState}>
                  Завантажити повну копію
                </button>
              </div>
              <div className="action-row">
                <label className="stacked-field inline-file-field">
                  Імпортувати файл резервної копії JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportStateFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="template-group">
              <h3>Експорт / імпорт історії логів</h3>
              <p className="muted">
                "Експортувати логи в Excel" нижче — це ваша реальна, поточна історія тренувань (дані автономного
                модуля, які використовує кожна вкладка). За потреби відредагуйте її зовні (змініть вагу, дати тощо).
                Застаріла пара імпорту/експорту нижче — для старого, більше не використовуваного формату логів
                Програми/Дані.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  onClick={handleExportEngineLogsExcel}
                  disabled={engineState.workoutLogs.length === 0}
                >
                  Експортувати логи в Excel ({engineState.workoutLogs.length})
                </button>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  onClick={handleExportLogsExcel}
                  disabled={state.workoutLogs.length === 0}
                >
                  Експортувати застарілі логи в Excel ({state.workoutLogs.length})
                </button>
              </div>
              <div className="action-row">
                <label className="stacked-field inline-file-field">
                  Імпортувати застарілі логи з Excel
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImportLogsExcel}
                  />
                </label>
              </div>
            </div>

            <div className="template-group">
              <h3>⚠️ Небезпечна зона</h3>
              <p className="muted">
                Небезпечні операції — скидання та перезапис даних.
              </p>
              <div className="action-row">
                <button type="button" onClick={handleResetAllData}>
                  Скинути всі дані
                </button>
                <button type="button" onClick={handleImportState}>
                  Імпортувати JSON з поля
                </button>
              </div>

              <label className="stacked-field">
                JSON стану (застарілий/ручний імпорт)
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  rows={16}
                />
              </label>
            </div>

            {dataMessage ? <p className="note">{dataMessage}</p> : null}
          </article>
        </section>
      )}

      {activeTab === 'engineSetup' && <SetupTab oldWorkoutLogs={state.workoutLogs} />}
    </main>

    <AIAssistant engineState={engineState} />
    </>
  )
}

export default App
