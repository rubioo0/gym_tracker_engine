import { useMemo, useState } from 'react'
import { useEngineState } from './useEngineState'
import { MUSCLE_GROUPS, getMuscleGroup, type MuscleGroupId } from '../../domain/muscles/muscleTaxonomy'
import type { DeficitLabel, ExperienceLevel, UserProfile } from '../../domain/profile/types'
import { getExerciseById, getExercisesWithPrimaryMuscle } from '../../domain/exerciseLibrary/exerciseLibrary'
import type { TrainingEmphasis } from '../../domain/goals/types'
import { createGoalWithBlock } from '../../application/goalCreation'
import { recommendExerciseForMuscle } from '../../application/exerciseRecommendation'
import {
  suggestGoalTargetAndDeadline,
  DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE,
} from '../../application/goalRecommendation'
import { getActiveGoalAndBlock } from '../../application/activeGoal'
import { isPersistedState } from '../../application/state'
import { suggestStartingWeightFromOldApp } from '../../application/oldAppHistory'
import { buildFocusHistorySeed } from '../../application/focusHistory'
import { pickNextFocus } from '../../domain/specialization/specialization'
import type { WorkoutLog as OldAppWorkoutLog } from '../../domain/types'
import { ExerciseVisual } from './ExerciseVisual'
import { NumberDraftInput } from './NumberDraftInput'
import './EngineTabs.css'

function defaultProfile(): UserProfile {
  return { deficitLabel: 'notDieting', sessionsPerWeek: 3, injuredMuscles: [], experienceByMuscle: {} }
}

