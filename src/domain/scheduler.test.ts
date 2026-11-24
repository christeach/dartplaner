import { describe, expect, it } from 'vitest';
import { resolveSlot } from './resolve';
import { freeBoards, lastFinished, queue, suggestNext } from './scheduler';
import { createTournament, recordResult, start, startMatch } from './tournament';
import type { Match, Settings, Tournament } from './types';

const settings = (boards: number): Settings => ({ name: 'T', date: '2026-11-24', boards,
  legs: { group: 3, ko: 3, final: 4 }, mode: { kind: 'groupsKo', groups: 1, placementGames: false, thirdPlace: false } });
const mk = (n: number, boards = 4) =>
  start(createTournament(settings(boards), Array.from({ length: n }, (_, i) => `S${i + 1}`), 1), 0);
const ids = (t: Tournament, m: Match) => [m.a, m.b].map((s) => resolveSlot(t.matches, s));
const win = (t: Tournament, m: Match, now: number) =>
  recordResult(t, m.id, { kind: 'legs', a: m.legsToWin, b: 0 }, undefined, now);

describe('scheduler', () => {
  it('prefers rested players over one who just finished', () => {
    let t = mk(6);
    const first = suggestNext(t)!;
    t = win(t, first, 10);
    const [a, b] = ids(t, first);
    const next = suggestNext(t)!;
    expect(ids(t, next)).not.toContain(a);
    expect(ids(t, next)).not.toContain(b);
    expect(lastFinished(t, a as string)).toBe(10);
    expect(lastFinished(t, 'nobody')).toBe(-Infinity);
  });

  it('never queues players of a running match; freeBoards lists unused boards', () => {
    let t = mk(6);
    const m = suggestNext(t)!;
    t = startMatch(t, m.id, 2, 1);
    const busy = ids(t, m);
    for (const q of queue(t)) for (const p of ids(t, q)) expect(busy).not.toContain(p);
    expect(freeBoards(t)).toEqual([1, 3, 4]);
  });

  it('freeBoards = [4] with boards 1-3 running', () => {
    let t = mk(8);
    for (const b of [1, 2, 3]) t = startMatch(t, suggestNext(t)!.id, b, b);
    expect(freeBoards(t)).toEqual([4]);
  });

  it('empty queue gives null', () => {
    const t = createTournament(settings(2), ['A', 'B'], 1);
    expect(queue(t)).toEqual([]); // setup phase
    expect(suggestNext(t)).toBeNull();
  });

  it('ko phase puts round 1 before round 2 even if round-2 players rested longer', () => {
    const pl = (id: string) => ({ kind: 'player' as const, id });
    const base = { bracket: 'main' as const, label: '', legsToWin: 2 };
    const done = (id: string, a: string, b: string, finishedAt: number): Match => ({ ...base, id, round: 1, order: 0,
      a: pl(a), b: pl(b), status: 'done', finishedAt, result: { kind: 'legs', a: 2, b: 0 } });
    const t = { ...mk(4), phase: 'ko' as const, matches: [
      done('x', 'A', 'B', 1), done('y', 'C', 'D', 2),
      { ...base, id: 'r2', round: 2, order: 0, a: pl('A'), b: pl('C'), status: 'open' },
      { ...base, id: 'r1', round: 1, order: 5, a: pl('E'), b: pl('F'), status: 'open', },
    ] as Match[] };
    expect(queue(t).map((m) => m.id)).toEqual(['r1', 'r2']);
  });
});
