import type { Match, PlayerId } from './types';

/** Circle method; a null entry is the dummy bye and its pairings are omitted. */
export function roundRobinMatches(
  group: { id: string; playerIds: PlayerId[] },
  legsToWin: number,
  idPrefix: string,
): Match[] {
  const ring: (PlayerId | null)[] = [...group.playerIds];
  if (ring.length % 2) ring.push(null);
  const n = ring.length;
  const matches: Match[] = [];
  for (let r = 1; r < n; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a === null || b === null) continue;
      matches.push({
        id: `${idPrefix}-${matches.length + 1}`,
        bracket: 'group',
        groupId: group.id,
        round: r,
        order: 0,
        label: '',
        a: { kind: 'player', id: a },
        b: { kind: 'player', id: b },
        legsToWin,
        status: 'open',
      });
    }
    ring.splice(1, 0, ring.pop() as PlayerId | null);
  }
  return matches;
}

/** Orders by round, then alternates groups; order is 0..n-1 over the result. */
export function interleave(groupsMatches: Match[][]): Match[] {
  const keyed = groupsMatches.flatMap((ms, g) => {
    const seen = new Map<number, number>();
    return ms.map((m) => {
      const k = seen.get(m.round) ?? 0;
      seen.set(m.round, k + 1);
      return { m, g, k };
    });
  });
  keyed.sort((x, y) => x.m.round - y.m.round || x.k - y.k || x.g - y.g);
  return keyed.map(({ m }, order) => ({ ...m, order }));
}
