import { useEffect, useId, useRef } from 'react'
import { isPerHandEquipment, type LibraryExercise } from '../../domain/exerciseLibrary/exerciseLibrary'
import { WEIGHT_INCREMENT_KG, TARGET_REPS_BY_EMPHASIS, type PrescribedSet } from '../../application/sessionPrescription'
import type { ExerciseHistoryEntry } from '../../application/exerciseHistory'
import type { TrainingEmphasis } from '../../domain/goals/types'
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
  onClose: () => void
}

function formatWeight(weightKg: number, exercise: Pick<LibraryExercise, 'equipment'>): string {
  return isPerHandEquipment(exercise) ? `${weightKg}kg (per hand)` : `${weightKg}kg`
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
            <p className="exercise-modal-order">{isGoalPriority ? 'Goal exercise' : 'Maintenance'}</p>
            <h3 id={titleId} className="exercise-modal-title">
              {exercise.nameEn}
            </h3>
          </div>
          <button type="button" className="exercise-modal-close" onClick={onClose} ref={closeButtonRef}>
            Close
          </button>
        </header>

        <div className="exercise-modal-layout">
          <ExerciseVisual exerciseId={exercise.id} exerciseName={exercise.nameEn} />

          <div className="exercise-details-stack">
            <div className="exercise-details-grid">
              <div className="exercise-detail-item">
                <span>Sets</span>
                <strong>{sets}</strong>
              </div>
              {(() => {
                const working = prescribedSets?.find((s) => s.role === 'working')
                return working ? (
                  <>
                    <div className="exercise-detail-item">
                      <span>Target reps</span>
                      <strong>{working.targetReps}</strong>
                    </div>
                    <div className="exercise-detail-item">
                      <span>Weight</span>
                      <strong>{formatWeight(working.weightKg, exercise)}</strong>
                    </div>
                  </>
                ) : null
              })()}
              <div className="exercise-detail-item">
                <span>Equipment</span>
                <strong>{exercise.equipment ?? '-'}</strong>
              </div>
              <div className="exercise-detail-item">
                <span>Type</span>
                <strong>{exercise.mechanic ?? '-'}</strong>
              </div>
              <div className="exercise-detail-item">
                <span>Primary</span>
                <strong>{exercise.primaryMuscles.join(', ') || '-'}</strong>
              </div>
            </div>

            {prescribedSets && prescribedSets.some((s) => s.role === 'ramp') ? (
              <section className="exercise-section">
                <h4>Ramp sets</h4>
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
                <h4>How this weight is calculated</h4>
                <p className="muted">
                  {`This is your goal exercise, so it follows APRE: your last logged top set decides today's weight. Hit ${
                    goalTrainingEmphasis ? TARGET_REPS_BY_EMPHASIS[goalTrainingEmphasis] : 'the'
                  }+ reps at the working weight and next time it goes up by ${WEIGHT_INCREMENT_KG}kg; miss it and it repeats.`}
                </p>
                {heldStreak && heldStreak > 0 ? (
                  <p className="note">
                    Held at this weight for {heldStreak} session{heldStreak !== 1 ? 's' : ''} in a row.
                  </p>
                ) : null}
              </section>
            ) : !isGoalPriority && prescribedSets ? (
              <section className="exercise-section">
                <h4>How this weight is calculated</h4>
                <p className="muted">
                  This is a maintenance exercise — it repeats your last logged weight rather than progressing automatically.
                </p>
              </section>
            ) : null}

            {history && history.length > 0 ? (
              <section className="exercise-section">
                <p className="muted exercise-history-label">History ({history.length} session{history.length !== 1 ? 's' : ''})</p>
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
                <h4>Instructions</h4>
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
