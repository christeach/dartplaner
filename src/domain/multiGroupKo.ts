import { standardSeedOrder } from './bracket';
import { tieKeyFor, type StandingRow } from './standings';
import type { PlaceEntry, PlayerId, Slot } from './types';

type Seed = { playerId: PlayerId; groupId: string; groupRank: number };
type Cand = Seed & { row: StandingRow };

export function koFieldOptions(groupSizes: number[]): (4 | 8 | 16)[] {
  const g = groupSizes.length;
  if (g === 0) return [];
  const c = Math.ceil(Math.min(...groupSizes) / 2);
  return ([16, 8, 4] as const).filter((f) => g <= f && f <= c * g);
}

const perGame = (r: StandingRow) => (r.played ? [r.points, r.legDiff, r.legsFor].map((v) => v / r.played) : [0, 0, 0]);
const cmp = (x: Cand, y: Cand) => {
  const a = perGame(x.row), b = perGame(y.row);
  return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
};

export function qualify(groups: { id: string; rows: StandingRow[] }[], field: 4 | 8 | 16, fillerOrder?: PlayerId[]): {
  seeds: Seed[]; fillerTieKey?: string; eliminated: { playerId: PlayerId; groupRank: number }[] } {
  const k = Math.floor(field / groups.length);
  const all: Cand[] = groups.flatMap((g) => g.rows.filter((r) => !r.withdrawn)
    .map((row, i) => ({ playerId: row.playerId, groupId: g.id, groupRank: i + 1, row })));
  const pot = (r: number) => all.filter((c) => c.groupRank === r).sort(cmp);
  const seeds: Cand[] = [];
  for (let r = 1; r <= k; r++) seeds.push(...pot(r));
  const need = field - seeds.length;
  let candidates = pot(k + 1);
  let fillerTieKey: string | undefined;
  if (need > 0 && need < candidates.length && cmp(candidates[need - 1], candidates[need]) === 0) {
    const tied = candidates.filter((c) => cmp(c, candidates[need]) === 0);
    const ids = tied.map((c) => c.playerId);
    if (fillerOrder && ids.every((id) => fillerOrder.includes(id))) {
      const at = (c: Cand) => (ids.includes(c.playerId) ? fillerOrder.indexOf(c.playerId) : -1);
      candidates = [...candidates].sort((x, y) => cmp(x, y) || at(x) - at(y));
    } else fillerTieKey = tieKeyFor('fillers', ids);
  }
  seeds.push(...candidates.slice(0, Math.max(need, 0)));
  const picked = new Set(seeds.map((s) => s.playerId));
  return {
    seeds: seeds.map(({ playerId, groupId, groupRank }) => ({ playerId, groupId, groupRank })),
    ...(fillerTieKey ? { fillerTieKey } : {}),
    eliminated: all.filter((c) => !picked.has(c.playerId)).map(({ playerId, groupRank }) => ({ playerId, groupRank })),
  };
}

export function seedEntries(seeds: Seed[], field: 4 | 8 | 16): Slot[] {
  const pos = standardSeedOrder(field); // pos[i] = seed index at bracket position i
  const half = (i: number) => (i < field / 2 ? 0 : 1);
  // conflicts: group mates paired in round 1 (heavy), a group's rank 1 and rank 2 in the same half (light)
  const score = () => {
    let s = 0;
    for (let i = 0; i < field; i++) for (let j = i + 1; j < field; j++) {
      const a = seeds[pos[i]], b = seeds[pos[j]];
      if (a.groupId !== b.groupId) continue;
      if (i >> 1 === j >> 1) s += 100;
      if (half(i) === half(j) && a.groupRank + b.groupRank === 3) s += 1;
    }
    return s;
  };
  const swap = (i: number, j: number) => { [pos[i], pos[j]] = [pos[j], pos[i]]; };
  // seeds by index, lower seeds first (by nearness), then higher ones as a fallback
  const partners = (s: number) => [
    ...seeds.map((_, t) => t).filter((t) => t > s),
    ...seeds.map((_, t) => t).filter((t) => t < s).reverse(),
  ].filter((t) => seeds[t].groupRank === seeds[s].groupRank && seeds[t].groupId !== seeds[s].groupId);
  // lowest seeds move first; a swap is kept only if it reduces the conflicts
  for (let improved = true; improved;) {
    improved = false;
    let cur = score();
    for (let s = seeds.length - 1; s >= 0 && cur > 0; s--) {
      for (const t of partners(s)) {
        const i = pos.indexOf(s), j = pos.indexOf(t);
        swap(i, j);
        const next = score();
        if (next < cur) { cur = next; improved = true; break; }
        swap(i, j);
      }
    }
  }
  return pos.map((s) => ({ kind: 'player', id: seeds[s].playerId }));
}

export function nonQualifierPlaces(eliminated: { playerId: PlayerId; groupRank: number }[], field: 4 | 8 | 16): PlaceEntry[] {
  const out: PlaceEntry[] = [];
  let place = field + 1;
  for (const r of [...new Set(eliminated.map((e) => e.groupRank))].sort((a, b) => a - b)) {
    const ids = eliminated.filter((e) => e.groupRank === r);
    for (const e of ids) out.push({ playerId: e.playerId, place, ...(ids.length > 1 ? { placeTo: place + ids.length - 1 } : {}) });
    place += ids.length;
  }
  return out;
}
