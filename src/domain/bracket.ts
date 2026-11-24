import type { Bracket, Match, Slot } from './types';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function standardSeedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len - 1 - s]);
  }
  return order;
}

export function byeSeeding(entries: Slot[], size: number): Slot[] {
  return standardSeedOrder(size).map((i) => (i < entries.length ? entries[i] : { kind: 'bye' }));
}

const winnerOf = (m: Match): Slot => ({ kind: 'winnerOf', matchId: m.id });
const loserOf = (m: Match): Slot => ({ kind: 'loserOf', matchId: m.id });

function match(id: string, bracket: Bracket, round: number, label: string, a: Slot, b: Slot, legsToWin: number,
  places: Partial<Pick<Match, 'winnerPlace' | 'loserPlace' | 'loserPlaceTo'>> = {}): Match {
  return { id, bracket, round, order: 0, label, a, b, legsToWin, status: 'open', ...places };
}

// Rounds start at 1 and order is 0-based creation order; buildSingleElim re-bases both when embedding.
export function placementBracket(slots: Slot[], startPlace: number, legs: number, idPrefix: string): Match[] {
  const out: Match[] = [];
  const build = (s: Slot[], start: number, round: number) => {
    if (s.length === 2) {
      out.push(match(`${idPrefix}-P${start}`, 'placement', round, `Spiel um Platz ${start}`, s[0], s[1], legs,
        { winnerPlace: start, loserPlace: start + 1 }));
      return;
    }
    const level: Match[] = [];
    for (let i = 0; i < s.length; i += 2) {
      level.push(match(`${idPrefix}-P${start}-${start + s.length - 1}-${i / 2 + 1}`, 'placement', round,
        `Platzierung ${start}–${start + s.length - 1}`, s[i], s[i + 1], legs));
    }
    out.push(...level);
    build(level.map(winnerOf), start, round + 1);
    build(level.map(loserOf), start + s.length / 2, round + 1);
  };
  build(slots, startPlace, 1);
  return out.map((m, order) => ({ ...m, order }));
}

export function buildSingleElim(entries: Slot[], opts: { idPrefix: string; legsKo: number; legsFinal: number;
  thirdPlace: boolean; placementGames: boolean; firstPlace: number }): Match[] {
  const { idPrefix, legsKo, legsFinal, thirdPlace, placementGames, firstPlace } = opts;
  const out: Match[] = [];
  let slots = entries;
  for (let round = 1; slots.length > 1; round++) {
    const n = slots.length / 2;
    const level: Match[] = [];
    for (let i = 0; i < n; i++) {
      const label = n === 1 ? 'Finale' : n === 2 ? `Halbfinale ${i + 1}` : n === 4 ? `Viertelfinale ${i + 1}` : `Runde ${round}`;
      const places = n === 1 ? { winnerPlace: firstPlace, loserPlace: firstPlace + 1 }
        : n === 2 ? (thirdPlace ? {} : { loserPlace: firstPlace + 2, loserPlaceTo: firstPlace + 3 })
        : placementGames ? {} : { loserPlace: firstPlace + n, loserPlaceTo: firstPlace + 2 * n - 1 };
      level.push(match(`${idPrefix}-R${round}-${i + 1}`, 'main', round, label, slots[2 * i], slots[2 * i + 1],
        n === 1 ? legsFinal : legsKo, places));
    }
    out.push(...level);
    if (n === 2 && thirdPlace) {
      // played alongside the final, so same round as the final
      out.push(match(`${idPrefix}-P3`, 'main', round + 1, `Spiel um Platz ${firstPlace + 2}`, loserOf(level[0]), loserOf(level[1]), legsKo,
        { winnerPlace: firstPlace + 2, loserPlace: firstPlace + 3 }));
    }
    if (n > 2 && placementGames) {
      out.push(...placementBracket(level.map(loserOf), firstPlace + n, legsKo, idPrefix)
        .map((m) => ({ ...m, round: m.round + round })));
    }
    slots = level.map(winnerOf);
  }
  return out.map((m, order) => ({ ...m, order }));
}
