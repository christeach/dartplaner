import { describe, expect, it } from 'vitest';
import { buildClubKo } from './clubKo';
import { autoAdvance, isPlayable, resolveSlot } from './resolve';
import type { Match, PlaceEntry } from './types';

const league = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);
const opts = { legsKo: 3, legsFinal: 4, placementGames: true, thirdPlace: true };

function simulate(ms: Match[]): Match[] {
  let cur = autoAdvance(ms, new Set(), 0);
  for (;;) {
    const m = cur.find((x) => isPlayable(cur, x));
    if (!m) return cur;
    cur = autoAdvance(cur.map((x) => (x.id === m.id ? { ...x, status: 'done' as const, result: { kind: 'legs' as const, a: x.legsToWin, b: 0 } } : x)), new Set(), 0);
  }
}

// every match is won by side a, so a = winner, b = loser
function places(ms: Match[], fixed: PlaceEntry[]): PlaceEntry[] {
  const done = simulate(ms);
  expect(done.every((m) => m.status === 'done')).toBe(true);
  const out = [...fixed];
  for (const m of done) {
    if (m.winnerPlace) out.push({ playerId: resolveSlot(done, m.a) as string, place: m.winnerPlace });
    if (m.loserPlace) out.push({ playerId: resolveSlot(done, m.b) as string, place: m.loserPlace });
  }
  return out;
}

const pair = (ms: Match[], label: string) => {
  const m = ms.find((x) => x.label === label)!;
  return [m.a, m.b].map((s) => (s.kind === 'player' ? s.id : s));
};

describe('buildClubKo', () => {
  it('7 + 6 with placement games: quarterfinals, cross placement, lone player', () => {
    const { matches, fixedPlaces } = buildClubKo(league('A', 7), league('B', 6), opts);
    expect(pair(matches, 'Viertelfinale 1')).toEqual(['A1', 'B4']);
    expect(pair(matches, 'Viertelfinale 2')).toEqual(['B2', 'A3']);
    expect(pair(matches, 'Viertelfinale 3')).toEqual(['B1', 'A4']);
    expect(pair(matches, 'Viertelfinale 4')).toEqual(['A2', 'B3']);
    expect(pair(matches, 'Halbfinale 1')).toEqual([{ kind: 'winnerOf', matchId: 'ko-R1-1' }, { kind: 'winnerOf', matchId: 'ko-R1-2' }]);
    expect(pair(matches, 'Spiel um Platz 9')).toEqual(['A5', 'B5']);
    expect(pair(matches, 'Spiel um Platz 11')).toEqual(['A6', 'B6']);
    const p9 = matches.find((m) => m.id === 'pl-9')!;
    expect(p9).toMatchObject({ bracket: 'placement', round: 1, legsToWin: 3, status: 'open', winnerPlace: 9, loserPlace: 10 });
    expect(fixedPlaces).toEqual([{ playerId: 'A7', place: 13 }]);
    expect(matches.map((m) => m.order)).toEqual(matches.map((_, i) => i));
    const ps = places(matches, fixedPlaces);
    expect(ps.map((p) => p.place).sort((a, b) => a - b)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(new Set(ps.map((p) => p.playerId)).size).toBe(13);
  });

  it('5 + 6 uses the semifinal variant', () => {
    const { matches, fixedPlaces } = buildClubKo(league('A', 5), league('B', 6), opts);
    expect(pair(matches, 'Halbfinale 1')).toEqual(['A1', 'B2']);
    expect(pair(matches, 'Halbfinale 2')).toEqual(['B1', 'A2']);
    expect(matches.some((m) => m.label.startsWith('Viertelfinale'))).toBe(false);
    expect(pair(matches, 'Spiel um Platz 5')).toEqual(['A3', 'B3']);
    expect(pair(matches, 'Spiel um Platz 7')).toEqual(['A4', 'B4']);
    expect(pair(matches, 'Spiel um Platz 9')).toEqual(['A5', 'B5']);
    expect(fixedPlaces).toEqual([{ playerId: 'B6', place: 11 }]);
    const ps = places(matches, fixedPlaces);
    expect(ps.map((p) => p.place).sort((a, b) => a - b)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
  });

  it('6 + 6 without placement games shares places', () => {
    const { matches, fixedPlaces } = buildClubKo(league('A', 6), league('B', 6), { ...opts, placementGames: false });
    expect(matches.some((m) => m.label === 'Spiel um Platz 5' || m.label === 'Spiel um Platz 9')).toBe(false);
    expect(matches.filter((m) => m.label.startsWith('Viertelfinale')).every((m) => m.loserPlace === 5 && m.loserPlaceTo === 8)).toBe(true);
    expect(fixedPlaces).toEqual([
      { playerId: 'A5', place: 9, placeTo: 10 }, { playerId: 'B5', place: 9, placeTo: 10 },
      { playerId: 'A6', place: 11, placeTo: 12 }, { playerId: 'B6', place: 11, placeTo: 12 },
    ]);
  });

  it('lone player without placement games gets his place alone', () => {
    const { fixedPlaces } = buildClubKo(league('A', 7), league('B', 6), { ...opts, placementGames: false });
    expect(fixedPlaces[fixedPlaces.length - 1]).toEqual({ playerId: 'A7', place: 13 });
  });

  it('2 + 2 has only semis, final and 3rd place', () => {
    const { matches, fixedPlaces } = buildClubKo(league('A', 2), league('B', 2), opts);
    expect(matches.map((m) => m.label).sort()).toEqual(['Finale', 'Halbfinale 1', 'Halbfinale 2', 'Spiel um Platz 3']);
    expect(fixedPlaces).toEqual([]);
  });

  it('6 + 4 with placement games: lone players get consecutive places', () => {
    const { matches, fixedPlaces } = buildClubKo(league('A', 6), league('B', 4), opts);
    expect(pair(matches, 'Spiel um Platz 5')).toEqual(['A3', 'B3']);
    expect(pair(matches, 'Spiel um Platz 7')).toEqual(['A4', 'B4']);
    expect(fixedPlaces).toEqual([{ playerId: 'A5', place: 9 }, { playerId: 'A6', place: 10 }]);
    const ps = places(matches, fixedPlaces);
    expect(ps.map((p) => p.place).sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it('6 + 4 without placement games: shared ranges, then consecutive lone places', () => {
    const { fixedPlaces } = buildClubKo(league('A', 6), league('B', 4), { ...opts, placementGames: false });
    expect(fixedPlaces).toEqual([
      { playerId: 'A3', place: 5, placeTo: 6 }, { playerId: 'B3', place: 5, placeTo: 6 },
      { playerId: 'A4', place: 7, placeTo: 8 }, { playerId: 'B4', place: 7, placeTo: 8 },
      { playerId: 'A5', place: 9 }, { playerId: 'A6', place: 10 },
    ]);
  });

  it('throws when a league has fewer than 2 players', () => {
    expect(() => buildClubKo(['A1'], league('B', 3), opts)).toThrow('Liga A hat zu wenige Spieler für die K.O.-Runde');
    expect(() => buildClubKo(league('A', 3), ['B1'], opts)).toThrow('Liga B hat zu wenige Spieler für die K.O.-Runde');
  });
});
