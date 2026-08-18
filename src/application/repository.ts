import type { PersistedState } from './state'

/**
 * The one seam worth abstracting, per the confirmed architecture: domain
 * and UI code depend on this interface, never on IndexedDB directly. See
 * infrastructure/storage/indexedDbRepository.ts for the real implementation.
 */
export interface TrainingDataRepository {
  loadState(): Promise<PersistedState | null>
  saveState(state: PersistedState): Promise<void>
}
