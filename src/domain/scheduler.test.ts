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

  const pl = (id: string) => ({ kind: 'player' as const, id });
  const base = { bracket: 'main' as const, label: '', legsToWin: 2 };
  const open = (id: string, round: number, order: number, a: string, b: string, bracket: Match['bracket'] = 'main'): Match =>
    ({ ...base, bracket, id, round, order, a: pl(a), b: pl(b), status: 'open' });
  const done = (id: string, a: string, b: string, finishedAt: number, walkover = false): Match =>
    ({ ...base, id, round: 1, order: 0, a: pl(a), b: pl(b), status: 'done', finishedAt,
      result: walkover ? { kind: 'walkover', winner: 'a' } : { kind: 'legs', a: 2, b: 0 } });
  const withMatches = (phase: Tournament['phase'], matches: Match[]): Tournament => ({ ...mk(4), phase, matches });

  it('ko: round beats pause (round-2 players never played, round-1 players just finished)', () => {
    const t = withMatches('ko', [done('x', 'A', 'B', 100), open('r2', 2, 0, 'E', 'F'), open('r1', 1, 5, 'A', 'B')]);
    expect(queue(t).map((m) => m.id)).toEqual(['r1', 'r2']);
  });

  it('ko: placement match with lower order but round+1 sorts after earlier-round main matches', () => {
    const t = withMatches('ko', [
      open('place', 2, 0, 'A', 'B', 'placement'), open('main2', 3, 1, 'C', 'D'), open('main1', 1, 9, 'E', 'F')]);
    expect(queue(t).map((m) => m.id)).toEqual(['main1', 'place', 'main2']);
  });

  it('groups: longest pause first, then round, then order', () => {
    const t = withMatches('groups', [
      done('d1', 'A', 'B', 10), done('d2', 'C', 'D', 20), done('d3', 'E', 'F', 30),
      open('late', 1, 0, 'E', 'F'), open('r2', 2, 0, 'A', 'B'), open('r1o2', 1, 2, 'A', 'B'), open('r1o1', 1, 1, 'A', 'B'),
      open('mid', 1, 0, 'C', 'D')]);
    expect(queue(t).map((m) => m.id)).toEqual(['r1o1', 'r1o2', 'r2', 'mid', 'late']);
  });

  it('groups: never-played players tie at -Infinity and fall back to round then order', () => {
    const t = withMatches('groups', [open('b', 2, 0, 'A', 'B'), open('c', 1, 3, 'C', 'D'), open('a', 1, 1, 'E', 'F')]);
    expect(queue(t).map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('lastFinished ignores walkover results', () => {
    const t = withMatches('groups', [done('w', 'A', 'B', 50, true), done('l', 'A', 'C', 7)]);
    expect(lastFinished(t, 'A')).toBe(7);
    expect(lastFinished(t, 'B')).toBe(-Infinity);
  });
});
