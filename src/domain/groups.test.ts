import { describe, it, expect } from 'vitest';
import { drawGroups } from './groups';
import { createRng } from './rng';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('drawGroups', () => {
  it('splits 13 into 7/6 as Liga A/B, keeps all players, is deterministic', () => {
    const g = drawGroups(ids(13), 2, createRng(1));
    expect(g.map((x) => x.playerIds.length)).toEqual([7, 6]);
    expect(g.map((x) => x.name)).toEqual(['Liga A', 'Liga B']);
    expect(g.flatMap((x) => x.playerIds).sort()).toEqual(ids(13).sort());
    expect(drawGroups(ids(13), 2, createRng(1))).toEqual(g);
  });
  it('balances 10 into 3 groups', () => {
    const g = drawGroups(ids(10), 3, createRng(2));
    const sizes = g.map((x) => x.playerIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(g.map((x) => [x.id, x.name])).toEqual([['g1', 'Gruppe A'], ['g2', 'Gruppe B'], ['g3', 'Gruppe C']]);
  });
});
