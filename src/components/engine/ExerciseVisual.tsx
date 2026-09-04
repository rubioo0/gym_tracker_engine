import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { getExerciseImageUrls } from '../../domain/exerciseLibrary/exerciseImages'
import { loadExercisePhoto, saveExercisePhoto, deleteExercisePhoto } from '../../services/exercisePhotoStorage'
import { resizeImage } from '../../services/imageResize'

/** Reuses the old app's `.exercise-visual*` classes (App.css); the 2-frame flip is the one new pattern, in EngineTabs.css. */
export function ExerciseVisual({
  exerciseId,
  exerciseName,
  thumb,
  editable,
}: {
  exerciseId: string
  exerciseName: string
  /** Compact inline-preview sizing instead of the full modal-sized visual. */
  thumb?: boolean
  /**
   * Shows a camera-capture control below the image, letting the user
   * attach/replace/remove a photo of the actual machine for this exercise
   * -- item 4 from real-usage feedback ("у мене плутанина, яка машина").
   * Off by default so compact read-only previews (e.g. SetupTab's
   * recommended-exercise thumb) don't show a capture button.
   */
  editable?: boolean
}) {
  const images = getExerciseImageUrls(exerciseId)
  const [customPhotoLoaded, setCustomPhotoLoaded] = useState(false)
  const [customPhoto, setCustomPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    loadExercisePhoto(exerciseId)
      .then((photo) => {
        if (cancelled) return
        setCustomPhoto(photo?.dataUrl ?? null)
        setCustomPhotoLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setCustomPhoto(null)
        setCustomPhotoLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    try {
      const dataUrl = await resizeImage(file)
      await saveExercisePhoto(exerciseId, dataUrl)
      setCustomPhoto(dataUrl)
    } catch {
      setError('Не вдалося зберегти фото.')
    }
  }

  async function handleRemove() {
    setError(null)
    try {
      await deleteExercisePhoto(exerciseId)
      setCustomPhoto(null)
    } catch {
      setError('Не вдалося видалити фото.')
    }
  }

  return (
    <div className={thumb ? 'exercise-visual exercise-visual-thumb' : 'exercise-visual'}>
      {customPhoto ? (
        <img className="exercise-visual-photo" src={customPhoto} alt={`${exerciseName} — ваше фото тренажера`} loading="lazy" />
      ) : images ? (
        <div className="exercise-visual-flip">
          <img src={images[0]} alt={`${exerciseName} — start position`} loading="lazy" />
          <img src={images[1]} alt={`${exerciseName} — end position`} loading="lazy" />
        </div>
      ) : (
        <div className="exercise-visual-placeholder">
          <strong>{exerciseName}</strong>
          <p>Немає доступного попереднього перегляду для цієї вправи.</p>
        </div>
      )}

      {editable && customPhotoLoaded ? (
        <div className="exercise-visual-capture action-row">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            📷 {customPhoto ? 'Замінити фото тренажера' : 'Сфотографувати тренажер'}
          </button>
          {customPhoto ? (
            <button type="button" onClick={() => void handleRemove()}>
              Видалити фото
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(event) => void handleFileChange(event)}
          />
          {error ? <p className="note">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
