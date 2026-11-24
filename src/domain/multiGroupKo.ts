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

const popcount = (m: number) => { let k = 0; for (; m; m &= m - 1) k++; return k; };

export function seedEntries(seeds: Seed[], field: 4 | 8 | 16): Slot[] {
  const pos = standardSeedOrder(field); // pos[i] = seed index at bracket position i
  const rounds = Math.log2(field);
  // group mates should meet as late as possible: a pair costs 10^(rounds - r + 1) when its earliest meeting is
  // round r, plus 1 when it is a group's winner and second in the same half (tie-break)
  const pairCost = (a: Seed, b: Seed, i: number, j: number) => (a.groupId !== b.groupId ? 0
    : 10 ** (rounds - (31 - Math.clz32(i ^ j))) + (a.groupRank + b.groupRank === 3 && (i ^ j) < field / 2 ? 1 : 0));
  const score = () => {
    let s = 0;
    for (let i = 0; i < field; i++) for (let j = i + 1; j < field; j++) s += pairCost(seeds[pos[i]], seeds[pos[j]], i, j);
    return s;
  };
  // pot by pot (group rank 2, 3, …): exact assignment of the pot's seeds to the pot's positions against those placed
  // before (bitmask DP; pot members come from different groups, so the cost is separable)
  const maxRank = Math.max(...seeds.map((x) => x.groupRank));
  const count = (r: number) => seeds.filter((x) => x.groupRank === r).length;
  // the fillers (an incomplete last rank) share a pot with the rank above, unless that would mix in group winners
  const pot = (x: Seed) => (x.groupRank === maxRank && maxRank > 2 && count(maxRank) < count(1) ? maxRank - 1 : x.groupRank);
  for (let r = 2; r <= maxRank; r++) {
    const xs = pos.map((_, i) => i).filter((i) => pot(seeds[pos[i]]) === r);
    const ps = xs.map((i) => pos[i]);
    const c = ps.map((p) => xs.map((x) => pos.reduce((sum, q, y) => sum
      + (pot(seeds[q]) < r ? pairCost(seeds[p], seeds[q], x, y) : 0), 0)));
    const n = xs.length, dp = new Array<number>(1 << n).fill(Infinity), from = new Array<number>(1 << n).fill(-1);
    dp[0] = 0;
    for (let m = 0; m < 1 << n; m++) {
      if (dp[m] === Infinity) continue;
      const k = popcount(m);
      if (k === n) continue;
      for (let x = 0; x < n; x++) {
        if (m & (1 << x) || dp[m] + c[k][x] >= dp[m | (1 << x)]) continue;
        dp[m | (1 << x)] = dp[m] + c[k][x]; from[m | (1 << x)] = x;
      }
    }
    for (let m = (1 << n) - 1, k = n - 1; m; k--) { const x = from[m]; pos[xs[x]] = ps[k]; m &= ~(1 << x); }
  }
  // then improve within pots by swaps, or 3-cycles when no swap helps (winners stay against seconds etc.)
  const same = (...is: number[]) => is.every((i) => pot(seeds[pos[i]]) === pot(seeds[pos[is[0]]]));
  const rotate = (is: number[]) => { const first = pos[is[0]]; is.forEach((i, n) => { pos[i] = n + 1 < is.length ? pos[is[n + 1]] : first; }); };
  const unrotate = (is: number[]) => rotate([...is].reverse());
  for (let cur = score(), size = 2; size <= 3;) {
    let best: number[] | undefined;
    for (let i = 0; i < field; i++) for (let j = i + 1; j < field; j++) for (let k = size === 2 ? field : 0; k <= field; k++) {
      const is = size === 2 ? [i, j] : [i, j, k];
      if (k === i || k === j || (size === 3 && k === field) || !same(...is)) continue;
      rotate(is);
      const next = score();
      if (next < cur) { cur = next; best = is; }
      unrotate(is);
    }
    if (best) { rotate(best); size = 2; } else size++;
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
