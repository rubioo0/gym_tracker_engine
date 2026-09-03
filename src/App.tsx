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
          "Couldn't save your last change — your device's local storage may be full. Free up space or export a backup soon.",
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
      'This will remove all runs and logs and load seeded templates, AND erase your autonomous-engine profile, goals, and training history. Continue?',
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
    setDataMessage('State reset to seeded templates. Autonomous-engine data erased too.')
  }

  function handleExportLogsExcel(): void {
    if (state.workoutLogs.length === 0) {
      setDataMessage('No logs to export.')
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

      setDataMessage(
        `Exported ${state.workoutLogs.length} workout log(s) to ${fileName}`,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown export error.'
      setDataMessage(`Excel export failed: ${message}`)
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
          'Import failed: could not parse the Excel file. Make sure it has the required columns (logId, runId, etc.).',
        )
        return
      }

      const approved = window.confirm(
        `Import ${logs.length} workout log(s) from "${file.name}"? This will replace all current logs and recalculate run counters.`,
      )
      if (!approved) {
        return
      }

      dispatch({ type: 'importLogs', logs })
      setDataMessage(
        `Imported ${logs.length} workout log(s) from ${file.name}. Run counters recalculated.`,
      )
    } catch {
      setDataMessage('Failed to read the Excel file.')
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
    setDataMessage(`Backup downloaded: ${fileName} (includes autonomous-engine data)`)
  }

  function handleExportCleanState(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `training-os-backup-clean-${timestamp}.json`
    downloadCombinedBackup(exportCleanAppStateJson(state), fileName)
    setDataMessage(
      `Clean backup downloaded: ${fileName} (archived/completed runs excluded, active/paused runs only; includes autonomous-engine data)`,
    )
  }

  function handleExportEngineLogsExcel(): void {
    if (engineState.workoutLogs.length === 0) {
      setDataMessage('No engine logs to export.')
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

      setDataMessage(`Exported ${engineState.workoutLogs.length} engine workout log(s) to ${fileName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.'
      setDataMessage(`Engine Excel export failed: ${message}`)
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
      setDataMessage('Import failed: invalid JSON payload.')
      return
    }

    dispatch({ type: 'hydrate', payload: imported })
    const restoredEngine = restoreEngineStateIfPresent(importText)
    setDataMessage(`State imported successfully${restoredEngine ? ' (including autonomous-engine data)' : ''}.`)
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
        setDataMessage('Import failed: invalid JSON payload in file.')
        return
      }

      dispatch({ type: 'hydrate', payload: imported })
      const restoredEngine = restoreEngineStateIfPresent(text)
      setImportText(text)
      setDataMessage(`Imported backup file: ${file.name}${restoredEngine ? ' (including autonomous-engine data)' : ''}`)
    } catch {
      setDataMessage('Failed to read backup file.')
    }
  }

  return (
    <>
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Training Control Panel</h1>
          <p className="subtitle">
            Session-based logic. Fast pre-workout plan view. Quick post-workout log.
          </p>
        </div>

        <div className="header-kpis">
          <div className="kpi">
            <span>Focus muscle</span>
            <strong>{engineActive ? engineActive.block.focusMuscle : 'None'}</strong>
          </div>
          <div className="kpi">
            <span>Sessions this block</span>
            <strong>{engineSessionsInBlock}</strong>
          </div>
          <div className="kpi">
            <span>History Logs</span>
            <strong>{engineState.workoutLogs.length}</strong>
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="Main views">
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
            <h2>Import / Data Management</h2>
            <p className="muted">
              Use one-tap JSON backup files to keep your training data safe between app
              updates.
            </p>

            <div className="template-group">
              <h3>State Backup</h3>
              <p className="muted">
                Covers both your real training data (goals, workout history, profile — the
                data every tab except Програми/Дані uses) and the legacy Програми/Дані data,
                in one file. Use the clean backup when cache-busting or updating your app
                (excludes archived/completed runs). Use full backup to preserve all
                historical data.
              </p>
              <div className="action-row">
                <button type="button" onClick={handleExportCleanState}>
                  Download Clean Backup (Recommended)
                </button>
                <button type="button" onClick={handleExportState}>
                  Download Full Backup
                </button>
              </div>
              <div className="action-row">
                <label className="stacked-field inline-file-field">
                  Import Backup JSON File
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportStateFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="template-group">
              <h3>Log History Export / Import</h3>
              <p className="muted">
                "Export Logs to Excel" below is your real, current training history (the
                engine data every tab uses). Edit it externally (adjust weights, dates, etc.)
                if needed. The legacy import/export pair underneath is for the old,
                no-longer-actively-used Програми/Дані log format.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  onClick={handleExportEngineLogsExcel}
                  disabled={engineState.workoutLogs.length === 0}
                >
                  Export Logs to Excel ({engineState.workoutLogs.length})
                </button>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  onClick={handleExportLogsExcel}
                  disabled={state.workoutLogs.length === 0}
                >
                  Export Legacy Logs to Excel ({state.workoutLogs.length})
                </button>
              </div>
              <div className="action-row">
                <label className="stacked-field inline-file-field">
                  Import Legacy Logs from Excel
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImportLogsExcel}
                  />
                </label>
              </div>
            </div>

            <div className="template-group">
              <h3>⚠️ Danger Zone</h3>
              <p className="muted">
                Небезпечні операції — скидання та перезапис даних.
              </p>
              <div className="action-row">
                <button type="button" onClick={handleResetAllData}>
                  Reset All Data
                </button>
                <button type="button" onClick={handleImportState}>
                  Import JSON From Box
                </button>
              </div>

              <label className="stacked-field">
                State JSON (legacy/manual import)
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
