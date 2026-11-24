import { describe, expect, it } from 'vitest';
import { createTournament, start, startMatch } from '../domain/tournament';
import type { Tournament } from '../domain/types';
import { clearTournament, loadTournament, saveTournament, STORAGE_KEY } from './persist';
import { tournamentReducer } from './useTournament';

const fake = (over: Partial<Storage> = {}): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    ...over,
  } as Storage;
};
const settings = { name: 'Abend', date: '2026-11-24', boards: 4, legs: { group: 3, ko: 3, final: 4 },
  mode: { kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true } } as const;
const midGroup = (): Tournament => {
  let t = start(createTournament(settings, Array.from({ length: 8 }, (_, i) => `S${i + 1}`), 3), 1);
  t = startMatch(t, t.matches[0].id, 2, 2);
  return t;
};

describe('persist', () => {
  it('roundtrips a running tournament', () => {
    const s = fake(); const t = midGroup();
    expect(saveTournament(t, s)).toBe(true);
    expect(loadTournament(s)).toEqual({ t, failed: false });
    expect(loadTournament(s).t!.matches[0].board).toBe(2);
  });
  it('tells nothing stored apart from stored but unreadable, and keeps the unreadable data', () => {
    const s = fake();
    expect(loadTournament(s)).toEqual({ t: null, failed: false });
    s.setItem(STORAGE_KEY, '{nope');
    expect(loadTournament(s)).toEqual({ t: null, failed: true });
    s.setItem(STORAGE_KEY, JSON.stringify({ ...midGroup(), version: 2 }));
    expect(loadTournament(s)).toEqual({ t: null, failed: true });
    expect(s.getItem(STORAGE_KEY)).not.toBeNull();
  });
  it('survives throwing storage', () => {
    const boom = () => { throw new Error('x'); };
    expect(saveTournament(midGroup(), fake({ setItem: boom }))).toBe(false);
    expect(loadTournament(fake({ getItem: boom }))).toEqual({ t: null, failed: false });
  });
  it('clear removes the key', () => {
    const s = fake(); saveTournament(midGroup(), s); clearTournament(s);
    expect(loadTournament(s).t).toBeNull();
  });
});

describe('persist without storage argument', () => {
  it('does not throw when localStorage access throws', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      expect(loadTournament().t).toBeNull();
      expect(saveTournament(midGroup())).toBe(false);
      expect(() => clearTournament()).not.toThrow();
    } finally {
      if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe('tournamentReducer', () => {
  it('keeps old state and sets the German error when an action throws', () => {
    const t = midGroup();
    const r = tournamentReducer({ t, lastError: null, loadFailed: false }, { type: 'startMatch', matchId: 'nope', board: 1 });
    expect(r.t).toBe(t);
    expect(r.lastError).toBe('Spiel nicht gefunden.');
  });
  it('clears lastError on success and resets to null', () => {
    const t = midGroup();
    const ok = tournamentReducer({ t, lastError: 'alt', loadFailed: false }, { type: 'cancelMatch', matchId: t.matches[0].id });
    expect(ok.lastError).toBeNull();
    expect(ok.t!.matches[0].status).not.toBe('running');
    expect(tournamentReducer(ok, { type: 'reset' })).toEqual({ t: null, lastError: null, loadFailed: false });
  });
  it('load replaces the tournament with the one from another tab', () => {
    const t = midGroup(), other = start(createTournament(settings, ['X', 'Y', 'Z', 'W'], 9), 1);
    expect(tournamentReducer({ t, lastError: 'alt', loadFailed: false }, { type: 'load', t: other }))
      .toEqual({ t: other, lastError: null, loadFailed: false });
    expect(tournamentReducer({ t, lastError: null, loadFailed: false }, { type: 'load', t: null }).t).toBeNull();
  });
  it('a failed load stays flagged until a tournament is created or the user resets', () => {
    const failed = { t: null, lastError: null, loadFailed: true };
    expect(tournamentReducer(failed, { type: 'redraw' }).loadFailed).toBe(true);
    expect(tournamentReducer(failed, { type: 'reset' }).loadFailed).toBe(false);
    const created = tournamentReducer(failed, { type: 'create', settings, names: ['A', 'B', 'C', 'D'] });
    expect(created.t).not.toBeNull();
    expect(created.loadFailed).toBe(false);
  });
});
