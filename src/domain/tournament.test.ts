import { describe, expect, it } from 'vitest';
import { isPlayable, resolveSlot } from './resolve';
import {
  canEditResult, computePlacements, createTournament, editResult, editStats, groupStandings, pendingTies,
  recordResult, setTieOrder, start, startKo, startMatch, withdrawPlayer,
} from './tournament';
import type { Match, Mode, Result, Settings, Tournament } from './types';

let now = 0;
const tick = () => ++now;
const settings = (mode: Mode): Settings =>
  ({ name: 'Vereinsabend', date: '2026-11-24', boards: 4, legs: { group: 3, ko: 3, final: 4 }, mode });
const club: Mode = { kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true };
const names = (n: number) => Array.from({ length: n }, (_, i) => `Spieler ${i + 1}`);
const aWins = (m: Match): Result => ({ kind: 'legs', a: m.legsToWin, b: 0 });

function playAll(t: Tournament, result = aWins): Tournament {
  for (;;) {
    const m = t.matches.find((x) => isPlayable(t.matches, x));
    if (!m) return t;
    t = recordResult(t, m.id, result(m), undefined, tick());
  }
}
function resolveTies(t: Tournament): Tournament {
  for (let ties = pendingTies(t); ties.length; ties = pendingTies(t)) t = setTieOrder(t, ties[0].key, ties[0].playerIds);
  return t;
}
const toKo = (t: Tournament) => startKo(resolveTies(playAll(start(t, tick()))));
const koPlayers = (t: Tournament) => t.matches.filter((m) => m.bracket !== 'group')
  .flatMap((m) => [m.a, m.b]).filter((s) => s.kind === 'player').map((s) => (s as { id: string }).id);

