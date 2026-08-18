import type { MuscleGroupId } from '../muscles/muscleTaxonomy'

/**
 * A single specialization block (active if `endedAt` is unset). Per the
 * confirmed mental model ("one focus muscle/exercise at a time with
 * maintenance elsewhere"), only one muscle is the focus at a time — this is
 * deliberately not a list. Block *length* is not separately tracked: it
 * runs until the linked Goal (Phase 5) is completed, its deadline passes,
 * or its focus muscle becomes injured (per the application-layer grooming's
 * findings #1/#4/#11/#13 — goal creation IS block creation, and block end
 * is one of those three triggers setting `endedAt`), so there's no separate
 * duration field to keep in sync with the goal.
 *
 * `goalId` and `endedAt` were added when the application layer actually
 * started consuming this type (2026-08-17) — the original Phase 6 domain
 * design didn't need a link back to the goal or an end marker, since
 * `pickNextFocus`'s rotation logic only needs `lastFocusEndedAt` per
 * muscle (see `FocusHistoryEntry` below), not the full block history. The
 * application layer needs both to derive that history from real data.
 */
export interface SpecializationBlock {
  goalId: string
  focusMuscle: MuscleGroupId
  startedAt: string // ISO date
  endedAt: string | null
}

/** One muscle's rotation-eligibility input for pickNextFocus(). */
export interface FocusHistoryEntry {
  muscleGroupId: MuscleGroupId
  /** ISO date the muscle last finished being the active focus, or null if it has never been focus. */
  lastFocusEndedAt: string | null
}
