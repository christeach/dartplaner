import { describe, it, expect } from 'vitest';
import { roundRobinMatches, interleave } from './roundRobin';

const pid = (m: { a: any; b: any }) => [m.a.id, m.b.id] as string[];
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('roundRobinMatches', () => {
  it('5 players: 10 pairs once, no repeat per round, rounds 1..5', () => {
    const ms = roundRobinMatches({ id: 'g1', playerIds: ids(5) }, 2, 'g1');
    expect(ms).toHaveLength(10);
    expect(new Set(ms.map((m) => pid(m).sort().join())).size).toBe(10);
    expect(new Set(ms.map((m) => m.round))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (let r = 1; r <= 5; r++) {
      const ps = ms.filter((m) => m.round === r).flatMap(pid);
      expect(new Set(ps).size).toBe(ps.length);
    }
    expect(new Set(ms.map((m) => m.id)).size).toBe(10);
    expect(ms[0]).toMatchObject({ bracket: 'group', groupId: 'g1', label: '', legsToWin: 2, status: 'open' });
  });
  it('6 players: 15 matches, each player once per round 1..5', () => {
    const ms = roundRobinMatches({ id: 'g1', playerIds: ids(6) }, 2, 'g1');
    expect(ms).toHaveLength(15);
    for (let r = 1; r <= 5; r++) {
      expect(ms.filter((m) => m.round === r).flatMap(pid).sort()).toEqual(ids(6));
    }
  });
});

describe('interleave', () => {
  it('alternates groups within a round and numbers order 0..n-1', () => {
    const a = roundRobinMatches({ id: 'g1', playerIds: ids(4) }, 2, 'a');
    const b = roundRobinMatches({ id: 'g2', playerIds: ids(4).map((x) => 'q' + x) }, 2, 'b');
    const out = interleave([a, b]);
    expect(out.map((m) => m.order)).toEqual(out.map((_, i) => i));
    expect(out.slice(0, 4).map((m) => m.groupId)).toEqual(['g1', 'g2', 'g1', 'g2']);
    expect(out.map((m) => m.round)).toEqual([...out.map((m) => m.round)].sort());
  });
});
