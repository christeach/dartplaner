import { describe, expect, it } from 'vitest';
import { koFieldOptions, nonQualifierPlaces, qualify, seedEntries } from './multiGroupKo';
import { createRng } from './rng';
import type { StandingRow } from './standings';

const row = (playerId: string, rank: number, points: number, legDiff = 0, legsFor = 0, played = 3): StandingRow =>
  ({ playerId, played, won: 0, lost: 0, legsFor, legsAgainst: legsFor - legDiff, legDiff, points, rank, withdrawn: false });

// group gi, n players, already in rank order; values from rng so cross-group order varies
function randomGroups(groups: number, n: number, rng: () => number) {
  return Array.from({ length: groups }, (_, g) => {
    const pts = Array.from({ length: n }, () => Math.floor(rng() * 50)).sort((a, b) => b - a);
    return { id: `g${g}`, rows: pts.map((p, i) => row(`g${g}p${i + 1}`, i + 1, p, Math.floor(rng() * 9), Math.floor(rng() * 20))) };
  });
}

describe('koFieldOptions', () => {
  it('limits the field by groups and the smallest group', () => {
    expect(koFieldOptions([4, 4, 4])).toEqual([4]);
    expect(koFieldOptions([5, 5, 5, 5])).toEqual([8, 4]);
    expect(koFieldOptions([2, 2, 2, 2, 2, 2, 2, 2])).toEqual([8]);
    expect(koFieldOptions([])).toEqual([]);
  });
});

describe('qualify', () => {
  const groups = [
    { id: 'A', rows: [row('a1', 1, 6), row('a2', 2, 4, 2), row('a3', 3, 2), row('a4', 4, 0)] },
    { id: 'B', rows: [row('b1', 1, 6, 5), row('b2', 2, 4, 1), row('b3', 3, 2), row('b4', 4, 0)] },
    { id: 'C', rows: [row('c1', 1, 4), row('c2', 2, 2), row('c3', 3, 2), row('c4', 4, 0)] },
  ];

  it('takes the group winners plus the best second', () => {
    const q = qualify(groups, 4);
    expect(q.seeds).toEqual([
      { playerId: 'b1', groupId: 'B', groupRank: 1 },
      { playerId: 'a1', groupId: 'A', groupRank: 1 },
      { playerId: 'c1', groupId: 'C', groupRank: 1 },
      { playerId: 'a2', groupId: 'A', groupRank: 2 },
    ]);
    expect(q.fillerTieKey).toBeUndefined();
    expect(q.eliminated).toContainEqual({ playerId: 'b2', groupRank: 2 });
    expect(q.eliminated).toHaveLength(8);
  });

  it('compares fillers per game', () => {
    const g = groups.map((x) => (x.id === 'B' ? { ...x, rows: x.rows.map((r) => (r.playerId === 'b2' ? row('b2', 2, 6, 0, 0, 3) : r)) } : x));
    const longer = g.map((x) => (x.id === 'A' ? { ...x, rows: x.rows.map((r) => (r.playerId === 'a2' ? row('a2', 2, 8, 2, 0, 6) : r)) } : x));
    expect(qualify(longer, 4).seeds[3].playerId).toBe('b2');
  });

  it('reports an unresolved filler tie and accepts a manual order', () => {
    const tied = groups.map((x) => (x.id === 'B' ? { ...x, rows: x.rows.map((r) => (r.playerId === 'b2' ? row('b2', 2, 4, 2) : r)) } : x));
    expect(qualify(tied, 4).fillerTieKey).toBe('fillers:a2,b2');
    const q = qualify(tied, 4, ['b2', 'a2']);
    expect(q.fillerTieKey).toBeUndefined();
    expect(q.seeds[3].playerId).toBe('b2');
    expect(q.eliminated).toContainEqual({ playerId: 'a2', groupRank: 2 });
  });

  it('skips withdrawn players', () => {
    const w = groups.map((x) => (x.id === 'A' ? { ...x, rows: [{ ...x.rows[0], withdrawn: true }, ...x.rows.slice(1)] } : x));
    const q = qualify(w, 4);
    expect(q.seeds.find((s) => s.groupId === 'A')).toEqual({ playerId: 'a2', groupId: 'A', groupRank: 1 });
    expect([...q.seeds.map((s) => s.playerId), ...q.eliminated.map((e) => e.playerId)]).not.toContain('a1');
  });
});

describe('seedEntries', () => {
  const configs: [number, number, 4 | 8 | 16][] = [[3, 4, 4], [4, 5, 8], [8, 4, 16], [5, 6, 8]];
  for (const [g, n, field] of configs) {
    it(`never pairs group mates in round 1 (${g}x${n}, field ${field})`, () => {
      for (let s = 1; s <= 200; s++) {
        const groups = randomGroups(g, n, createRng(s));
        const { seeds } = qualify(groups, field);
        const entries = seedEntries(seeds, field);
        expect(entries).toHaveLength(field);
        const ids = entries.map((e) => (e.kind === 'player' ? e.id : ''));
        expect(new Set(ids)).toEqual(new Set(seeds.map((x) => x.playerId)));
        const groupOf = (id: string) => seeds.find((x) => x.playerId === id)!.groupId;
        for (let i = 0; i < field; i += 2) expect(groupOf(ids[i])).not.toBe(groupOf(ids[i + 1]));
        if (field === 8 && g === 4) {
          for (const grp of groups) {
            const half = (id: string) => (ids.indexOf(id) < field / 2 ? 0 : 1);
            expect(half(grp.rows[0].playerId)).not.toBe(half(grp.rows[1].playerId));
          }
        }
      }
    });
  }
});

describe('nonQualifierPlaces', () => {
  it('shares places by group rank', () => {
    const { eliminated } = qualify(randomGroups(4, 5, createRng(7)), 8);
    const places = nonQualifierPlaces(eliminated, 8);
    const range = (r: number) => places.filter((p) => p.playerId.endsWith(`p${r}`));
    expect(range(3)).toHaveLength(4);
    expect(range(3).every((p) => p.place === 9 && p.placeTo === 12)).toBe(true);
    expect(range(4).every((p) => p.place === 13 && p.placeTo === 16)).toBe(true);
    expect(range(5).every((p) => p.place === 17 && p.placeTo === 20)).toBe(true);
    expect(places).toHaveLength(12);
  });
});
