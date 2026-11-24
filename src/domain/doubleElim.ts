import type { Bracket, Match, Slot } from './types';

const winnerOf = (m: Match): Slot => ({ kind: 'winnerOf', matchId: m.id });
const loserOf = (m: Match): Slot => ({ kind: 'loserOf', matchId: m.id });

function match(id: string, bracket: Bracket, round: number, label: string, a: Slot, b: Slot, legsToWin: number): Match {
  return { id, bracket, round, order: 0, label, a, b, legsToWin, status: 'open' };
}

// entries: already bye-padded to N = 2^k ≥ 4, adjacent pairs meet in winners round 1
export function buildDoubleElim(entries: Slot[], opts: { legsKo: number; legsFinal: number }): Match[] {
  const { legsKo, legsFinal } = opts;
  const pairUp = (slots: Slot[][], make: (i: number, a: Slot, b: Slot) => Match) =>
    slots.map(([a, b], i) => make(i + 1, a, b));
  const adjacent = (s: Slot[]) => Array.from({ length: s.length / 2 }, (_, i) => [s[2 * i], s[2 * i + 1]]);

  const wb: Match[][] = [];
  for (let r = 1, s = entries; s.length > 1; r++) {
    const level = pairUp(adjacent(s), (i, a, b) =>
      match(`de-W${r}-${i}`, 'winners', r, `Gewinnerrunde ${r} · Spiel ${i}`, a, b, legsKo));
    wb.push(level);
    s = level.map(winnerOf);
  }

  const lb: Match[][] = [];
  const lbRound = (j: number, pairs: Slot[][]) => {
    lb.push(pairUp(pairs, (i, a, b) =>
      match(`de-L${j}-${i}`, 'losers', j + 1, `Verliererrunde ${j} · Spiel ${i}`, a, b, legsKo)));
    return lb[lb.length - 1].map(winnerOf);
  };
  let s = lbRound(1, adjacent(wb[0].map(loserOf)));
  for (let w = 1; w < wb.length; w++) {
    const dropped = wb[w].map(loserOf).reverse(); // reversed to avoid immediate rematches
    s = lbRound(2 * w, s.map((x, i) => [x, dropped[i]]));
    if (s.length > 1) s = lbRound(2 * w + 1, adjacent(s));
  }

  // earlier LB rounds' losers share the range below the later rounds' places
  let place = 3;
  for (let j = lb.length - 1; j >= 0; j--) {
    const c = lb[j].length;
    lb[j] = lb[j].map((m) => ({ ...m, loserPlace: place, ...(c > 1 ? { loserPlaceTo: place + c - 1 } : {}) }));
    place += c;
  }

  const rest = [...wb.flat(), ...lb.flat()];
  const final: Match = { ...match('de-F', 'final', Math.max(...rest.map((m) => m.round)) + 1, 'Finale',
    winnerOf(wb[wb.length - 1][0]), s[0], legsFinal), winnerPlace: 1, loserPlace: 2 };
  return [...rest, final].sort((x, y) => x.round - y.round).map((m, order) => ({ ...m, order }));
}
