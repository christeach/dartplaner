import type { Tournament } from '../domain/types';

export const STORAGE_KEY = 'dartplaner.v1';

// failed: something is stored but cannot be read (corrupt or another version) – keep it, do not overwrite silently
export function loadTournament(storage?: Storage): { t: Tournament | null; failed: boolean } {
  let raw: string | null;
  try {
    raw = (storage ?? localStorage).getItem(STORAGE_KEY);
  } catch {
    return { t: null, failed: false };
  }
  if (raw === null) return { t: null, failed: false };
  try {
    const t = JSON.parse(raw) as Tournament | null;
    return t && t.version === 1 ? { t, failed: false } : { t: null, failed: true };
  } catch {
    return { t: null, failed: true };
  }
}

export function saveTournament(t: Tournament, storage?: Storage): boolean {
  try {
    (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(t));
    return true;
  } catch {
    return false;
  }
}

export function clearTournament(storage?: Storage): void {
  try {
    (storage ?? localStorage).removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear if storage is unavailable
  }
}
