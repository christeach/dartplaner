import { describe, expect, it } from 'vitest';
import { byeSeeding } from './bracket';
import { buildDoubleElim } from './doubleElim';
import { autoAdvance, isPlayable, resolveSlot, winnerSide } from './resolve';
import type { Match, Slot } from './types';

const p = (id: string): Slot => ({ kind: 'player', id });
const field = (n: number) => byeSeeding(Array.from({ length: n }, (_, i) => p(`P${i + 1}`)), n <= 4 ? 4 : 8);
const opts = { legsKo: 3, legsFinal: 5 };
const sides = (ms: Match[], m: Match) => {
  const w = winnerSide(m);
  const [win, lose] = w === 'b' ? [m.b, m.a] : [m.a, m.b];
  return { winner: resolveSlot(ms, win), loser: resolveSlot(ms, lose) };
};

// side a always wins; checks per-step invariants and returns the finished bracket
function simulate(ms: Match[]): Match[] {
  let cur = autoAdvance(ms, new Set(), 0);
  for (;;) {
    const open = cur.filter((m) => m.status === 'open');
    for (const m of open) expect([resolveSlot(cur, m.a), resolveSlot(cur, m.b)]).not.toEqual(['bye', 'bye']);
    const inOpen = open.flatMap((m) => [resolveSlot(cur, m.a), resolveSlot(cur, m.b)]).filter((x) => x && x !== 'bye');
    expect(new Set(inOpen).size).toBe(inOpen.length);
    const m = cur.find((x) => isPlayable(cur, x));
    if (!m) break;
    cur = autoAdvance(cur.map((x) => (x.id === m.id ? { ...x, status: 'done' as const, result: { kind: 'legs' as const, a: x.legsToWin, b: 0 } } : x)), new Set(), 0);
  }
  expect(cur.every((m) => m.status === 'done')).toBe(true);
  return cur;
}

function places(done: Match[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string | 'bye' | null, label: string) => {
    if (id === null || id === 'bye') return;
    out.set(id, [...(out.get(id) ?? []), label]);
  };
  for (const m of done) {
    const { winner, loser } = sides(done, m);
    if (m.winnerPlace) add(winner, `${m.winnerPlace}`);
    if (m.loserPlace) add(loser, m.loserPlaceTo ? `${m.loserPlace}–${m.loserPlaceTo}` : `${m.loserPlace}`);
  }
  return out;
}

function checkInvariants(n: number) {
  const done = simulate(buildDoubleElim(field(n), opts));
  const pl = places(done);
  expect(pl.size).toBe(n);
  for (const v of pl.values()) expect(v).toHaveLength(1);
  const losses = new Map<string, number>();
  for (const m of done) {
    const { loser } = sides(done, m);
    if (loser && loser !== 'bye') losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  for (const l of losses.values()) expect(l).toBeLessThanOrEqual(2);
  expect(losses.size).toBeGreaterThanOrEqual(n - 1);
}

describe('buildDoubleElim', () => {
  it('N = 8: structure and places', () => {
    const ms = buildDoubleElim(field(8), opts);
    expect(ms).toHaveLength(14);
    expect(ms.filter((m) => m.bracket === 'winners')).toHaveLength(7);
    expect(ms.filter((m) => m.bracket === 'losers')).toHaveLength(6);
    const fin = ms.filter((m) => m.bracket === 'final');
    expect(fin).toHaveLength(1);
    expect(fin[0]).toMatchObject({ id: 'de-F', label: 'Finale', legsToWin: 5, round: 6, winnerPlace: 1, loserPlace: 2,
      a: { kind: 'winnerOf', matchId: 'de-W3-1' }, b: { kind: 'winnerOf', matchId: 'de-L4-1' } });
    expect(ms.filter((m) => m.bracket !== 'final').every((m) => m.legsToWin === 3)).toBe(true);
    expect(ms.filter((m) => m.bracket === 'winners').every((m) => m.loserPlace === undefined && m.winnerPlace === undefined)).toBe(true);
    expect(ms.map((m) => m.order)).toEqual([...Array(14).keys()]);
    const byId = (id: string) => ms.find((m) => m.id === id)!;
    expect(byId('de-W1-2').label).toBe('Gewinnerrunde 1 · Spiel 2');
    expect(byId('de-L2-1')).toMatchObject({ label: 'Verliererrunde 2 · Spiel 1', round: 3,
      a: { kind: 'winnerOf', matchId: 'de-L1-1' }, b: { kind: 'loserOf', matchId: 'de-W2-2' } });
    expect(byId('de-L1-1')).toMatchObject({ round: 2, a: { kind: 'loserOf', matchId: 'de-W1-1' }, b: { kind: 'loserOf', matchId: 'de-W1-2' } });
    expect(byId('de-L3-1')).toMatchObject({ a: { kind: 'winnerOf', matchId: 'de-L2-1' }, b: { kind: 'winnerOf', matchId: 'de-L2-2' } });

    const all = [...places(simulate(ms)).values()].flat().sort();
    expect(all).toEqual(['1', '2', '3', '4', '5–6', '5–6', '7–8', '7–8']);
  });

  it('N = 8 with 5 players (3 byes)', () => checkInvariants(5));
  it('6 players', () => checkInvariants(6));
  it('3 players in N = 4', () => checkInvariants(3));
  it('8 players: nobody eliminated before second loss', () => checkInvariants(8));
});
