import { describe, expect, it } from 'vitest';
import { resolveSlot } from '../domain/resolve';
import { queue } from '../domain/scheduler';
import { createTournament, recordResult, start, startMatch } from '../domain/tournament';
import type { Match, Settings, Tournament } from '../domain/types';
import { boardSuggestions, canStartKo, emptyStatsForm, formToStats, resultLabel, statsToForm } from './liveForm';

const settings = (boards: number): Settings => ({ name: 'T', date: '2026-11-24', boards,
  legs: { group: 3, ko: 3, final: 4 }, mode: { kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true } });
const mk = (n: number, boards = 4) =>
  start(createTournament(settings(boards), Array.from({ length: n }, (_, i) => `S${i + 1}`), 1), 0);
const ids = (t: Tournament, m: Match) => [m.a, m.b].map((s) => resolveSlot(t.matches, s));

describe('liveForm', () => {
  it('suggests one match per free board without sharing a player', () => {
    let t = mk(13);
    t = startMatch(t, queue(t)[0].id, 2, 1);
    const s = boardSuggestions(t);
    expect([...s.keys()]).toEqual([1, 3, 4]);
    const players = [...s.values()].flatMap((m) => ids(t, m!));
    expect(new Set(players).size).toBe(players.length);
  });

  it('leaves a free board without suggestion when no match fits', () => {
    const t = mk(4, 4); // 2 matches per round, 4 players: only 2 boards can be used at once
    const s = boardSuggestions(t);
    expect([...s.values()].filter(Boolean)).toHaveLength(2);
    expect(s.get(4)).toBeNull();
  });

  it('canStartKo only once every group match is done and no tie is pending', () => {
    let t = mk(4, 4);
    expect(canStartKo(t)).toBe(false);
    // the lower-numbered player wins every match: no ties
    for (const m of t.matches) {
      const [a, b] = ids(t, m) as string[];
      const aWins = Number(a.slice(1)) < Number(b.slice(1));
      t = recordResult(t, m.id, { kind: 'legs', a: aWins ? 3 : 0, b: aWins ? 0 : 3 }, undefined, 1);
    }
    expect(t.phase).toBe('groups');
    expect(canStartKo(t)).toBe(true);
  });

  it('stats form: empty fields are undefined, empty 180er is 0, all empty is no stats', () => {
    expect(formToStats(emptyStatsForm)).toBeUndefined();
    expect(formToStats({ ...emptyStatsForm, highFinish: '120' })).toEqual({ s180: 0, highFinish: 120 });
    expect(formToStats({ s180: '2', highScore: '180', highFinish: '', shortLeg: '12' }))
      .toEqual({ s180: 2, highScore: 180, shortLeg: 12 });
    expect(statsToForm({ s180: 1, highFinish: 99 })).toEqual({ s180: '1', highScore: '', highFinish: '99', shortLeg: '' });
    expect(statsToForm(undefined)).toEqual(emptyStatsForm);
  });

  it('result label names the winner with his legs first', () => {
    expect(resultLabel(1, 3, 3, 'Anna', 'Bernd')).toBe('Speichern · 3:1 für Bernd');
    expect(resultLabel(3, 0, 3, 'Anna', 'Bernd')).toBe('Speichern · 3:0 für Anna');
    expect(resultLabel(3, 3, 3, 'Anna', 'Bernd')).toBe('Speichern');
    expect(resultLabel(null, 3, 3, 'Anna', 'Bernd')).toBe('Speichern');
  });
});
