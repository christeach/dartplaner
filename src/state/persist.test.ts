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
    expect(loadTournament(s)).toEqual(t);
    expect(loadTournament(s)!.matches[0].board).toBe(2);
  });
  it('returns null for missing, corrupt or wrong-version data', () => {
    const s = fake();
    expect(loadTournament(s)).toBeNull();
    s.setItem(STORAGE_KEY, '{nope');
    expect(loadTournament(s)).toBeNull();
    s.setItem(STORAGE_KEY, JSON.stringify({ ...midGroup(), version: 2 }));
    expect(loadTournament(s)).toBeNull();
  });
  it('survives throwing storage', () => {
    const boom = () => { throw new Error('x'); };
    expect(saveTournament(midGroup(), fake({ setItem: boom }))).toBe(false);
    expect(loadTournament(fake({ getItem: boom }))).toBeNull();
  });
  it('clear removes the key', () => {
    const s = fake(); saveTournament(midGroup(), s); clearTournament(s);
    expect(loadTournament(s)).toBeNull();
  });
});

describe('tournamentReducer', () => {
  it('keeps old state and sets the German error when an action throws', () => {
    const t = midGroup();
    const r = tournamentReducer({ t, lastError: null }, { type: 'startMatch', matchId: 'nope', board: 1 });
    expect(r.t).toBe(t);
    expect(r.lastError).toBe('Spiel nicht gefunden.');
  });
  it('clears lastError on success and resets to null', () => {
    const t = midGroup();
    const ok = tournamentReducer({ t, lastError: 'alt' }, { type: 'cancelMatch', matchId: t.matches[0].id });
    expect(ok.lastError).toBeNull();
    expect(ok.t!.matches[0].status).not.toBe('running');
    expect(tournamentReducer(ok, { type: 'reset' })).toEqual({ t: null, lastError: null });
  });
});
