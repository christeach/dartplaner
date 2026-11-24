import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from './rng';

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42);
    const xs = Array.from({ length: 5 }, a), ys = Array.from({ length: 5 }, b);
    expect(xs).toEqual(ys);
    xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
  });
});

describe('shuffle', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('permutes, differs by seed, keeps input intact', () => {
    const r1 = shuffle(input, createRng(1));
    const r2 = shuffle(input, createRng(2));
    expect([...r1].sort((x, y) => x - y)).toEqual(input);
    expect(r1).not.toEqual(r2);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
