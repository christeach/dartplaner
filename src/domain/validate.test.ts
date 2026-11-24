import { describe, expect, it } from 'vitest';
import { isValidLegs, minPlayers, parseNames, validateSetup, validateStats } from './validate';
import type { Settings } from './types';

const settings = (mode: Settings['mode']): Settings =>
  ({ name: 'T', date: '2026-11-24', boards: 4, legs: { group: 3, ko: 3, final: 4 }, mode });

describe('parseNames', () => {
  it('drops blanks, trims and rejects case-insensitive duplicates', () => {
    const r = parseNames('Anna\n\n  Bernd \nanna', []);
    expect(r.names).toEqual(['Anna', 'Bernd']);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('anna');
  });

  it('checks against existing names', () => {
    expect(parseNames('BERND', ['Bernd']).errors).toEqual(['Doppelter Name: "BERND"']);
  });
});

describe('isValidLegs', () => {
  it('needs exactly one side at N', () => {
    expect(isValidLegs({ a: 3, b: 1 }, 3)).toBe(true);
    expect(isValidLegs({ a: 3, b: 3 }, 3)).toBe(false);
    expect(isValidLegs({ a: 2, b: 1 }, 3)).toBe(false);
    expect(isValidLegs({ a: 4, b: 0 }, 3)).toBe(false);
  });
});

describe('validateStats', () => {
  it('flags an out-of-range high finish', () => {
    expect(validateStats({ s180: 0, highFinish: 171 })).toHaveLength(1);
    expect(validateStats({ s180: 2, highScore: 180, highFinish: 170, shortLeg: 9 })).toEqual([]);
  });
});

describe('minPlayers / validateSetup', () => {
  it('per mode', () => {
    expect(minPlayers({ kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true })).toBe(4);
    expect(minPlayers({ kind: 'groupsKo', groups: 3, placementGames: true, thirdPlace: true })).toBe(6);
    expect(minPlayers({ kind: 'roundRobin', finalTopTwo: false })).toBe(3);
    expect(minPlayers({ kind: 'singleKo', thirdPlace: true })).toBe(3);
    expect(minPlayers({ kind: 'doubleKo' })).toBe(4);
  });

  it('suggests "Jeder gegen jeden" when too few players', () => {
    const e = validateSetup(settings({ kind: 'doubleKo' }), 3);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('Jeder gegen jeden');
  });

  it('checks boards, legs and the K.O. field for more than 2 groups', () => {
    expect(validateSetup({ ...settings({ kind: 'singleKo', thirdPlace: true }), boards: 0 }, 8)).toHaveLength(1);
    expect(validateSetup({ ...settings({ kind: 'singleKo', thirdPlace: true }), legs: { group: 3, ko: 0, final: 4 } }, 8)).toHaveLength(1);
    expect(validateSetup(settings({ kind: 'groupsKo', groups: 3, placementGames: true, thirdPlace: true }), 6)).toHaveLength(1);
    expect(validateSetup(settings({ kind: 'groupsKo', groups: 3, placementGames: true, thirdPlace: true }), 12)).toEqual([]);
  });
});
