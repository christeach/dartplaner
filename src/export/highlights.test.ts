import { describe, expect, it } from 'vitest';
import { createTournament, recordResult, start } from '../domain/tournament';
import type { Match, PlayerStats, Settings, Tournament } from '../domain/types';
import { eveningHighlights, playerHighlights } from './highlights';

const settings: Settings = { name: 'T', date: '2026-11-24', boards: 2, legs: { group: 2, ko: 2, final: 2 }, mode: { kind: 'roundRobin', finalTopTwo: false } };
const pid = (s: Match['a']) => (s as { id: string }).id;
const fresh = () => start(createTournament(settings, ['Anna', 'Ben', 'Cem'], 1), 1);

// Records match m with `mine` on the side of player `who` and `other` on the opposite side.
function record(t: Tournament, m: Match, who: string, mine: PlayerStats, other: PlayerStats): Tournament {
  const mineIsA = pid(m.a) === who;
  return recordResult(t, m.id, { kind: 'legs', a: 2, b: 0 }, mineIsA ? { a: mine, b: other } : { a: other, b: mine }, 2);
}

describe('highlights', () => {
  it('aggregates per player: sum 180s, max score/finish, min shortleg', () => {
    let t = fresh();
    const [m1, m2] = t.matches;
    const shared = [pid(m1.a), pid(m1.b)].find((p) => [pid(m2.a), pid(m2.b)].includes(p))!;
    t = record(t, m1, shared, { s180: 2, highScore: 140, highFinish: 60, shortLeg: 18 }, { s180: 0 });
    t = record(t, m2, shared, { s180: 3, highScore: 100, highFinish: 90, shortLeg: 15 }, { s180: 0 });
    const r = playerHighlights(t).find((x) => x.playerId === shared)!;
    expect(r).toMatchObject({ s180: 5, highScore: 140, highFinish: 90, shortLeg: 15 });
  });

  it('evening highlights pick the best values with the right names', () => {
    let t = fresh();
    const [m1, m2] = t.matches;
    const shared = [pid(m1.a), pid(m1.b)].find((p) => [pid(m2.a), pid(m2.b)].includes(p))!;
    t = record(t, m1, shared, { s180: 2, highScore: 140, highFinish: 60, shortLeg: 18 }, { s180: 1 });
    t = record(t, m2, shared, { s180: 3, highScore: 100, highFinish: 90, shortLeg: 15 }, { s180: 0 });
    const name = t.players.find((p) => p.id === shared)!.name;
    expect(eveningHighlights(t)).toEqual({
      most180: { names: name, value: 5 }, highScore: { names: name, value: 140 },
      highFinish: { names: name, value: 90 }, shortLeg: { names: name, value: 15 },
    });
  });

  it('ties join names with ", " in player order', () => {
    let t = fresh();
    const m = t.matches[0];
    t = recordResult(t, m.id, { kind: 'legs', a: 2, b: 0 }, { a: { s180: 1 }, b: { s180: 1 } }, 2);
    const names = [m.a, m.b].map((s) => t.players.find((p) => p.id === pid(s))!.name);
    expect(eveningHighlights(t).most180).toEqual({ names: names.join(', '), value: 1 });
  });
});
