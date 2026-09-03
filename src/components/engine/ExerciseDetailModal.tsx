import { useEffect, useId, useRef } from 'react'
import { isPerHandEquipment, type LibraryExercise } from '../../domain/exerciseLibrary/exerciseLibrary'
import { WEIGHT_INCREMENT_KG, TARGET_REPS_BY_EMPHASIS, type PrescribedSet } from '../../application/sessionPrescription'
import type { ExerciseHistoryEntry } from '../../application/exerciseHistory'
import type { TrainingEmphasis } from '../../domain/goals/types'
import { getMuscleGroup } from '../../domain/muscles/muscleTaxonomy'
import { ExerciseVisual } from './ExerciseVisual'

interface ExerciseDetailModalProps {
  exercise: LibraryExercise
  sets: number
  isGoalPriority: boolean
  /** Ramp + working set weights/target reps, when available — same prescription the card chips summarize. */
  prescribedSets?: PrescribedSet[]
  /** Full (uncapped, unlike the card's 3-entry preview) recent history. */
  history?: ExerciseHistoryEntry[]
  /** Consecutive most-recent sessions that missed target reps — only meaningful/passed for the goal-priority exercise. */
  heldStreak?: number
  /** Needed only to phrase the "how weight is calculated" explainer's target-rep count for the goal exercise. */
  goalTrainingEmphasis?: TrainingEmphasis
  /** True when shouldDeloadGoalExercise suppressed this session's progression (ACWR overload or 2+ held sessions) — only meaningful for the goal-priority exercise. */
  deloaded?: boolean
  onClose: () => void
}

function formatWeight(weightKg: number, exercise: Pick<LibraryExercise, 'equipment'>): string {
  return isPerHandEquipment(exercise) ? `${weightKg}кг (за руку)` : `${weightKg}кг`
}

/** Same interaction pattern as the old app's SessionExerciseDetailsModal (click a card, see image + instructions), reusing its `.exercise-modal*` classes — rebuilt against the engine's own AssembledExerciseSlot/LibraryExercise shape instead of PlannedExercise. */
export function ExerciseDetailModal({
  exercise,
  sets,
  isGoalPriority,
  prescribedSets,
  history,
  heldStreak,
  goalTrainingEmphasis,
  deloaded,
  onClose,
}: ExerciseDetailModalProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="exercise-modal-backdrop" onClick={onClose}>
      <section
        className="exercise-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="exercise-modal-top">
          <div>
            <p className="exercise-modal-order">{isGoalPriority ? 'Цільова вправа' : 'Підтримка'}</p>
            <h3 id={titleId} className="exercise-modal-title">
              {exercise.nameEn}
            </h3>
          </div>
          <button type="button" className="exercise-modal-close" onClick={onClose} ref={closeButtonRef}>
            Закрити
          </button>
        </header>

        <div className="exercise-modal-layout">
          <ExerciseVisual exerciseId={exercise.id} exerciseName={exercise.nameEn} />

          <div className="exercise-details-stack">
            <div className="exercise-details-grid">
              <div className="exercise-detail-item">
                <span>Підходи</span>
                <strong>{sets}</strong>
              </div>
              {(() => {
                const working = prescribedSets?.find((s) => s.role === 'working')
                return working ? (
                  <>
                    <div className="exercise-detail-item">
                      <span>Цільові повторення</span>
                      <strong>{working.targetReps}</strong>
                    </div>
                    <div className="exercise-detail-item">
                      <span>Вага</span>
                      <strong>{formatWeight(working.weightKg, exercise)}</strong>
                    </div>
                  </>
                ) : null
              })()}
              <div className="exercise-detail-item">
                <span>Обладнання</span>
                <strong>{exercise.equipment ?? '-'}</strong>
              </div>
              <div className="exercise-detail-item">
                <span>Тип</span>
                <strong>{exercise.mechanic ?? '-'}</strong>
              </div>
              <div className="exercise-detail-item">
                <span>Основні м'язи</span>
                <strong>{exercise.primaryMuscles.map((m) => getMuscleGroup(m).labelUk).join(', ') || '-'}</strong>
              </div>
            </div>

            {prescribedSets && prescribedSets.some((s) => s.role === 'ramp') ? (
              <section className="exercise-section">
                <h4>Розминкові підходи</h4>
                <p className="muted">
                  {prescribedSets
                    .filter((s) => s.role === 'ramp')
                    .map((s) => `${formatWeight(s.weightKg, exercise)}×${s.targetReps}`)
                    .join(', ')}
                </p>
              </section>
            ) : null}

            {isGoalPriority && prescribedSets ? (
              <section className="exercise-section">
                <h4>Як розраховується ця вага</h4>
                <p className="muted">
                  {`Це ваша цільова вправа, тож застосовується APRE: останній залогований робочий підхід визначає сьогоднішню вагу. Виконайте ${
                    goalTrainingEmphasis ? TARGET_REPS_BY_EMPHASIS[goalTrainingEmphasis] : ''
                  }+ повторень на робочій вазі — і наступного разу вона зросте на ${WEIGHT_INCREMENT_KG}кг; якщо ні — повториться.`}
                </p>
                {heldStreak && heldStreak > 0 ? (
                  <p className="note">Утримання на цій вазі {heldStreak} сесій поспіль.</p>
                ) : null}
                {deloaded ? (
                  <p className="note">
                    ⚠️ Рекомендовано розвантаження — перевантаження (ACWR) або застій 2+ сесії, тож прогресію
                    призупинено цю сесію, навіть якщо вага вище виглядає незмінною з минулого разу.
                  </p>
                ) : null}
              </section>
            ) : !isGoalPriority && prescribedSets ? (
              <section className="exercise-section">
                <h4>Як розраховується ця вага</h4>
                <p className="muted">
                  Це підтримувальна вправа — вона повторює вашу останню залоговану вагу замість автоматичної
                  прогресії.
                </p>
              </section>
            ) : null}

            {history && history.length > 0 ? (
              <section className="exercise-section">
                <p className="muted exercise-history-label">Історія ({history.length} сесій)</p>
                <div className="exercise-history-all">
                  {history.map((entry) => (
                    <span key={entry.completedAt} className="exercise-history-chip">
                      {formatWeight(entry.weightKg, exercise)}×{entry.reps} ({entry.completedAt.slice(0, 10)})
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {exercise.instructionsEn && exercise.instructionsEn.length > 0 ? (
              <section className="exercise-section">
                <h4>Інструкції</h4>
                <ol>
                  {exercise.instructionsEn.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
