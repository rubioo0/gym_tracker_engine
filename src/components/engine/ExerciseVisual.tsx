import { getExerciseImageUrls } from '../../domain/exerciseLibrary/exerciseImages'

/** Reuses the old app's `.exercise-visual*` classes (App.css); the 2-frame flip is the one new pattern, in EngineTabs.css. */
export function ExerciseVisual({
  exerciseId,
  exerciseName,
  thumb,
}: {
  exerciseId: string
  exerciseName: string
  /** Compact inline-preview sizing instead of the full modal-sized visual. */
  thumb?: boolean
}) {
  const images = getExerciseImageUrls(exerciseId)

  return (
    <div className={thumb ? 'exercise-visual exercise-visual-thumb' : 'exercise-visual'}>
      {images ? (
        <div className="exercise-visual-flip">
          <img src={images[0]} alt={`${exerciseName} — start position`} loading="lazy" />
          <img src={images[1]} alt={`${exerciseName} — end position`} loading="lazy" />
        </div>
      ) : (
        <div className="exercise-visual-placeholder">
          <strong>{exerciseName}</strong>
          <p>No preview available for this exercise.</p>
        </div>
      )}
    </div>
  )
}