describe('tournament lifecycle', () => {
  it('club evening with 13 players runs end to end with places 1..13 exactly once', () => {
    let t = createTournament(settings(club), names(13), 7);
    expect(t.phase).toBe('setup');
    expect(t.groups.map((g) => g.playerIds.length).sort()).toEqual([6, 7]);
    t = start(t, tick());
    expect(t.phase).toBe('groups');
    expect(t.matches[0].label).toMatch(/^Liga [AB] · Runde 1$/);
    t = playAll(t);
    expect(['groups', 'tiebreak']).toContain(t.phase);
    t = resolveTies(t);
    expect(t.phase).toBe('groups');
    t = playAll(startKo(t));
    expect(t.phase).toBe('done');
    const places = computePlacements(t);
    expect(places.map((p) => p.place)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(new Set(places.map((p) => p.playerId)).size).toBe(13);
  });

  it('withdrawal in the group phase voids his running match and puts him last', () => {
    let t = start(createTournament(settings(club), names(12), 7), tick());
    const m = t.matches.find((x) => isPlayable(t.matches, x))!;
    t = startMatch(t, m.id, 1, tick());
    const out = (m.a as { id: string }).id;
    t = withdrawPlayer(t, out, tick());
    const after = t.matches.find((x) => x.id === m.id)!;
    expect(after.status).toBe('void');
    expect(after.board).toBeUndefined();
    expect(t.matches.some((x) => x.status === 'running')).toBe(false);
    t = startKo(resolveTies(playAll(t)));
    expect(koPlayers(t)).not.toContain(out);
    t = playAll(t);
    expect(t.phase).toBe('done');
    const places = computePlacements(t);
    expect(places[places.length - 1]).toEqual({ playerId: out, place: 12 });
    expect(places.map((p) => p.place)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('withdrawal in the K.O. while his match runs gives the opponent a walkover and frees the board', () => {
    let t = start(createTournament(settings({ kind: 'singleKo', thirdPlace: true }), names(4), 7), tick());
    expect(t.phase).toBe('ko');
    const m = t.matches.find((x) => isPlayable(t.matches, x))!;
    t = startMatch(t, m.id, 2, tick());
    t = withdrawPlayer(t, (m.a as { id: string }).id, tick());
    const after = t.matches.find((x) => x.id === m.id)!;
    expect(after.status).toBe('done');
    expect(after.result).toEqual({ kind: 'walkover', winner: 'b' });
    expect(after.board).toBeUndefined();
  });

  it('K.O. result is editable until the follow-up match starts; editing flips the participant', () => {
    let t = toKo(createTournament(settings(club), names(12), 7));
    const qf1 = 'ko-R1-1', hf1 = 'ko-R2-1';
    t = recordResult(t, qf1, { kind: 'legs', a: 3, b: 0 }, undefined, tick());
    const hf = () => t.matches.find((x) => x.id === hf1)!;
    const q = t.matches.find((x) => x.id === qf1)!;
    expect(resolveSlot(t.matches, hf().a)).toBe(resolveSlot(t.matches, q.a));
    expect(canEditResult(t, qf1)).toBe(true);
    t = editResult(t, qf1, { kind: 'legs', a: 1, b: 3 }, undefined, tick());
    expect(resolveSlot(t.matches, hf().a)).toBe(resolveSlot(t.matches, q.b));
    t = recordResult(t, 'ko-R1-2', { kind: 'legs', a: 3, b: 0 }, undefined, tick());
    t = startMatch(t, hf1, 1, tick());
    expect(canEditResult(t, qf1)).toBe(false);
    expect(() => editResult(t, qf1, { kind: 'legs', a: 3, b: 0 }, undefined, tick())).toThrow();
    t = editStats(t, qf1, { a: { s180: 1 } });
    expect(t.matches.find((x) => x.id === qf1)!.stats).toEqual({ a: { s180: 1 } });
  });

  it('editing a group result recomputes the standings', () => {
    let t = start(createTournament(settings({ kind: 'roundRobin', finalTopTwo: false }), names(4), 7), tick());
    const m = t.matches[0];
    const [a, b] = [(m.a as { id: string }).id, (m.b as { id: string }).id];
    const rank = (id: string) => groupStandings(t, t.groups[0]).find((r) => r.playerId === id)!.rank;
    t = recordResult(t, m.id, { kind: 'legs', a: 3, b: 0 }, undefined, tick());
    expect([rank(a), rank(b)]).toEqual([1, 4]);
    t = editResult(t, m.id, { kind: 'legs', a: 0, b: 3 }, undefined, tick());
    expect([rank(a), rank(b)]).toEqual([4, 1]);
  });

  it('startMatch refuses a player who is already running and an occupied board', () => {
    let t = start(createTournament(settings({ kind: 'roundRobin', finalTopTwo: false }), names(4), 7), tick());
    const m = t.matches[0];
    t = startMatch(t, m.id, 1, tick());
    const ids = [m.a, m.b].map((s) => (s as { id: string }).id);
    const has = (x: Match) => [x.a, x.b].some((s) => ids.includes((s as { id: string }).id));
    const clash = t.matches.find((x) => x.status === 'open' && has(x))!;
    const free = t.matches.find((x) => x.status === 'open' && !has(x))!;
    expect(() => startMatch(t, clash.id, 2, tick())).toThrow();
    expect(() => startMatch(t, free.id, 1, tick())).toThrow();
    expect(startMatch(t, free.id, 2, tick()).matches.find((x) => x.id === free.id)!.status).toBe('running');
  });

  it('single K.O. with 5 players and third place reaches done with places 1, 2, 3, 4, 5–8', () => {
    const t = playAll(start(createTournament(settings({ kind: 'singleKo', thirdPlace: true }), names(5), 7), tick()));
    expect(t.phase).toBe('done');
    expect(computePlacements(t).map((p) => [p.place, p.placeTo])).toEqual(
      [[1, undefined], [2, undefined], [3, undefined], [4, undefined], [5, 8]]);
  });

  it('round robin with a perfect three-way tie for 1st goes to tiebreak, then done', () => {
    let t = start(createTournament(settings({ kind: 'roundRobin', finalTopTwo: false }), names(4), 7), tick());
    const beats = (x: string, y: string) => y === 'p4' || (x === 'p1' && y === 'p2') || (x === 'p2' && y === 'p3') || (x === 'p3' && y === 'p1');
    t = playAll(t, (m) => {
      const [a, b] = [(m.a as { id: string }).id, (m.b as { id: string }).id];
      const lose = a === 'p4' || b === 'p4' ? 0 : 1;
      return beats(a, b) ? { kind: 'legs', a: 3, b: lose } : { kind: 'legs', a: lose, b: 3 };
    });
    expect(t.phase).toBe('tiebreak');
    const ties = pendingTies(t);
    expect(ties).toHaveLength(1);
    expect([...ties[0].playerIds].sort()).toEqual(['p1', 'p2', 'p3']);
    t = setTieOrder(t, ties[0].key, ['p2', 'p1', 'p3']);
    expect(t.phase).toBe('done');
    expect(computePlacements(t).map((p) => p.playerId)).toEqual(['p2', 'p1', 'p3', 'p4']);
  });

  it.each<[string, Mode, number]>([
    ['3 groups', { kind: 'groupsKo', groups: 3, placementGames: true, thirdPlace: true }, 12],
    ['double K.O.', { kind: 'doubleKo' }, 6],
    ['round robin with final', { kind: 'roundRobin', finalTopTwo: true }, 5],
  ])('%s runs to done and places every player once', (_, mode, n) => {
    let t = playAll(start(createTournament(settings(mode), names(n), 7), tick()));
    if (t.phase !== 'done') t = playAll(startKo(resolveTies(t)));
    expect(t.phase).toBe('done');
    const places = computePlacements(t);
    expect(places.map((p) => p.playerId).sort()).toEqual(t.players.map((p) => p.id).sort());
    expect(places[0].place).toBe(1);
  });

  // within group g1 the last three players form a perfect cyclic tie, everyone else is strictly ordered by draw position
  const cyclicBottom = (t: Tournament) => {
    const trio = t.groups[0].playerIds.slice(-3);
    const pos = (id: string) => t.groups.flatMap((g) => g.playerIds).indexOf(id);
    return (m: Match): Result => {
      const [a, b] = [(m.a as { id: string }).id, (m.b as { id: string }).id];
      if (trio.includes(a) && trio.includes(b)) {
        const aWins = trio[(trio.indexOf(a) + 1) % 3] === b;
        return aWins ? { kind: 'legs', a: 3, b: 1 } : { kind: 'legs', a: 1, b: 3 };
      }
      return pos(a) < pos(b) ? { kind: 'legs', a: 3, b: 0 } : { kind: 'legs', a: 0, b: 3 };
    };
  };

  it('club without placement games: a tie at ranks 6–8 needs Stechen', () => {
    let t = start(createTournament(settings({ ...club, placementGames: false }), names(16), 7), tick());
    t = playAll(t, cyclicBottom(t));
    expect(t.phase).toBe('tiebreak');
    expect(pendingTies(t).map((x) => x.label)).toEqual(['Stechen Liga A: Platz 6–8']);
  });

  it('multi-group: a tie below the cut needs Stechen; with the filler tie resolved it runs to done', () => {
    let t = start(createTournament(settings({ kind: 'groupsKo', groups: 3, placementGames: true, thirdPlace: true }), names(18), 7), tick());
    t = playAll(t, cyclicBottom(t));
    expect(t.phase).toBe('tiebreak');
    const ties = pendingTies(t);
    expect(ties.map((x) => x.label)).toContain('Stechen Gruppe A: Platz 4–6');
    expect(ties.some((x) => x.key.startsWith('fillers:'))).toBe(true);
    expect(() => startKo(t)).toThrow();
    t = playAll(startKo(resolveTies(t)));
    expect(t.phase).toBe('done');
    expect(computePlacements(t).map((p) => p.playerId).sort()).toEqual(t.players.map((p) => p.id).sort());
  });

  it('editResult keeps the existing stats when none are given', () => {
    let t = start(createTournament(settings({ kind: 'roundRobin', finalTopTwo: false }), names(4), 7), tick());
    const id = t.matches[0].id;
    t = recordResult(t, id, { kind: 'legs', a: 3, b: 0 }, { a: { s180: 2 } }, tick());
    t = editResult(t, id, { kind: 'legs', a: 0, b: 3 }, undefined, tick());
    expect(t.matches.find((x) => x.id === id)!.stats).toEqual({ a: { s180: 2 } });
  });

  it('editStats rejects walkover matches', () => {
    const t = start(createTournament(settings({ kind: 'singleKo', thirdPlace: true }), names(5), 7), tick());
    const wo = t.matches.find((x) => x.result?.kind === 'walkover')!;
    expect(() => editStats(t, wo.id, { a: { s180: 1 } })).toThrow('Kampflose');
  });

  it('round robin final needs 2 active players', () => {
    let t = start(createTournament(settings({ kind: 'roundRobin', finalTopTwo: true }), names(3), 7), tick());
    t = withdrawPlayer(withdrawPlayer(t, 'p1', tick()), 'p2', tick());
    expect(() => startKo(t)).toThrow('mindestens 2 aktive Spieler');
  });

  it('editResult resets downstream walkovers transitively and recomputes them', () => {
    let t = start(createTournament(settings({ kind: 'singleKo', thirdPlace: false }), names(8), 7), tick());
    for (const id of ['ko-R1-2', 'ko-R1-3', 'ko-R1-4']) {
      const m = t.matches.find((x) => x.id === id)!;
      for (const s of [m.a, m.b]) t = withdrawPlayer(t, (s as { id: string }).id, tick());
    }
    t = recordResult(t, 'ko-R1-1', { kind: 'legs', a: 3, b: 0 }, undefined, tick());
    const qf1 = t.matches.find((x) => x.id === 'ko-R1-1')!;
    const champion = () => resolveSlot(t.matches, { kind: 'winnerOf', matchId: 'ko-R3-1' });
    expect(t.phase).toBe('done');
    expect(champion()).toBe(resolveSlot(t.matches, qf1.a));
    expect(canEditResult(t, 'ko-R1-1')).toBe(true);
    t = editResult(t, 'ko-R1-1', { kind: 'legs', a: 1, b: 3 }, undefined, tick());
    expect(champion()).toBe(resolveSlot(t.matches, qf1.b));
    expect(t.phase).toBe('done');
  });

  it('a K.O. result is locked once a dependent match is done with legs', () => {
    const t = playAll(start(createTournament(settings({ kind: 'singleKo', thirdPlace: false }), names(4), 7), tick()));
    expect(canEditResult(t, 'ko-R1-1')).toBe(false);
    expect(canEditResult(t, 'ko-R2-1')).toBe(true);
  });
});
