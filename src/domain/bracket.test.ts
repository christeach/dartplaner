import { describe, it, expect } from 'vitest';
import { nextPow2, standardSeedOrder, byeSeeding, buildSingleElim, placementBracket } from './bracket';
import type { Match, Slot } from './types';

const p = (id: string): Slot => ({ kind: 'player', id });
const eight = ['A1', 'B4', 'B2', 'A3', 'B1', 'A4', 'A2', 'B3'].map(p);
const opts = { idPrefix: 'ko', legsKo: 3, legsFinal: 5, thirdPlace: true, placementGames: false, firstPlace: 1 };
const byLabel = (ms: Match[], label: string) => ms.filter((m) => m.label === label);
const one = (ms: Match[], label: string) => { const r = byLabel(ms, label); expect(r).toHaveLength(1); return r[0]; };

describe('seeding', () => {
  it('nextPow2', () => {
    expect([1, 2, 3, 5, 8, 9].map(nextPow2)).toEqual([1, 2, 4, 8, 8, 16]);
  });
  it('standardSeedOrder', () => {
    expect(standardSeedOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
    expect(standardSeedOrder(4)).toEqual([0, 3, 1, 2]);
  });
  it('byeSeeding 5 → 8: 3 byes, no bye–bye pair, byes in both halves', () => {
    const s = byeSeeding(['a', 'b', 'c', 'd', 'e'].map(p), 8);
    expect(s).toHaveLength(8);
    expect(s.filter((x) => x.kind === 'bye')).toHaveLength(3);
    for (let i = 0; i < 8; i += 2) expect(s[i].kind === 'bye' && s[i + 1].kind === 'bye').toBe(false);
    expect(s.slice(0, 4).some((x) => x.kind === 'bye')).toBe(true);
    expect(s.slice(4).some((x) => x.kind === 'bye')).toBe(true);
  });
});

describe('buildSingleElim', () => {
  it('8 entries, third place, no placement games → 8 matches', () => {
    const ms = buildSingleElim(eight, opts);
    expect(ms).toHaveLength(8);
    expect(new Set(ms.map((m) => m.id)).size).toBe(8);
    expect(ms.map((m) => m.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(ms.every((m) => m.bracket === 'main' && m.status === 'open' && m.id.startsWith('ko-'))).toBe(true);
    const qf = ms.filter((m) => m.label.startsWith('Viertelfinale'));
    expect(qf.map((m) => m.label)).toEqual(['Viertelfinale 1', 'Viertelfinale 2', 'Viertelfinale 3', 'Viertelfinale 4']);
    for (const m of qf) {
      expect(m).toMatchObject({ round: 1, legsToWin: 3, loserPlace: 5, loserPlaceTo: 8 });
      expect(m.winnerPlace).toBeUndefined();
    }
    expect(qf[0].a).toEqual(p('A1'));
    expect(qf[0].b).toEqual(p('B4'));
    const hf1 = one(ms, 'Halbfinale 1');
    expect(hf1).toMatchObject({ round: 2, a: { kind: 'winnerOf', matchId: qf[0].id }, b: { kind: 'winnerOf', matchId: qf[1].id } });
    expect(hf1.loserPlace).toBeUndefined();
    const hf2 = one(ms, 'Halbfinale 2');
    const fin = one(ms, 'Finale');
    expect(fin).toMatchObject({ round: 3, legsToWin: 5, winnerPlace: 1, loserPlace: 2,
      a: { kind: 'winnerOf', matchId: hf1.id }, b: { kind: 'winnerOf', matchId: hf2.id } });
    const third = one(ms, 'Spiel um Platz 3');
    expect(third).toMatchObject({ round: 3, legsToWin: 3, winnerPlace: 3, loserPlace: 4,
      a: { kind: 'loserOf', matchId: hf1.id }, b: { kind: 'loserOf', matchId: hf2.id } });
  });

  it('no third place → semifinal losers share 3–4', () => {
    const ms = buildSingleElim(eight, { ...opts, thirdPlace: false });
    expect(ms).toHaveLength(7);
    expect(one(ms, 'Halbfinale 1')).toMatchObject({ loserPlace: 3, loserPlaceTo: 4 });
  });

  it('placement games → 12 matches with 5–8 decided by play', () => {
    const ms = buildSingleElim(eight, { ...opts, placementGames: true });
    expect(ms).toHaveLength(12);
    expect(new Set(ms.map((m) => m.id)).size).toBe(12);
    const qf = ms.filter((m) => m.label.startsWith('Viertelfinale'));
    for (const m of qf) { expect(m.loserPlace).toBeUndefined(); expect(m.loserPlaceTo).toBeUndefined(); }
    const pl = byLabel(ms, 'Platzierung 5–8');
    expect(pl).toHaveLength(2);
    expect(pl[0]).toMatchObject({ bracket: 'placement', round: 2, legsToWin: 3,
      a: { kind: 'loserOf', matchId: qf[0].id }, b: { kind: 'loserOf', matchId: qf[1].id } });
    expect(pl[1]).toMatchObject({ a: { kind: 'loserOf', matchId: qf[2].id }, b: { kind: 'loserOf', matchId: qf[3].id } });
    expect(one(ms, 'Spiel um Platz 5')).toMatchObject({ bracket: 'placement', round: 3, winnerPlace: 5, loserPlace: 6,
      a: { kind: 'winnerOf', matchId: pl[0].id }, b: { kind: 'winnerOf', matchId: pl[1].id } });
    expect(one(ms, 'Spiel um Platz 7')).toMatchObject({ round: 3, winnerPlace: 7, loserPlace: 8,
      a: { kind: 'loserOf', matchId: pl[0].id }, b: { kind: 'loserOf', matchId: pl[1].id } });
    expect(ms.map((m) => m.order)).toEqual(ms.map((_, i) => i));
  });

  it('16 entries → Runde 1 losers share 9–16; offset firstPlace', () => {
    const ms = buildSingleElim(Array.from({ length: 16 }, (_, i) => p(`p${i}`)), { ...opts, firstPlace: 3 });
    const r1 = byLabel(ms, 'Runde 1');
    expect(r1).toHaveLength(8);
    expect(r1[0]).toMatchObject({ loserPlace: 11, loserPlaceTo: 18 });
    expect(one(ms, 'Finale')).toMatchObject({ round: 4, winnerPlace: 3, loserPlace: 4 });
    expect(one(ms, 'Spiel um Platz 5')).toMatchObject({ winnerPlace: 5, loserPlace: 6 });
  });

  it('4 entries (club mode) → semis + final + third place', () => {
    const ms = buildSingleElim(['A1', 'B2', 'B1', 'A2'].map(p), opts);
    expect(ms.map((m) => m.label)).toEqual(['Halbfinale 1', 'Halbfinale 2', 'Spiel um Platz 3', 'Finale']);
  });
});

describe('placementBracket', () => {
  it('2 slots → single match', () => {
    const ms = placementBracket([p('a'), p('b')], 9, 2, 'x');
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ label: 'Spiel um Platz 9', winnerPlace: 9, loserPlace: 10, legsToWin: 2, bracket: 'placement' });
  });
  it('8 slots → 4 + 2 + 2 + 4 matches, unique ids', () => {
    const ms = placementBracket(Array.from({ length: 8 }, (_, i) => p(`p${i}`)), 9, 2, 'x');
    expect(ms).toHaveLength(12);
    expect(new Set(ms.map((m) => m.id)).size).toBe(12);
    expect(byLabel(ms, 'Platzierung 9–16')).toHaveLength(4);
    expect(byLabel(ms, 'Platzierung 9–12')).toHaveLength(2);
    expect(byLabel(ms, 'Platzierung 13–16')).toHaveLength(2);
    for (const pl of [9, 11, 13, 15]) expect(one(ms, `Spiel um Platz ${pl}`).winnerPlace).toBe(pl);
  });
});
