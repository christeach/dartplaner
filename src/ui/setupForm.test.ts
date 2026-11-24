import { describe, expect, it } from 'vitest';
import { buildMode, defaultLegs, defaultModeForm, formFromMode, groupSizes, shownLegs, todayIso, usedLegs } from './setupForm';

describe('setupForm', () => {
  it('default is the club mode: 2 groups with placement games and third-place match', () => {
    expect(buildMode(defaultModeForm)).toEqual({ kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true });
  });

  it('builds each mode with only its own options', () => {
    const f = { ...defaultModeForm, groups: 4, thirdPlace: true, finalTopTwo: true, koFieldSize: 8 as const };
    expect(buildMode({ ...f, choice: 'groups' })).toEqual(
      { kind: 'groupsKo', groups: 4, placementGames: true, thirdPlace: true, koFieldSize: 8 });
    expect(buildMode({ ...f, choice: 'groups', koFieldSize: 0 })).toEqual(
      { kind: 'groupsKo', groups: 4, placementGames: true, thirdPlace: true });
    expect(buildMode({ ...f, choice: 'club' })).toEqual({ kind: 'groupsKo', groups: 2, placementGames: true, thirdPlace: true });
    expect(buildMode({ ...f, choice: 'roundRobin' })).toEqual({ kind: 'roundRobin', finalTopTwo: true });
    expect(buildMode({ ...f, choice: 'singleKo' })).toEqual({ kind: 'singleKo', thirdPlace: true });
    expect(buildMode({ ...f, choice: 'doubleKo' })).toEqual({ kind: 'doubleKo' });
  });

  it('formFromMode round-trips through buildMode', () => {
    for (const m of [
      { kind: 'groupsKo', groups: 2, placementGames: false, thirdPlace: true },
      { kind: 'groupsKo', groups: 5, placementGames: true, thirdPlace: false, koFieldSize: 4 },
      { kind: 'roundRobin', finalTopTwo: true },
      { kind: 'singleKo', thirdPlace: true },
      { kind: 'doubleKo' },
    ] as const) expect(buildMode(formFromMode(m))).toEqual(m);
  });

  it('groupSizes differ by at most 1, larger first', () => {
    expect(groupSizes(13, 3)).toEqual([5, 4, 4]);
    expect(groupSizes(12, 4)).toEqual([3, 3, 3, 3]);
  });

  it('todayIso formats the local date', () => {
    expect(todayIso(new Date(2026, 10, 4))).toBe('2026-11-04');
  });

  it('hidden legs fields fall back to defaults so they cannot cause errors', () => {
    const bad = { group: NaN, ko: NaN, final: NaN };
    const f = (choice: typeof defaultModeForm.choice, finalTopTwo = false) => ({ ...defaultModeForm, choice, finalTopTwo });
    expect(shownLegs(f('singleKo'))).toEqual({ group: false, ko: true, final: true });
    expect(usedLegs(f('singleKo'), bad)).toEqual({ group: defaultLegs.group, ko: NaN, final: NaN });
    expect(usedLegs(f('doubleKo'), bad).group).toBe(defaultLegs.group);
    expect(usedLegs(f('roundRobin'), bad)).toEqual({ group: NaN, ko: defaultLegs.ko, final: defaultLegs.final });
    expect(usedLegs(f('roundRobin', true), bad)).toEqual({ group: NaN, ko: defaultLegs.ko, final: NaN });
    expect(usedLegs(f('club'), bad)).toEqual(bad);
  });
});
