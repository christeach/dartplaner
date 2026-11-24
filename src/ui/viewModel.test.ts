import { describe, expect, it } from 'vitest';
import { isPlayable } from '../domain/resolve';
import type { StandingRow } from '../domain/standings';
import { createTournament, pendingTies, recordResult, setTieOrder, start, startKo } from '../domain/tournament';
import type { Match, Mode, Tournament } from '../domain/types';
import { formatDate, koLayout, placeGroups, placeLabel, rankLabels, resultText, slotLabel } from './viewModel';

const mk = (mode: Mode, n: number) => start(createTournament({ name: 'T', date: '2026-11-24', boards: 4,
  legs: { group: 3, ko: 3, final: 4 }, mode }, Array.from({ length: n }, (_, i) => `S${i + 1}`), 7), 1);
function playAll(t: Tournament): Tournament {
  for (let m = t.matches.find((x) => isPlayable(t.matches, x)); m; m = t.matches.find((x) => isPlayable(t.matches, x))) {
    t = recordResult(t, m.id, { kind: 'legs', a: m.legsToWin, b: 0 }, undefined, 2);
  }
  for (let ties = pendingTies(t); ties.length; ties = pendingTies(t)) t = setTieOrder(t, ties[0].key, ties[0].playerIds);
  return t;
}
const titles = (cols: { title: string }[]) => cols.map((c) => c.title);
const row = (rank: number): StandingRow => ({ playerId: `p${rank}`, played: 0, won: 0, lost: 0, legsFor: 0,
  legsAgainst: 0, legDiff: 0, points: 0, rank, withdrawn: false });

describe('viewModel', () => {
  it('formats places and dates', () => {
    expect(placeLabel(5, 8)).toBe('5–8');
    expect(placeLabel(3)).toBe('3');
    expect(formatDate('2026-11-24')).toBe('24.11.2026');
  });

  it('shows a shared rank once as a range', () => {
    expect(rankLabels([1, 2, 2, 2, 5].map(row))).toEqual(['1', '2–4', '', '', '5']);
  });

  it('groups shared places into one line', () => {
    expect(placeGroups([{ playerId: 'a', place: 1 }, { playerId: 'b', place: 5, placeTo: 6 }, { playerId: 'c', place: 5, placeTo: 6 }]))
      .toEqual([{ label: '1', playerIds: ['a'] }, { label: '5–6', playerIds: ['b', 'c'] }]);
  });

  it('lays out the club bracket in rounds with placement games listed apart', () => {
    const t = startKo(playAll(mk({ kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true }, 13)));
    const { columns, lists } = koLayout(t);
    expect(titles(columns)).toEqual(['Viertelfinale', 'Halbfinale', 'Finale']);
    expect(columns[2].matches.map((m) => m.label)).toEqual(['Finale', 'Spiel um Platz 3']);
    expect(titles(lists)).toEqual(['Platzierungsspiele']);
    const hf1 = columns[1].matches[0];
    expect(slotLabel(t, hf1.a)).toBe('Sieger Viertelfinale 1');
    expect(slotLabel(t, columns[2].matches[1].a)).toBe('Verlierer Halbfinale 1');
    expect(slotLabel(t, columns[0].matches[0].a)).toMatch(/^S\d+$/);
  });

  it('lays out double K.O. with losers bracket and grand final as lists, byes as Freilos', () => {
    const t = mk({ kind: 'doubleKo' }, 5);
    const { columns, lists } = koLayout(t);
    expect(titles(columns)).toEqual(['Gewinnerrunde 1', 'Gewinnerrunde 2', 'Gewinnerrunde 3']);
    expect(titles(lists)).toEqual(['Verliererrunde', 'Finale']);
    const withBye = columns[0].matches.find((m: Match) => m.a.kind === 'bye' || m.b.kind === 'bye')!;
    expect([slotLabel(t, withBye.a), slotLabel(t, withBye.b)]).toContain('Freilos');
  });

  it('has no K.O. layout for a plain round robin', () => {
    expect(koLayout(mk({ kind: 'roundRobin', finalTopTwo: false }, 4))).toEqual({ columns: [], lists: [] });
  });

  it('writes results as text, skipping open matches and byes', () => {
    const t0 = mk({ kind: 'roundRobin', finalTopTwo: false }, 4);
    const m = t0.matches[0];
    expect(resultText(t0, m)).toBeNull();
    const t = recordResult(t0, m.id, { kind: 'legs', a: 3, b: 1 }, undefined, 2);
    const [a, b] = [m.a, m.b].map((s) => t.players.find((p) => s.kind === 'player' && p.id === s.id)!.name);
    expect(resultText(t, t.matches[0])).toBe(`${a} 3:1 ${b}`);
    const wo: Match = { ...m, status: 'done', result: { kind: 'walkover', winner: 'b' } };
    expect(resultText(t0, wo)).toBe(`${b} kampflos gegen ${a}`);
    expect(resultText(t0, { ...wo, a: { kind: 'bye' } })).toBeNull();
  });
});
