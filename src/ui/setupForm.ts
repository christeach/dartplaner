import type { Mode } from '../domain/types';

export type ModeChoice = 'club' | 'groups' | 'roundRobin' | 'singleKo' | 'doubleKo';
export interface ModeForm {
  choice: ModeChoice; groups: number; placementGames: boolean; thirdPlace: boolean; finalTopTwo: boolean;
  koFieldSize: 0 | 4 | 8 | 16; // 0 = largest possible
}

export const defaultModeForm: ModeForm = {
  choice: 'club', groups: 3, placementGames: true, thirdPlace: false, finalTopTwo: false, koFieldSize: 0 };

export function buildMode(f: ModeForm): Mode {
  switch (f.choice) {
    case 'club': return { kind: 'groupsKo', groups: 2, placementGames: f.placementGames, thirdPlace: f.thirdPlace };
    case 'groups': return { kind: 'groupsKo', groups: f.groups, placementGames: f.placementGames, thirdPlace: f.thirdPlace,
      ...(f.koFieldSize ? { koFieldSize: f.koFieldSize } : {}) };
    case 'roundRobin': return { kind: 'roundRobin', finalTopTwo: f.finalTopTwo };
    case 'singleKo': return { kind: 'singleKo', thirdPlace: f.thirdPlace };
    case 'doubleKo': return { kind: 'doubleKo' };
  }
}

export function formFromMode(m: Mode): ModeForm {
  switch (m.kind) {
    case 'groupsKo': return { ...defaultModeForm, choice: m.groups === 2 ? 'club' : 'groups',
      groups: m.groups === 2 ? defaultModeForm.groups : m.groups,
      placementGames: m.placementGames, thirdPlace: m.thirdPlace, koFieldSize: m.koFieldSize ?? 0 };
    case 'roundRobin': return { ...defaultModeForm, choice: 'roundRobin', finalTopTwo: m.finalTopTwo };
    case 'singleKo': return { ...defaultModeForm, choice: 'singleKo', thirdPlace: m.thirdPlace };
    case 'doubleKo': return { ...defaultModeForm, choice: 'doubleKo' };
  }
}

// same distribution as validateSetup / drawGroups
export const groupSizes = (players: number, groups: number) =>
  Array.from({ length: groups }, (_, i) => Math.floor(players / groups) + (i < players % groups ? 1 : 0));

export const todayIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
