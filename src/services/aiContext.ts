import type { PersistedState } from '../application/state'
import type { WorkoutLog } from '../domain/workoutLog/types'
import { getActiveGoalAndBlock, countSessionsInBlock, workoutLogsInBlock } from '../application/activeGoal'
import { mostRecentTopSet } from '../application/sessionPrescription'
import { buildMuscleLoadEntries } from '../application/muscleLoadHistory'
import { acwr, classifyAcwrZone, type AcwrZone } from '../domain/acwr/acwr'
import { getExerciseById } from '../domain/exerciseLibrary/exerciseLibrary'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const ZONE_LABELS: Record<AcwrZone, string> = {
  insufficientData: 'недостатньо даних',
  low: 'низьке навантаження',
  safe: 'безпечна зона',
  elevated: 'підвищений ризик',
  high: 'високий ризик перевантаження',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'легко',
  okay: 'нормально',
  hard: 'важко',
}

function exerciseName(exerciseId: string): string {
  return getExerciseById(exerciseId)?.nameEn ?? exerciseId
}

/** Same block-scoping as goal-renewal checks and today's prescription (application/activeGoal.ts) — a previous block's history on the same exercise must not be reported as this block's progress. */
function buildActiveGoalSection(state: PersistedState): string {
  const active = getActiveGoalAndBlock(state)
  if (!active) {
    return '## Активна ціль\nНаразі немає активної цілі тренувань.'
  }

  const { goal, block } = active
  const blockLogs = workoutLogsInBlock(state.workoutLogs, block)
  const currentTop = mostRecentTopSet(blockLogs, goal.exerciseId)
  const sessionsCompleted = countSessionsInBlock(state.workoutLogs, block)

  const lines: string[] = [
    '## Активна ціль',
    `- Вправа: ${exerciseName(goal.exerciseId)}`,
    `- Фокус-м'яз: ${block.focusMuscle}`,
    `- Стартова вага: ${goal.startingWeightKg}kg, ціль: ${goal.targetWeightKg}kg, дедлайн: ${formatDate(goal.deadline)}`,
    `- Поточна вага (останній зафіксований підхід у цьому блоці): ${
      currentTop ? `${currentTop.weightKg}kg × ${currentTop.reps}` : 'ще не зафіксовано жодного підходу'
    }`,
    `- Сесій виконано в цьому блоці: ${sessionsCompleted}`,
    `- Тренувальний акцент: ${goal.trainingEmphasis === 'strength' ? 'сила' : 'гіпертрофія'}`,
  ]

  const loadEntries = buildMuscleLoadEntries(state.workoutLogs, block.focusMuscle)
  const ratio = acwr(loadEntries, new Date())
  const zone = classifyAcwrZone(ratio)
  lines.push(`- Навантаження на фокус-м'яз (ACWR): ${ratio !== null ? ratio.toFixed(2) : '-'} (${ZONE_LABELS[zone]})`)

  return lines.join('\n')
}

function buildRecentWorkoutsSection(workoutLogs: readonly WorkoutLog[]): string {
  if (workoutLogs.length === 0) return ''

  const recent = workoutLogs
    .slice()
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, 10)

  const lines: string[] = ['## Останні тренування (до 10)']

  for (const log of recent) {
    const date = formatDate(log.completedAt)
    const status = log.successful ? 'успішно' : 'невдало'
    lines.push(`\n### ${date} (${status})`)

    for (const exerciseLog of log.exerciseLogs) {
      if (exerciseLog.skipped) continue
      const workingSets = exerciseLog.sets.filter((s) => s.role === 'working')
      const setsToShow = workingSets.length > 0 ? workingSets : exerciseLog.sets
      const summary = setsToShow.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ')

      let entry = `- ${exerciseName(exerciseLog.exerciseId)}: ${summary}`
      if (exerciseLog.difficulty) {
        entry += ` [${DIFFICULTY_LABELS[exerciseLog.difficulty] ?? exerciseLog.difficulty}]`
      }
      if (exerciseLog.note) entry += ` — "${exerciseLog.note}"`
      lines.push(entry)
    }

    if (log.note) lines.push(`  *Нотатка: ${log.note}*`)
  }

  return lines.join('\n')
}

/**
 * Rebuilt to read the engine's own PersistedState (goals/specializationBlocks/
 * workoutLogs) instead of the old app's AppState — the AI coach used to be
 * built entirely from the old, now-largely-orphaned tree and had no idea
 * about anything happening in the engine-driven tabs a user actually trains
 * through. No dispatchable tool any more either (see AIAssistant.tsx):
 * the old `adjust_exercise_params` action patched a FocusRun field nothing
 * in the engine ever read, so it's retired rather than ported.
 */
export function buildFitnessSystemPrompt(state: PersistedState): string {
  const today = new Date().toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const sections: string[] = [
    'Ти — персональний фітнес-асистент. Відповідай ТІЛЬКИ українською мовою. Будь конкретним і практичним.',
    `Сьогодні: ${today}.`,
    '',
    buildActiveGoalSection(state),
  ]

  const recentSection = buildRecentWorkoutsSection(state.workoutLogs)
  if (recentSection) {
    sections.push('')
    sections.push(recentSection)
  }

  sections.push('')
  sections.push(
    '---\nСпирайся виключно на наведені дані. Якщо даних недостатньо — скажи про це. ' +
      'Давай конкретні, практичні поради. Не вигадуй інформацію, якої немає вище.',
  )

  return sections.join('\n')
}