export function SetupTab({ oldWorkoutLogs }: { oldWorkoutLogs: readonly OldAppWorkoutLog[] }) {
  const { state, dispatch, loaded } = useEngineState()

  const active = useMemo(() => getActiveGoalAndBlock(state), [state])
  const activeGoal = active?.goal
  const activeBlock = active?.block

  const [profileDraft, setProfileDraft] = useState<UserProfile>(state.profile ?? defaultProfile())

  if (!loaded) {
    return (
      <section className="panel-grid">
        <article className="card">
          <p className="muted">Завантаження…</p>
        </article>
      </section>
    )
  }

  function saveProfile() {
    dispatch({ type: 'SET_PROFILE', profile: profileDraft })
  }

  function toggleInjury(muscleGroupId: MuscleGroupId) {
    setProfileDraft((prev) => {
      const isInjured = prev.injuredMuscles.includes(muscleGroupId)
      return {
        ...prev,
        injuredMuscles: isInjured
          ? prev.injuredMuscles.filter((m) => m !== muscleGroupId)
          : [...prev.injuredMuscles, muscleGroupId],
      }
    })
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `autonomous-engine-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(reader.result as string)
      } catch {
        window.alert('Не вдалося прочитати цей файл як JSON.')
        return
      }
      if (!isPersistedState(parsed)) {
        window.alert('Цей файл не схожий на дійсну резервну копію автономного модуля.')
        return
      }
      if (window.confirm('Імпорт замінить усі дані автономного модуля (лише Автопрофіль/Сьогодні). Продовжити?')) {
        dispatch({ type: 'REPLACE_STATE', state: parsed })
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <section className="panel-grid">
      <article className="card">
        <h2>Профіль</h2>
        <div className="log-input-grid">
          <label className="stacked-field">
            Сесій на тиждень
            <NumberDraftInput
              min={1}
              value={profileDraft.sessionsPerWeek}
              onCommit={(n) => {
                if (n !== undefined) setProfileDraft({ ...profileDraft, sessionsPerWeek: n })
              }}
            />
          </label>
          <label className="stacked-field">
            Дефіцит калорій
            <select
              value={profileDraft.deficitLabel}
              onChange={(e) => setProfileDraft({ ...profileDraft, deficitLabel: e.target.value as DeficitLabel })}
            >
              <option value="notDieting">Без дієти</option>
              <option value="smallDeficit">Малий дефіцит</option>
              <option value="bigDeficit">Великий дефіцит</option>
            </select>
          </label>
          <label className="stacked-field">
            Вік (років, необов'язково)
            <NumberDraftInput
              optional
              value={profileDraft.ageYears}
              onCommit={(n) => setProfileDraft({ ...profileDraft, ageYears: n })}
            />
          </label>
          <label className="stacked-field">
            Вага тіла (кг, необов'язково)
            <NumberDraftInput
              optional
              value={profileDraft.bodyweightKg}
              onCommit={(n) => setProfileDraft({ ...profileDraft, bodyweightKg: n })}
            />
          </label>
        </div>

        <div className="template-group">
          <h3>Травмовані м'язи (виключаються з тренувань, поки не знято позначку — не медична порада)</h3>
          <div className="log-checkbox-grid">
            {MUSCLE_GROUPS.map((group) => (
              <label key={group.id} className="log-checkbox-field">
                {group.labelUk}
                <input
                  type="checkbox"
                  checked={profileDraft.injuredMuscles.includes(group.id)}
                  onChange={() => toggleInjury(group.id)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="action-row">
          <button type="button" onClick={saveProfile}>
            Зберегти профіль
          </button>
        </div>
      </article>

      {state.profile && (
        <article className="card">
          <h2>Активна ціль</h2>
          {activeGoal ? (
            <p className="next-session-title">
              {getExerciseById(activeGoal.exerciseId)?.nameEn ?? activeGoal.exerciseId}: {activeGoal.startingWeightKg}кг
              -&gt; {activeGoal.targetWeightKg}кг до {activeGoal.deadline.slice(0, 10)} (фокус:{' '}
              {activeBlock ? getMuscleGroup(activeBlock.focusMuscle).labelUk : ''})
            </p>
          ) : (
            <GoalForm profile={state.profile} oldWorkoutLogs={oldWorkoutLogs} />
          )}
        </article>
      )}

      <article className="card">
        <h2>Резервна копія</h2>
        <p className="muted">
          Окремо від основної резервної копії на вкладці Дані — тут лише дані Автопрофіль/Сьогодні.
        </p>
        <div className="action-row">
          <button type="button" onClick={handleExport}>
            Експортувати дані
          </button>
        </div>
        <label className="stacked-field inline-file-field">
          Імпортувати дані
          <input type="file" accept="application/json" onChange={handleImportFile} />
        </label>
      </article>
    </section>
  )
}

function GoalForm({
  profile,
  oldWorkoutLogs,
}: {
  profile: UserProfile
  oldWorkoutLogs: readonly OldAppWorkoutLog[]
}) {
  const { state, dispatch } = useEngineState()

  // Defaults the picker to the least-recently-trained eligible muscle
  // (application/focusHistory.ts + domain/specialization.ts's pickNextFocus,
  // built and tested but never wired into any UI until now) -- still just a
  // suggestion: the dropdown right below remains a free, un-gated override.
  const suggestedFocusMuscle = useMemo(
    () => pickNextFocus(buildFocusHistorySeed(state.specializationBlocks, profile.injuredMuscles)) ?? MUSCLE_GROUPS[0].id,
    [state.specializationBlocks, profile.injuredMuscles],
  )
  const [muscleGroupId, setMuscleGroupId] = useState<MuscleGroupId>(suggestedFocusMuscle)
  const recommended = useMemo(() => recommendExerciseForMuscle(muscleGroupId), [muscleGroupId])
  const exercisesForMuscle = useMemo(
    () => [...getExercisesWithPrimaryMuscle(muscleGroupId)].sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    [muscleGroupId],
  )
  const [manualOverride, setManualOverride] = useState(false)
  const [exerciseId, setExerciseId] = useState(recommended?.id ?? '')

  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile.experienceByMuscle[muscleGroupId] ?? 'beginner',
  )

  function handleMuscleChange(newMuscleGroupId: MuscleGroupId) {
    setMuscleGroupId(newMuscleGroupId)
    setManualOverride(false)
    setExerciseId(recommendExerciseForMuscle(newMuscleGroupId)?.id ?? '')
    setExperienceLevel(profile.experienceByMuscle[newMuscleGroupId] ?? 'beginner')
  }

  // Suggested duration is tiered by experience level (shorter for
  // beginners, who benefit from frequent recalibration; longer for advanced
  // lifters, whose slow per-week rate needs more time to add up to a
  // meaningful target) — same override-on-edit pattern as everything else
  // here, not reset when experience level changes.
  const suggestedDurationWeeks = DEFAULT_GOAL_DURATION_WEEKS_BY_EXPERIENCE[experienceLevel]
  const [durationOverrideWeeks, setDurationOverrideWeeks] = useState<number | null>(null)
  const durationWeeks = durationOverrideWeeks ?? suggestedDurationWeeks

  // Auto-suggested from the most recent weight actually logged for this
  // exercise in the old app's own history (real data already sitting in
  // this merged app), falling back to 0/manual entry when there's no old-app
  // alias or no matching log — same override-on-edit pattern as target
  // weight/deadline below, not reset when the muscle/exercise selection
  // changes (matching that existing behavior).
  const suggestedStartingWeightKg = useMemo(
    () => suggestStartingWeightFromOldApp(oldWorkoutLogs, exerciseId),
    [oldWorkoutLogs, exerciseId],
  )
  const [startingWeightOverrideKg, setStartingWeightOverrideKg] = useState<number | null>(null)
  const startingWeightKg = startingWeightOverrideKg ?? suggestedStartingWeightKg ?? 0

  const suggestion = useMemo(
    () =>
      suggestGoalTargetAndDeadline({
        startingWeightKg,
        experienceLevel,
        deficitLabel: profile.deficitLabel,
        createdAt: new Date(),
        durationWeeks,
      }),
    [startingWeightKg, experienceLevel, durationWeeks, profile.deficitLabel],
  )
  const [targetOverrideKg, setTargetOverrideKg] = useState<number | null>(null)
  const [deadlineOverride, setDeadlineOverride] = useState<string | null>(null)
  const targetWeightKg = targetOverrideKg ?? suggestion.targetWeightKg
  const deadline = deadlineOverride ?? suggestion.deadline.slice(0, 10)

  const [trainingEmphasis, setTrainingEmphasis] = useState<TrainingEmphasis>('hypertrophy')

  function submit() {
    const exercise = getExerciseById(exerciseId)
    if (!exercise) {
      window.alert('Будь ласка, оберіть вправу.')
      return
    }
    if (!deadline) {
      window.alert('Будь ласка, оберіть дедлайн.')
      return
    }
    const { goal, specializationBlock } = createGoalWithBlock(
      {
        exerciseId,
        startingWeightKg,
        targetWeightKg,
        deadline: new Date(deadline).toISOString(),
        trainingEmphasis,
        createdAt: new Date().toISOString(),
      },
      exercise,
      () => crypto.randomUUID(),
    )
    dispatch({
      type: 'SET_PROFILE',
      profile: { ...profile, experienceByMuscle: { ...profile.experienceByMuscle, [muscleGroupId]: experienceLevel } },
    })
    dispatch({ type: 'CREATE_GOAL', goal, specializationBlock })
  }

  return (
    <div className="template-group">
      <p className="note">
        Пропонований наступний фокус (найдавніше тренована група):{' '}
        <strong>{getMuscleGroup(suggestedFocusMuscle).labelUk}</strong>
      </p>
      <label className="stacked-field">
        Група м'язів
        <select value={muscleGroupId} onChange={(e) => handleMuscleChange(e.target.value as MuscleGroupId)}>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>
              {group.labelUk}
            </option>
          ))}
        </select>
      </label>
      <p className="note">
        Рекомендована вправа: <strong>{recommended?.nameEn ?? 'не знайдено для цієї групи'}</strong>
      </p>
      {recommended ? (
        <ExerciseVisual exerciseId={recommended.id} exerciseName={recommended.nameEn} thumb />
      ) : null}
      <label className="log-checkbox-field">
        Обрати іншу вправу вручну
        <input
          type="checkbox"
          checked={manualOverride}
          onChange={(e) => {
            setManualOverride(e.target.checked)
            if (!e.target.checked) {
              setExerciseId(recommended?.id ?? '')
            }
          }}
        />
      </label>
      {manualOverride && (
        <label className="stacked-field">
          Вправа
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            {exercisesForMuscle.length === 0 ? (
              <option value="">Вправ для цієї групи не знайдено</option>
            ) : (
              exercisesForMuscle.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.nameEn}
                </option>
              ))
            )}
          </select>
        </label>
      )}
      <label className="stacked-field">
        Досвід з цією групою м'язів
        <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}>
          <option value="beginner">Початківець</option>
          <option value="intermediate">Середній</option>
          <option value="advanced">Просунутий</option>
        </select>
      </label>
      <div className="log-input-grid">
        <label className="stacked-field">
          Стартова вага (кг) —{' '}
          {suggestedStartingWeightKg !== null
            ? 'пропоновано з вашої історії, можна змінити'
            : 'немає історії зі старої апки для цієї вправи, вкажіть вручну'}
          <NumberDraftInput
            value={startingWeightKg}
            onCommit={(n) => {
              if (n !== undefined) setStartingWeightOverrideKg(n)
            }}
          />
        </label>
        <label className="stacked-field">
          Тривалість (тижні) — пропоновано за рівнем досвіду, можна змінити
          <NumberDraftInput
            min={1}
            value={durationWeeks}
            onCommit={(n) => {
              if (n !== undefined) setDurationOverrideWeeks(n)
            }}
          />
        </label>
        <label className="stacked-field">
          Цільова вага (кг) — пропоновано, можна змінити
          <NumberDraftInput
            value={targetWeightKg}
            onCommit={(n) => {
              if (n !== undefined) setTargetOverrideKg(n)
            }}
          />
        </label>
        <label className="stacked-field">
          Дедлайн — пропоновано, можна змінити
          <input type="date" value={deadline} onChange={(e) => setDeadlineOverride(e.target.value)} />
        </label>
      </div>
      <label className="stacked-field">
        Акцент тренування
        <select value={trainingEmphasis} onChange={(e) => setTrainingEmphasis(e.target.value as TrainingEmphasis)}>
          <option value="strength">Сила</option>
          <option value="hypertrophy">Гіпертрофія</option>
        </select>
      </label>
      <div className="action-row">
        <button type="button" onClick={submit}>
          Створити ціль
        </button>
      </div>
    </div>
  )
}
