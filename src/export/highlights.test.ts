import { describe, expect, it } from 'vitest';
import { createTournament, recordResult, start } from '../domain/tournament';
import type { Settings } from '../domain/types';
import { eveningHighlights, playerHighlights } from './highlights';

const settings: Settings = { name: 'T', date: '2026-11-24', boards: 2, legs: { group: 2, ko: 2, final: 2 }, mode: { kind: 'roundRobin', finalTopTwo: false } };

function played() {
  let t = start(createTournament(settings, ['Anna', 'Ben', 'Cem'], 1), 1);
  const [m1, m2] = t.matches.filter((m) => m.bracket === 'group');
  const id = (s: typeof m1.a) => (s as { id: string }).id;
  t = recordResult(t, m1.id, { kind: 'legs', a: 2, b: 0 }, { a: { s180: 2, highScore: 140, highFinish: 90, shortLeg: 15 }, b: { s180: 1 } }, 2);
  const m2n = t.matches.find((m) => m.id === m2.id)!;
  t = recordResult(t, m2n.id, { kind: 'legs', a: 2, b: 1 }, { a: { s180: 3, highScore: 160, highFinish: 60, shortLeg: 18 }, b: { s180: 0 } }, 3);
  return { t, m1, m2: m2n, id };
}

describe('highlights', () => {
  it('aggregates per player: sum 180s, max score/finish, min shortleg', () => {
    const { t, m1, m2, id } = played();
    const rows = playerHighlights(t);
    const shared = [id(m1.a), id(m1.b)].find((p) => [id(m2.a), id(m2.b)].includes(p))!;
    const total = rows.reduce((s, r) => s + r.s180, 0);
    expect(total).toBe(6);
    const r = rows.find((x) => x.playerId === id(m1.a))!;
    expect(r.s180).toBeGreaterThanOrEqual(2);
    expect(shared).toBeDefined();
  });

  it('evening highlights pick the best values and join ties', () => {
    const { t } = played();
    const e = eveningHighlights(t);
    expect(e.highScore?.value).toBe(160);
    expect(e.highFinish?.value).toBe(90);
    expect(e.shortLeg?.value).toBe(15);
    expect(e.most180?.value).toBeGreaterThanOrEqual(3);
  });

  it('ties join names with ", "', () => {
    let t = start(createTournament(settings, ['Anna', 'Ben', 'Cem'], 1), 1);
    const m = t.matches[0];
    t = recordResult(t, m.id, { kind: 'legs', a: 2, b: 0 }, { a: { s180: 1 }, b: { s180: 1 } }, 2);
    expect(eveningHighlights(t).most180).toEqual({ names: expect.stringContaining(', '), value: 1 });
  });
});
