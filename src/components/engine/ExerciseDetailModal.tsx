import { useEffect, useId, useRef } from 'react'
import type { LibraryExercise } from '../../domain/exerciseLibrary/exerciseLibrary'
import type { PrescribedSet } from '../../application/sessionPrescription'
import type { ExerciseHistoryEntry } from '../../application/exerciseHistory'
import { ExerciseVisual } from './ExerciseVisual'

interface ExerciseDetailModalProps {
  exercise: LibraryExercise
  sets: number
  isGoalPriority: boolean
  /** Ramp + working set weights/target reps, when available — same prescription the card chips summarize. */
  prescribedSets?: PrescribedSet[]
  /** Full (uncapped, unlike the card's 3-entry preview) recent history. */
  history?: ExerciseHistoryEntry[]
  onClose: () => void
}

/** Same interaction pattern as the old app's SessionExerciseDetailsModal (click a card, see image + instructions), reusing its `.exercise-modal*` classes — rebuilt against the engine's own AssembledExerciseSlot/LibraryExercise shape instead of PlannedExercise. */
export function ExerciseDetailModal({ exercise, sets, isGoalPriority, prescribedSets, history, onClose }: ExerciseDetailModalProps) {
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
                      <strong>{working.weightKg}kg</strong>
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
                    .map((s) => `${s.weightKg}kg×${s.targetReps}`)
                    .join(', ')}
                </p>
              </section>
            ) : null}

            {history && history.length > 0 ? (
              <section className="exercise-section">
                <p className="muted exercise-history-label">History ({history.length} session{history.length !== 1 ? 's' : ''})</p>
                <div className="exercise-history-all">
                  {history.map((entry) => (
                    <span key={entry.completedAt} className="exercise-history-chip">
                      {entry.weightKg}kg×{entry.reps} ({entry.completedAt.slice(0, 10)})
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
