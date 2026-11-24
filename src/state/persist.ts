import type { Tournament } from '../domain/types';

export const STORAGE_KEY = 'dartplaner.v1';

export function loadTournament(storage: Storage = localStorage): Tournament | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const t = JSON.parse(raw) as Tournament | null;
    return t && t.version === 1 ? t : null;
  } catch {
    return null;
  }
}

export function saveTournament(t: Tournament, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(t));
    return true;
  } catch {
    return false;
  }
}

export function clearTournament(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear if storage is unavailable
  }
}
