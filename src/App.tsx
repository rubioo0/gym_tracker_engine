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
import {
  findImportedTemplateByFileName,
  upsertProgramTemplateFromCsv,
} from './data/csvTemplateUpsert'
import { exportProgramTemplateToCsv } from './data/csvExport'
import { extractCsvImportMetadata } from './data/csvImport'
import { exportWorkoutLogsToExcel, buildExcelLogFileName } from './data/excelLogExport'
import { importWorkoutLogsFromExcel } from './data/excelLogImport'
import { getRunnableRunForTemplate, getTemplateById } from './domain/logic'
import { appReducer } from './domain/reducer'
import { StatsTab as EngineStatsTab } from './components/engine/StatsTab'
import { PlanEditorModal } from './components/PlanEditorModal'
import { AIAssistant } from './components/AIAssistant'
import { ProgressPhotos } from './components/photos/ProgressPhotos'
import { AIGeneratorPanel } from './components/programs/AIGeneratorPanel'
import type {
  ProgramMode,
  ProgramTemplate,
  TrackType,
} from './domain/types'
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
import './App.css'

type AppTab =
  | 'home'
  | 'programs'
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
  { id: 'programs', label: 'Програми' },
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

function rewriteCsvSourceFileName(csvText: string, sourceFileName: string): string {
  const replacement = `training-os-metadata,source-file-name,${sourceFileName}`
  return csvText.replace(
    /(^|\r?\n)training-os-metadata,source-file-name,[^\r\n]*/i,
    (_, prefix: string) => `${prefix}${replacement}`,
  )
}

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState)
  const { state: engineState } = useEngineState()
  const engineActive = useMemo(() => getActiveGoalAndBlock(engineState), [engineState])
  const engineSessionsInBlock = useMemo(
    () => (engineActive ? countSessionsInBlock(engineState.workoutLogs, engineActive.block) : 0),
    [engineActive, engineState.workoutLogs],
  )
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [importText, setImportText] = useState('')
  const [dataMessage, setDataMessage] = useState('')
  const [csvRawText, setCsvRawText] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvUploadedFileName, setCsvUploadedFileName] = useState('')
  const [csvMetadataSourceFileName, setCsvMetadataSourceFileName] = useState('')
  const [csvIgnoreMetadataSourceFileName, setCsvIgnoreMetadataSourceFileName] = useState(false)
  const [csvProgramName, setCsvProgramName] = useState('Imported CSV Program')
  const [csvTrack, setCsvTrack] = useState<TrackType>('upper')
  const [csvMode, setCsvMode] = useState<ProgramMode>('main')
  const [csvFocusTarget, setCsvFocusTarget] = useState('biceps')
  const [csvDurationWeeks, setCsvDurationWeeks] = useState(8)
  const [csvHardOverwrite, setCsvHardOverwrite] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [createProgramOpen, setCreateProgramOpen] = useState(false)
  const [aiGenTemplate, setAiGenTemplate] = useState<ProgramTemplate | null>(null)

  useEffect(() => {
    saveAppState(state)
  }, [state])

  const templatesByMode = useMemo(() => {
    const grouped: Record<string, ProgramTemplate[]> = {
      main: [],
      travel: [],
      maintenance: [],
      backup: [],
    }

    state.programTemplates.forEach((template) => {
      grouped[template.mode].push(template)
    })

    return grouped
  }, [state.programTemplates])

  const selectedTemplateSet = useMemo(
    () => new Set(selectedTemplateIds),
    [selectedTemplateIds],
  )

  const csvImportPreview = useMemo(() => {
    if (!csvRawText.trim()) {
      return null
    }

    const targetFileName = csvIgnoreMetadataSourceFileName
      ? csvUploadedFileName || csvFileName
      : csvMetadataSourceFileName || csvUploadedFileName || csvFileName
    const resolvedTemplate = targetFileName
      ? findImportedTemplateByFileName(state.programTemplates, targetFileName)
      : undefined

    return {
      targetFileName,
      resolvedTemplate,
      usesMetadataSource:
        csvMetadataSourceFileName.length > 0 &&
        csvMetadataSourceFileName !== csvUploadedFileName,
    }
  }, [
    csvFileName,
    csvMetadataSourceFileName,
      csvIgnoreMetadataSourceFileName,
    csvRawText,
    csvUploadedFileName,
    state.programTemplates,
  ])

  const aiSettings = loadAISettings()

  function handleTabChange(tab: AppTab): void {
    setActiveTab(tab)
  }

  function handleOpenTemplatePlan(templateId: string): void {
    const runnableRun = getRunnableRunForTemplate(state.focusRuns, templateId)
    if (runnableRun) {
      dispatch({ type: 'switchRun', runId: runnableRun.id })
      setActiveTab('session')
      return
    }

    const template = getTemplateById(state.programTemplates, templateId)
    if (!template) {
      setDataMessage('Template not found.')
      return
    }

    const approved = window.confirm(
      `No active run exists for "${template.name}". Start one and open Session Plan?`,
    )
    if (!approved) {
      return
    }

    dispatch({
      type: 'startRun',
      templateId: template.id,
      now: new Date().toISOString(),
    })
    setActiveTab('session')
  }

  function handleResetAllData(): void {
    const approved = window.confirm(
      'This will remove all runs and logs and load seeded templates. Continue?',
    )
    if (!approved) {
      return
    }

    clearAppState()
    dispatch({
      type: 'clearAllData',
      templates: seededProgramTemplates,
    })
    setDataMessage('State reset to seeded templates.')
  }

  function handleDeleteTemplate(templateId: string, templateName: string): void {
    const approved = window.confirm(
      `Delete program "${templateName}"? This cannot be undone.`,
    )
    if (!approved) {
      return
    }

    dispatch({
      type: 'deleteTemplates',
      templateIds: [templateId],
    })
    setSelectedTemplateIds((previous) =>
      previous.filter((selectedId) => selectedId !== templateId),
    )
    setDataMessage(`Deleted program "${templateName}".`)
  }

  function handleBulkDeleteTemplates(): void {
    const selectedTemplates = state.programTemplates.filter((template) =>
      selectedTemplateSet.has(template.id),
    )

    if (selectedTemplates.length === 0) {
      return
    }

    const approved = window.confirm(
      `Delete ${selectedTemplates.length} selected program(s)? This cannot be undone.`,
    )
    if (!approved) {
      return
    }

    dispatch({
      type: 'deleteTemplates',
      templateIds: selectedTemplates.map((template) => template.id),
    })
    setSelectedTemplateIds([])
    setDataMessage(`Deleted ${selectedTemplates.length} selected program(s).`)
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

  function handleExportState(): void {
    const text = exportAppStateJson(state)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `training-os-backup-${timestamp}.json`
    const backupBlob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const backupUrl = URL.createObjectURL(backupBlob)
    const link = document.createElement('a')
    link.href = backupUrl
    link.download = fileName
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 0)

    setDataMessage(`Backup downloaded: ${fileName}`)
  }

  function handleExportCleanState(): void {
    const text = exportCleanAppStateJson(state)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `training-os-backup-clean-${timestamp}.json`
    const backupBlob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const backupUrl = URL.createObjectURL(backupBlob)
    const link = document.createElement('a')
    link.href = backupUrl
    link.download = fileName
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 0)

    setDataMessage(
      `Clean backup downloaded: ${fileName} (archived/completed runs excluded, active/paused runs only)`,
    )
  }

  function handleExportCsvTemplate(template: ProgramTemplate): void {
    try {
      const result = exportProgramTemplateToCsv(template)
      const excelFriendlyCsvText =
        result.csvText.startsWith('\uFEFF') ? result.csvText : `\uFEFF${result.csvText}`
      const csvBlob = new Blob([excelFriendlyCsvText], {
        type: 'text/csv;charset=utf-8',
      })
      const csvUrl = URL.createObjectURL(csvBlob)
      const link = document.createElement('a')
      link.href = csvUrl
      link.download = result.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(csvUrl), 0)

      setDataMessage(
        result.skippedSessionCount > 0
          ? `CSV exported: ${result.fileName} (${result.exportedExerciseCount} exercises from the first session).`
          : `CSV exported: ${result.fileName}`,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown CSV export error.'
      setDataMessage(`CSV export failed: ${message}`)
    }
  }

  function handleImportState(): void {
    const imported = importStateFromJson(importText)
    if (!imported) {
      setDataMessage('Import failed: invalid JSON payload.')
      return
    }

    dispatch({ type: 'hydrate', payload: imported })
    setDataMessage('State imported successfully.')
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
      setImportText(text)
      setDataMessage(`Imported backup file: ${file.name}`)
    } catch {
      setDataMessage('Failed to read backup file.')
    }
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const metadata = extractCsvImportMetadata(text)
      const effectiveFileName = metadata.sourceFileName?.trim() || file.name
      const uploadedFileName = file.name
      const metadataSourceFileName = metadata.sourceFileName?.trim() ?? ''

      setCsvRawText(text)
      setCsvFileName(effectiveFileName)
      setCsvUploadedFileName(uploadedFileName)
      setCsvMetadataSourceFileName(metadataSourceFileName)

      if (metadata.programName) {
        setCsvProgramName(metadata.programName)
      }

      if (metadata.mode) {
        setCsvMode(metadata.mode)
      }

      if (metadata.track) {
        setCsvTrack(metadata.track)
      }

      if (metadata.focusTarget) {
        setCsvFocusTarget(metadata.focusTarget)
      }

      if (typeof metadata.durationWeeks === 'number') {
        setCsvDurationWeeks(metadata.durationWeeks)
      }

      if (!metadata.programName && csvProgramName === 'Imported CSV Program') {
        setCsvProgramName(file.name.replace(/\.[^/.]+$/, ''))
      }

      setDataMessage(
        metadata.templateId
          ? `Loaded CSV: ${file.name} (program metadata detected).`
          : metadataSourceFileName && metadataSourceFileName !== uploadedFileName
            ? `Loaded CSV: ${file.name}. Metadata source-file-name is "${metadataSourceFileName}".`
            : `Loaded CSV: ${file.name}`,
      )
    } catch {
      setDataMessage('Failed to read CSV file.')
    }
  }

  function handleImportCsvTemplate(): void {
    if (!csvRawText.trim()) {
      setDataMessage('Select a CSV file first.')
      return
    }

    const effectiveCsvText =
      csvIgnoreMetadataSourceFileName && csvUploadedFileName
        ? rewriteCsvSourceFileName(csvRawText, csvUploadedFileName)
        : csvRawText

    try {
      const result = upsertProgramTemplateFromCsv({
        templates: state.programTemplates,
        csvText: effectiveCsvText,
        fileName: csvUploadedFileName || csvFileName || undefined,
        programName: csvProgramName,
        mode: csvMode,
        track: csvTrack,
        focusTarget: csvFocusTarget,
        durationWeeks: csvDurationWeeks,
        hardOverwrite: csvHardOverwrite,
      })

      if (result.status === 'conflict') {
        const details = result.details
        const conflictParts: string[] = []

        if (details.templateId && details.resolvedTemplateIdByTemplateId) {
          conflictParts.push(
            `template-id "${details.templateId}" -> "${details.resolvedTemplateIdByTemplateId}"`,
          )
        }

        if (
          details.metadataSourceFileName &&
          details.resolvedTemplateIdBySourceFileName
        ) {
          conflictParts.push(
            `source-file-name "${details.metadataSourceFileName}" -> "${details.resolvedTemplateIdBySourceFileName}"`,
          )
        }

        const conflictDetails =
          conflictParts.length > 0 ? ` (${conflictParts.join('; ')})` : ''

        setDataMessage(`CSV import blocked: ${result.message}${conflictDetails}`)
        return
      }

      dispatch({
        type: 'replaceTemplates',
        templates: result.nextTemplates,
      })

      const warningSuffix =
        result.warnings.length > 0 ? ` Warnings: ${result.warnings.join(' ')}` : ''

      if (result.operation === 'updated') {
        const overwritePrefix = csvHardOverwrite ? 'Hard overwrite enabled. ' : ''
        setDataMessage(
          `${overwritePrefix}Updated "${result.template.name}" from ${csvFileName}: ${result.diff.updatedExercises} changed, ${result.diff.addedExercises} added, ${result.diff.removedExercises} removed, ${result.diff.preservedExerciseIds} progression IDs preserved, ${result.diff.preservedSessions} non-imported sessions preserved.${warningSuffix}`,
        )
      } else {
        setDataMessage(
          `Imported "${result.template.name}" with ${result.diff.totalExercises} exercises.${warningSuffix}`,
        )
      }

      setActiveTab('programs')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown CSV import error.'
      setDataMessage(`CSV import failed: ${message}`)
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

      {activeTab === 'programs' && (
        <section className="panel-grid">
          <article className="card card-wide">
            <AIGeneratorPanel
              apiKey={aiSettings.apiKey}
              model={aiSettings.model}
              onGenerated={(template) => setAiGenTemplate(template)}
            />
          </article>

          <article className="card card-wide">
            <h2>Шаблони програм</h2>
            <div className="action-row">
              <button
                type="button"
                onClick={() => setCreateProgramOpen(true)}
              >
                + Створити програму
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleBulkDeleteTemplates}
                disabled={selectedTemplateIds.length === 0}
              >
                Delete selected ({selectedTemplateIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTemplateIds([])}
                disabled={selectedTemplateIds.length === 0}
              >
                Clear selection
              </button>
            </div>

            {Object.entries(templatesByMode).map(([mode, templates]) => {
              const modeTemplateIds = new Set(templates.map((template) => template.id))
              const allModeSelected =
                templates.length > 0 &&
                templates.every((template) => selectedTemplateSet.has(template.id))
              const hasModeSelection = templates.some((template) =>
                selectedTemplateSet.has(template.id),
              )

              return (
                <div key={mode} className="template-group">
                  <div className="template-group-header">
                    <h3>{mode.toUpperCase()}</h3>
                    {templates.length > 0 ? (
                      <div className="action-row">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTemplateIds((previous) => {
                              const next = new Set(previous)
                              templates.forEach((template) => next.add(template.id))
                              return Array.from(next)
                            })
                          }
                          disabled={allModeSelected}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTemplateIds((previous) =>
                              previous.filter((selectedId) => !modeTemplateIds.has(selectedId)),
                            )
                          }
                          disabled={!hasModeSelection}
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {templates.length === 0 ? (
                    <p className="muted">Немає шаблонів у цьому режимі.</p>
                  ) : (
                    <ul className="list-plain">
                      {templates.map((template) => (
                        <li key={template.id} className="item-row">
                          <div>
                            <label className="item-select-label">
                              <input
                                type="checkbox"
                                checked={selectedTemplateSet.has(template.id)}
                                onChange={(event) =>
                                  setSelectedTemplateIds((previous) => {
                                    if (event.target.checked) {
                                      return previous.includes(template.id)
                                        ? previous
                                        : [...previous, template.id]
                                    }

                                    return previous.filter(
                                      (selectedId) => selectedId !== template.id,
                                    )
                                  })
                                }
                              />
                              <strong>{template.name}</strong>
                            </label>
                            <div className="muted">
                              Напрямок: {template.track} | Фокус: {template.focusTarget} | Сесії:{' '}
                              {template.sessions.length}
                            </div>
                          </div>
                          <div className="action-row">
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: 'startRun',
                                  templateId: template.id,
                                  now: new Date().toISOString(),
                                })
                              }
                            >
                              Розпочати тренування
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTemplatePlan(template.id)}
                            >
                              View Plan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTemplateId(template.id)}
                            >
                              Edit Plan
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportCsvTemplate(template)}
                            >
                              Export CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(template.id, template.name)}
                              className="btn-danger"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </article>
        </section>
      )}

      {activeTab === 'runs' && <FocusTab />}

      {activeTab === 'session' && <TodayTab onGoToFinish={() => setActiveTab('log')} />}

      {activeTab === 'log' && <FinishSessionTab />}

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
                Use the clean backup when cache-busting or updating your app (excludes
                archived/completed runs). Use full backup to preserve all historical data.
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
                Export your workout log history to an Excel file. Edit it externally
                (adjust weights, dates, etc.), then re-import. Importing replaces all
                current logs and recalculates run counters.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  onClick={handleExportLogsExcel}
                  disabled={state.workoutLogs.length === 0}
                >
                  Export Logs to Excel ({state.workoutLogs.length})
                </button>
              </div>
              <div className="action-row">
                <label className="stacked-field inline-file-field">
                  Import Logs from Excel
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImportLogsExcel}
                  />
                </label>
              </div>
            </div>

            <div className="template-group">
              <h3>CSV Program Import / Update</h3>
              <p className="muted">
                Choose your template CSV (for example Book 2(...).csv), set basic
                metadata, then import. Uploading the same filename updates the
                existing imported program instead of creating a duplicate.
              </p>

              <label className="stacked-field">
                CSV file
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} />
              </label>

              {csvUploadedFileName ? (
                <p className="muted">Uploaded file: {csvUploadedFileName}</p>
              ) : null}

              {csvMetadataSourceFileName ? (
                <p className="muted">CSV metadata source-file-name: {csvMetadataSourceFileName}</p>
              ) : null}

              {csvImportPreview?.targetFileName ? (
                <p className="muted">Resolved update target filename: {csvImportPreview.targetFileName}</p>
              ) : null}

              {csvImportPreview?.resolvedTemplate ? (
                <p className="muted">
                  Preview: will update template "{csvImportPreview.resolvedTemplate.name}" ({csvImportPreview.resolvedTemplate.track} / {csvImportPreview.resolvedTemplate.focusTarget})
                </p>
              ) : csvRawText.trim() ? (
                <p className="muted">Preview: no existing template matched. Import will create a new template.</p>
              ) : null}

              {csvImportPreview?.usesMetadataSource ? (
                <p className="note">
                  This CSV carries source-file-name metadata, so matching uses that value instead of the uploaded file name.
                </p>
              ) : null}

                      <label className="inline-field">
                        Ignore CSV source-file-name metadata
                        <input
                          type="checkbox"
                          checked={csvIgnoreMetadataSourceFileName}
                          onChange={(event) => setCsvIgnoreMetadataSourceFileName(event.target.checked)}
                        />
                      </label>

              <div className="action-row">
                <label className="inline-field">
                  Program name
                  <input
                    type="text"
                    value={csvProgramName}
                    onChange={(event) => setCsvProgramName(event.target.value)}
                  />
                </label>

                <label className="inline-field">
                  Mode
                  <select
                    value={csvMode}
                    onChange={(event) => setCsvMode(event.target.value as ProgramMode)}
                  >
                    <option value="main">main</option>
                    <option value="travel">travel</option>
                    <option value="maintenance">maintenance</option>
                    <option value="backup">backup</option>
                  </select>
                </label>

                <label className="inline-field">
                  Track
                  <select
                    value={csvTrack}
                    onChange={(event) => setCsvTrack(event.target.value as TrackType)}
                  >
                    <option value="upper">upper</option>
                    <option value="lower">lower</option>
                    <option value="custom">custom</option>
                  </select>
                </label>

                <label className="inline-field">
                  Focus target
                  <input
                    type="text"
                    value={csvFocusTarget}
                    onChange={(event) => setCsvFocusTarget(event.target.value)}
                  />
                </label>

                <label className="inline-field">
                  Duration (weeks)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={csvDurationWeeks}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value)
                      setCsvDurationWeeks(
                        Number.isFinite(nextValue) && nextValue > 0
                          ? Math.round(nextValue)
                          : 8,
                      )
                    }}
                  />
                </label>

                <label className="inline-field">
                  Hard overwrite exercises
                  <input
                    type="checkbox"
                    checked={csvHardOverwrite}
                    onChange={(event) => setCsvHardOverwrite(event.target.checked)}
                  />
                </label>
              </div>

              <div className="action-row">
                <button type="button" onClick={handleImportCsvTemplate}>
                  Import / Update CSV Template
                </button>
              </div>
            </div>

            <div className="template-group">
              <h3>⚠️ Danger Zone</h3>
              <p className="muted">
                Небезпечні операції — скидання та перезапис даних.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'replaceTemplates',
                      templates: seededProgramTemplates,
                    })
                  }
                >
                  Replace Templates From Seed
                </button>
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

    {editingTemplateId !== null && (
      <PlanEditorModal
        template={getTemplateById(state.programTemplates, editingTemplateId) ?? null}
        onSave={(template) => {
          dispatch({ type: 'updateProgramTemplate', template })
          setEditingTemplateId(null)
        }}
        onClose={() => setEditingTemplateId(null)}
      />
    )}

    {(createProgramOpen || aiGenTemplate !== null) && (
      <PlanEditorModal
        template={aiGenTemplate}
        onSave={(template) => {
          dispatch({ type: 'addProgramTemplate', template })
          setCreateProgramOpen(false)
          setAiGenTemplate(null)
        }}
        onClose={() => {
          setCreateProgramOpen(false)
          setAiGenTemplate(null)
        }}
      />
    )}
    <AIAssistant appState={state} onDispatch={dispatch} />
    </>
  )
}

export default App
