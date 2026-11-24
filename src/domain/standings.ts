import type { Match, PlayerId } from './types';

export interface StandingRow { playerId: PlayerId; played: number; won: number; lost: number;
  legsFor: number; legsAgainst: number; legDiff: number; points: number;
  rank: number;            // equal for unresolved ties
  tieKey?: string;         // set when rank is shared after all criteria and no manual order
  withdrawn: boolean }

type Stats = Omit<StandingRow, 'rank' | 'tieKey' | 'withdrawn'>;
type Counted = { a: PlayerId; b: PlayerId; la: number; lb: number };
type Tier = { ids: PlayerId[]; tieKey?: string };

export function tieKeyFor(keyPrefix: string, ids: PlayerId[]): string {
  return `${keyPrefix}:${[...ids].sort().join(',')}`;
}

function table(ids: PlayerId[], games: Counted[]): Map<PlayerId, Stats> {
  const t = new Map(ids.map((id): [PlayerId, Stats] => [id,
    { playerId: id, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, legDiff: 0, points: 0 }]));
  const add = (id: PlayerId, f: number, ag: number) => {
    const s = t.get(id);
    if (!s) return;
    s.played++; s.legsFor += f; s.legsAgainst += ag; s.legDiff = s.legsFor - s.legsAgainst;
    if (f > ag) { s.won++; s.points += 2; } else if (f < ag) s.lost++;
  };
  for (const g of games) { add(g.a, g.la, g.lb); add(g.b, g.lb, g.la); }
  return t;
}

// Sorts ids by (points, legDiff, legsFor) desc (stable) and groups equal ones.
function split(ids: PlayerId[], t: Map<PlayerId, Stats>): PlayerId[][] {
  const key = (id: PlayerId) => { const s = t.get(id)!; return [s.points, s.legDiff, s.legsFor]; };
  const sorted = [...ids].sort((x, y) => {
    const kx = key(x), ky = key(y);
    return ky[0] - kx[0] || ky[1] - kx[1] || ky[2] - kx[2];
  });
  const blocks: PlayerId[][] = [];
  for (const id of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && key(last[0]).join() === key(id).join()) last.push(id); else blocks.push([id]);
  }
  return blocks;
}

function resolve(block: PlayerId[], games: Counted[], tieOrder: Record<string, PlayerId[]>, prefix: string): Tier[] {
  const inBlock = new Set(block);
  const sub = split(block, table(block, games.filter((g) => inBlock.has(g.a) && inBlock.has(g.b))));
  if (sub.length > 1) return sub.flatMap((s) => (s.length > 1 ? resolve(s, games, tieOrder, prefix) : [{ ids: s }]));
  const tieKey = tieKeyFor(prefix, block);
  const manual = tieOrder[tieKey];
  if (manual && manual.length === block.length && block.every((id) => manual.includes(id))) return manual.map((id) => ({ ids: [id] }));
  return [{ ids: block, tieKey }];
}

export function computeStandings(playerIds: PlayerId[], matches: Match[],
  withdrawn: ReadonlySet<PlayerId>, tieOrder: Record<string, PlayerId[]>, keyPrefix: string): StandingRow[] {
  const games: Counted[] = [];
  for (const m of matches) {
    if (m.status !== 'done' || m.result?.kind !== 'legs' || m.a.kind !== 'player' || m.b.kind !== 'player') continue;
    games.push({ a: m.a.id, b: m.b.id, la: m.result.a, lb: m.result.b });
  }
  const t = table(playerIds, games);
  const active = playerIds.filter((id) => !withdrawn.has(id));
  const tiers: Tier[] = [
    ...split(active, t).flatMap((b) => (b.length > 1 ? resolve(b, games, tieOrder, keyPrefix) : [{ ids: b }])),
    ...split(playerIds.filter((id) => withdrawn.has(id)), t).map((ids) => ({ ids })),
  ];
  const rows: StandingRow[] = [];
  for (const tier of tiers) {
    const rank = rows.length + 1;
    for (const id of tier.ids) rows.push({ ...t.get(id)!, rank, withdrawn: withdrawn.has(id), ...(tier.tieKey ? { tieKey: tier.tieKey } : {}) });
  }
  return rows;
}
