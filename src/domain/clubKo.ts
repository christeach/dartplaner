import { buildSingleElim } from './bracket';
import type { Match, PlaceEntry, PlayerId, Slot } from './types';

export function buildClubKo(rankA: PlayerId[], rankB: PlayerId[], opts: { legsKo: number; legsFinal: number;
  placementGames: boolean; thirdPlace: boolean }): { matches: Match[]; fixedPlaces: PlaceEntry[] } {
  const { legsKo, legsFinal, placementGames, thirdPlace } = opts;
  const q = rankA.length >= 6 && rankB.length >= 6 ? 4 : 2;
  const A = (r: number) => rankA[r - 1], B = (r: number) => rankB[r - 1];
  const seeds = q === 4 ? [A(1), B(4), B(2), A(3), B(1), A(4), A(2), B(3)] : [A(1), B(2), B(1), A(2)];
  const entries: Slot[] = seeds.map((id) => ({ kind: 'player', id }));
  const matches = buildSingleElim(entries, { idPrefix: 'ko', legsKo, legsFinal, thirdPlace, placementGames, firstPlace: 1 });
  const fixedPlaces: PlaceEntry[] = [];
  for (let r = q + 1; r <= Math.max(rankA.length, rankB.length); r++) {
    const p = 2 * q + 1 + 2 * (r - q - 1);
    const a = A(r), b = B(r);
    if (a && b && placementGames) {
      matches.push({ id: `pl-${p}`, bracket: 'placement', round: 1, order: matches.length, label: `Spiel um Platz ${p}`,
        a: { kind: 'player', id: a }, b: { kind: 'player', id: b }, legsToWin: legsKo, status: 'open',
        winnerPlace: p, loserPlace: p + 1 });
    } else if (a && b) {
      fixedPlaces.push({ playerId: a, place: p, placeTo: p + 1 }, { playerId: b, place: p, placeTo: p + 1 });
    } else {
      fixedPlaces.push({ playerId: a ?? b, place: p });
    }
  }
  return { matches, fixedPlaces };
}
