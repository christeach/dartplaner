import { describe, it, expect } from 'vitest';
import { computeStandings, tieKeyFor } from './standings';
import type { Match, Result } from './types';

let n = 0;
const m = (a: string, b: string, la: number, lb: number, status: Match['status'] = 'done', result?: Result): Match => ({
  id: `m${n++}`, bracket: 'group', groupId: 'g1', round: 1, order: n, label: '',
  a: { kind: 'player', id: a }, b: { kind: 'player', id: b }, legsToWin: 3, status,
  result: result ?? { kind: 'legs', a: la, b: lb },
});
const none = new Set<string>();
const order = (rows: { playerId: string }[]) => rows.map((r) => r.playerId);
const ranks = (rows: { rank: number }[]) => rows.map((r) => r.rank);

describe('tieKeyFor', () => {
  it('sorts ids under the prefix', () => {
    expect(tieKeyFor('g1', ['C', 'A', 'B'])).toBe('g1:A,B,C');
  });
});

describe('computeStandings', () => {
  it('win = 2 points, loss = 0, legDiff = legsFor - legsAgainst', () => {
    const [a, b] = computeStandings(['B', 'A'], [m('A', 'B', 3, 1)], none, {}, 'g1');
    expect(a).toEqual({ playerId: 'A', played: 1, won: 1, lost: 0, legsFor: 3, legsAgainst: 1, legDiff: 2, points: 2, rank: 1, withdrawn: false });
    expect(b).toEqual({ playerId: 'B', played: 1, won: 0, lost: 1, legsFor: 1, legsAgainst: 3, legDiff: -2, points: 0, rank: 2, withdrawn: false });
  });

  it('equal points: higher legDiff first', () => {
    const rows = computeStandings(['A', 'B', 'X', 'Y'], [m('A', 'X', 3, 2), m('B', 'Y', 3, 0)], none, {}, 'g1');
    expect(order(rows)).toEqual(['B', 'A', 'X', 'Y']);
  });

  it('equal points and legDiff: higher legsFor first', () => {
    // A 4:4, B 3:3, both 2 points
    const rows = computeStandings(['B', 'A', 'X', 'Y'],
      [m('A', 'X', 3, 1), m('Y', 'A', 3, 1), m('B', 'X', 3, 0), m('Y', 'B', 3, 0)], none, {}, 'g1');
    expect(order(rows)).toEqual(['Y', 'A', 'B', 'X']);
  });

  it('equal on criteria 1-3: direct winner first', () => {
    // A and B both 2 points, 4:4; A beat B
    const rows = computeStandings(['B', 'A', 'X', 'Y'],
      [m('A', 'B', 3, 1), m('X', 'A', 3, 1), m('B', 'Y', 3, 1), m('X', 'Y', 3, 0)], none, {}, 'g1');
    expect(order(rows)).toEqual(['X', 'A', 'B', 'Y']);
    expect(ranks(rows)).toEqual([1, 2, 3, 4]);
    expect(rows.every((r) => r.tieKey === undefined)).toBe(true);
  });

  it('recursive restart: mini-table puts C on top, A/B equal there, A beat B -> C, A, B', () => {
    // A, B, C, D all 6 points, 12:11 overall.
    // Mini among them: C 6 pts; A, B 2 pts 6:7; D 2 pts 5:7. Restricted to {A, B}: A beat B.
    const rows = computeStandings(['D', 'B', 'A', 'C', 'X', 'Y', 'Z'], [
      m('A', 'B', 3, 1), m('C', 'A', 3, 2), m('D', 'A', 3, 1),
      m('C', 'B', 3, 2), m('B', 'D', 3, 1), m('C', 'D', 3, 1),
      m('A', 'X', 3, 2), m('A', 'Y', 3, 2), m('B', 'X', 3, 2), m('B', 'Y', 3, 2),
      m('X', 'C', 3, 1), m('Y', 'C', 3, 2), m('D', 'X', 3, 1), m('D', 'Y', 3, 0), m('Z', 'D', 3, 1),
    ], none, {}, 'g1');
    for (const r of rows.slice(0, 4)) expect([r.points, r.legsFor, r.legsAgainst]).toEqual([6, 12, 11]);
    expect(order(rows).slice(0, 4)).toEqual(['C', 'A', 'B', 'D']);
    expect(ranks(rows).slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it('perfect cycle shares rank and tieKey; manual tieOrder resolves it', () => {
    const ms = [m('A', 'B', 3, 1), m('B', 'C', 3, 1), m('C', 'A', 3, 1),
      m('A', 'D', 3, 1), m('B', 'D', 3, 1), m('C', 'D', 3, 1)];
    const rows = computeStandings(['D', 'C', 'B', 'A'], ms, none, {}, 'g1');
    expect(order(rows)).toEqual(['C', 'B', 'A', 'D']);
    expect(ranks(rows)).toEqual([1, 1, 1, 4]);
    expect(rows.slice(0, 3).map((r) => r.tieKey)).toEqual(['g1:A,B,C', 'g1:A,B,C', 'g1:A,B,C']);
    expect(rows[3].tieKey).toBeUndefined();

    const fixed = computeStandings(['D', 'C', 'B', 'A'], ms, none, { 'g1:A,B,C': ['B', 'C', 'A'] }, 'g1');
    expect(order(fixed)).toEqual(['B', 'C', 'A', 'D']);
    expect(ranks(fixed)).toEqual([1, 2, 3, 4]);
    expect(fixed.every((r) => r.tieKey === undefined)).toBe(true);
  });

  it('ignores tieOrder for a different block', () => {
    const ms = [m('A', 'B', 3, 1), m('B', 'C', 3, 1), m('C', 'A', 3, 1)];
    const rows = computeStandings(['A', 'B', 'C'], ms, none, { 'g2:A,B,C': ['B', 'C', 'A'] }, 'g1');
    expect(ranks(rows)).toEqual([1, 1, 1]);
  });

  it('withdrawn players go last; ties among them share rank without tieKey', () => {
    const rows = computeStandings(['W', 'P', 'Q', 'V', 'U'],
      [m('W', 'P', 3, 0), m('W', 'Q', 3, 0), m('Q', 'P', 3, 0)], new Set(['W', 'V', 'U']), {}, 'g1');
    expect(order(rows)).toEqual(['Q', 'P', 'W', 'V', 'U']);
    expect(ranks(rows)).toEqual([1, 2, 3, 4, 4]);
    expect(rows.map((r) => r.withdrawn)).toEqual([false, false, true, true, true]);
    expect(rows.every((r) => r.tieKey === undefined)).toBe(true);
  });

  it('ignores void, open, running and walkover matches', () => {
    const rows = computeStandings(['A', 'B'], [
      m('A', 'B', 3, 0, 'void'), m('A', 'B', 3, 0, 'open'), m('A', 'B', 3, 0, 'running'),
      m('A', 'B', 0, 0, 'done', { kind: 'walkover', winner: 'a' }), m('B', 'A', 3, 1),
    ], none, {}, 'g1');
    expect(order(rows)).toEqual(['B', 'A']);
    expect(rows.map((r) => r.played)).toEqual([1, 1]);
  });
});
