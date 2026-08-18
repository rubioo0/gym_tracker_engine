/**
 * Hand-reviewed mapping from the old app's (gym_tracker/src/data/seed.ts)
 * exercise names to this library's exercise ids. NOT auto-generated —
 * `tools/exercise-library-gen`'s fuzzy matcher produces a report
 * (data/unmatched-exercises-report.json) as a starting point, but several
 * of its fuzzy suggestions were reviewed and rejected here as unsafe
 * substitutions (e.g. "Incline Leg Press" fuzzy-matched to
 * "Incline Dumbbell Press", which is actually a CHEST exercise; "Wide Grip
 * Pull-up" only had a behind-the-neck variant in the dataset, a materially
 * different and riskier movement). Rejected ones point to a
 * data/custom-exercises.json entry instead of a mismatched real one.
 *
 * See exerciseLibrary.test.ts for the test that exercises every one of
 * these 27 entries against the real merged library.
 */
export const OLD_APP_EXERCISE_ALIASES: Readonly<Record<string, string>> = {
  'Neutral Grip Pull-up': 'custom-neutral-grip-pull-up', // no confident real match found
  'Parallel Bar Dips': 'Parallel_Bar_Dip',
  'Barbell Curl': 'Barbell_Curl',
  'Seated Dumbbell Shoulder Press': 'custom-seated-dumbbell-shoulder-press', // fuzzy match was One-Arm variant — materially different (unilateral), rejected
  'Wrist Curl (Palms Up)': 'Seated_Palm-Up_Barbell_Wrist_Curl',
  'Wide Grip Pull-up': 'custom-wide-grip-pull-up', // only real match was a behind-the-neck variant — different risk profile, rejected
  'Hammer Curl': 'Alternate_Hammer_Curl',
  'Incline Dumbbell Curl': 'Incline_Dumbbell_Curl',
  'Overhead Dumbbell Triceps Extension': 'custom-overhead-dumbbell-triceps-extension', // fuzzy match was Decline variant — different exercise, rejected
  'Horizontal Leg Press': 'Leg_Press',
  'Seated Calf Raise': 'Seated_Calf_Raise',
  'Seated Leg Curl': 'Seated_Leg_Curl',
  'Hip Abduction Machine': 'custom-hip-abduction-machine', // no match at all in free-exercise-db
  'Incline Leg Press': 'custom-incline-leg-press', // fuzzy match was a CHEST press exercise — dangerous mismatch, rejected
  'Hack Squat': 'Hack_Squat',
  'Barbell Squat': 'Barbell_Squat',
  'Standing Calf Raise': 'Rocking_Standing_Calf_Raise',
  'Resistance Band Curl': 'custom-resistance-band-curl', // no close match
  'Push-up': 'Pushups',
  'Band Row': 'custom-band-row', // no band-specific row in the dataset
  'Bodyweight Squat': 'Bodyweight_Squat',
  'Single-Leg Calf Raise': 'custom-single-leg-calf-raise', // fuzzy match was the seated (not single-leg) variant — different exercise, rejected
  'Walking Lunge': 'Barbell_Walking_Lunge',
  'Cable Curl': 'Cable_Preacher_Curl',
  'Seated Row': 'Seated_Cable_Rows',
  'Leg Press': 'Leg_Press',
  'Calf Raise': 'Seated_Calf_Raise',
} as const
