import { describe, it, expect } from 'vitest';
import { resolveSlot, winnerSide, autoAdvance, isPlayable } from './resolve';
import { buildSingleElim, byeSeeding } from './bracket';
import type { Match, Slot } from './types';

const p = (id: string): Slot => ({ kind: 'player', id });
const opts = { idPrefix: 'ko', legsKo: 3, legsFinal: 4, thirdPlace: false, placementGames: false, firstPlace: 1 };
const none = new Set<string>();

describe('resolveSlot', () => {
  it('returns null for winnerOf an unfinished match', () => {
    const ms = buildSingleElim([p('A'), p('B'), p('C'), p('D')], opts);
    expect(resolveSlot(ms, { kind: 'winnerOf', matchId: ms[0].id })).toBeNull();
  });

  it('resolves winner and loser of a finished match', () => {
    const ms = buildSingleElim([p('A'), p('B'), p('C'), p('D')], opts);
    ms[0] = { ...ms[0], status: 'done', result: { kind: 'legs', a: 1, b: 3 } };
    expect(winnerSide(ms[0])).toBe('b');
    expect(resolveSlot(ms, { kind: 'winnerOf', matchId: ms[0].id })).toBe('B');
    expect(resolveSlot(ms, { kind: 'loserOf', matchId: ms[0].id })).toBe('A');
  });
});

describe('autoAdvance', () => {
  it('turns bye matches of a 5-player bracket into walkovers and resolves round 2', () => {
    const entries = byeSeeding(['A', 'B', 'C', 'D', 'E'].map(p), 8);
    const ms = buildSingleElim(entries, opts);
    const before = JSON.stringify(ms);
    const out = autoAdvance(ms, none, 42);
    expect(JSON.stringify(ms)).toBe(before); // input untouched
    const r1 = out.filter((m) => m.round === 1);
    const walkovers = r1.filter((m) => m.status === 'done');
    expect(walkovers).toHaveLength(3);
    for (const m of walkovers) {
      expect(m.result?.kind).toBe('walkover');
      expect(m.finishedAt).toBe(42);
      expect(resolveSlot(out, { kind: 'loserOf', matchId: m.id })).toBe('bye');
    }
    // A (seed 0), B (seed 1), C (seed 2) got byes
    const r2 = out.filter((m) => m.round === 2);
    const resolved = r2.flatMap((m) => [resolveSlot(out, m.a), resolveSlot(out, m.b)]);
    expect(resolved.filter((x) => x !== null).sort()).toEqual(['A', 'B', 'C']);
    // D–E and B–C (semifinal of two bye winners) are playable
    expect(out.filter((m) => isPlayable(out, m)).map((m) => m.id)).toEqual([r1.find((m) => m.status === 'open')!.id, r2[1].id]);
  });

  it('gives a walkover to the opponent of a withdrawn player; loser keeps the loserPlace', () => {
    const ms = buildSingleElim([p('A'), p('B'), p('C'), p('D')], { ...opts, thirdPlace: false });
    expect(isPlayable(ms, ms[0])).toBe(true);
    const out = autoAdvance(ms, new Set(['A']), 7);
    const m = out.find((x) => x.id === ms[0].id)!;
    expect(m.status).toBe('done');
    expect(m.result).toEqual({ kind: 'walkover', winner: 'b' });
    expect(m.board).toBeUndefined();
    expect(resolveSlot(out, { kind: 'loserOf', matchId: m.id })).toBe('A');
    expect(m.loserPlace).toBe(3);
    expect(out.find((x) => x.id === ms[1].id)!.status).toBe('open');
  });

  it('both sides bye → walkover for a, winner and loser resolve to bye', () => {
    const m: Match = { id: 'x', bracket: 'main', round: 1, order: 0, label: '', a: { kind: 'bye' }, b: { kind: 'bye' },
      legsToWin: 3, status: 'open', board: 2 };
    const out = autoAdvance([m], none, 1);
    expect(out[0].result).toEqual({ kind: 'walkover', winner: 'a' });
    expect(out[0].board).toBeUndefined();
    expect(resolveSlot(out, { kind: 'winnerOf', matchId: 'x' })).toBe('bye');
    expect(resolveSlot(out, { kind: 'loserOf', matchId: 'x' })).toBe('bye');
  });
});
