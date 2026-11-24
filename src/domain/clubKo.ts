import { buildSingleElim } from './bracket';
import type { Match, PlaceEntry, PlayerId, Slot } from './types';

export function buildClubKo(rankA: PlayerId[], rankB: PlayerId[], opts: { legsKo: number; legsFinal: number;
  placementGames: boolean; thirdPlace: boolean }): { matches: Match[]; fixedPlaces: PlaceEntry[] } {
  const { legsKo, legsFinal, placementGames, thirdPlace } = opts;
  if (rankA.length < 2) throw new Error('Liga A hat zu wenige Spieler für die K.O.-Runde');
  if (rankB.length < 2) throw new Error('Liga B hat zu wenige Spieler für die K.O.-Runde');
  const q = rankA.length >= 6 && rankB.length >= 6 ? 4 : 2;
  const A = (r: number) => rankA[r - 1], B = (r: number) => rankB[r - 1];
  const seeds = q === 4 ? [A(1), B(4), B(2), A(3), B(1), A(4), A(2), B(3)] : [A(1), B(2), B(1), A(2)];
  const entries: Slot[] = seeds.map((id) => ({ kind: 'player', id }));
  const matches = buildSingleElim(entries, { idPrefix: 'ko', legsKo, legsFinal, thirdPlace, placementGames, firstPlace: 1 });
  const fixedPlaces: PlaceEntry[] = [];
  // places stay consecutive: a pair takes two, a lone player (other league ran out) takes one
  let p = 2 * q + 1;
  for (let r = q + 1; r <= Math.max(rankA.length, rankB.length); r++) {
    const a = A(r), b = B(r);
    if (a && b && placementGames) {
      matches.push({ id: `pl-${p}`, bracket: 'placement', round: 1, order: matches.length, label: `Spiel um Platz ${p}`,
        a: { kind: 'player', id: a }, b: { kind: 'player', id: b }, legsToWin: legsKo, status: 'open',
        winnerPlace: p, loserPlace: p + 1 });
      p += 2;
    } else if (a && b) {
      fixedPlaces.push({ playerId: a, place: p, placeTo: p + 1 }, { playerId: b, place: p, placeTo: p + 1 });
      p += 2;
    } else {
      fixedPlaces.push({ playerId: a ?? b, place: p++ });
    }
  }
  return { matches, fixedPlaces };
}
