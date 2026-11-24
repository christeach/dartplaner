import { koFieldOptions } from './multiGroupKo';
import type { Mode, PlayerStats, Settings } from './types';

export function parseNames(text: string, existing: string[]): { names: string[]; errors: string[] } {
  const seen = new Set(existing.map((n) => n.trim().toLowerCase()));
  const names: string[] = [], errors: string[] = [];
  for (const line of text.split('\n')) {
    const name = line.trim();
    if (!name) continue;
    if (seen.has(name.toLowerCase())) errors.push(`Doppelter Name: "${name}"`);
    else { seen.add(name.toLowerCase()); names.push(name); }
  }
  return { names, errors };
}

export function minPlayers(mode: Mode): number {
  switch (mode.kind) {
    case 'groupsKo': return mode.groups === 2 ? 4 : 2 * mode.groups;
    case 'roundRobin': return 3;
    case 'singleKo': return 3;
    case 'doubleKo': return 4;
  }
}

const isInt = (x: number, min: number, max = Infinity) => Number.isInteger(x) && x >= min && x <= max;

export function validateSetup(settings: Settings, playerCount: number): string[] {
  const { mode, boards, legs } = settings;
  const errors: string[] = [];
  const min = minPlayers(mode);
  if (playerCount < min) {
    errors.push(`Für diesen Modus sind mindestens ${min} Spieler nötig.`
      + (mode.kind === 'roundRobin' ? '' : ' Vorschlag: „Jeder gegen jeden“.'));
  }
  if (!isInt(boards, 1)) errors.push('Es wird mindestens 1 Board benötigt.');
  if (![legs.group, legs.ko, legs.final].every((l) => isInt(l, 1))) errors.push('Legs zum Sieg müssen mindestens 1 sein.');
  if (mode.kind === 'groupsKo' && mode.groups > 2) {
    // group sizes as drawGroups distributes them (differ by at most 1)
    const sizes = Array.from({ length: mode.groups }, (_, i) =>
      Math.floor(playerCount / mode.groups) + (i < playerCount % mode.groups ? 1 : 0));
    if (koFieldOptions(sizes).length === 0) errors.push('Mit diesen Gruppengrößen ist kein K.O.-Feld (4, 8 oder 16) möglich.');
  }
  return errors;
}

export function isValidLegs(r: { a: number; b: number }, legsToWin: number): boolean {
  return isInt(r.a, 0, legsToWin) && isInt(r.b, 0, legsToWin) && (r.a === legsToWin) !== (r.b === legsToWin);
}

export function validateStats(s: PlayerStats): string[] {
  const errors: string[] = [];
  if (!isInt(s.s180, 0)) errors.push('180er: ganze Zahl ab 0.');
  if (s.highScore !== undefined && !isInt(s.highScore, 1, 180)) errors.push('Highscore: 1 bis 180.');
  if (s.highFinish !== undefined && !isInt(s.highFinish, 2, 170)) errors.push('Highfinish: 2 bis 170.');
  if (s.shortLeg !== undefined && !isInt(s.shortLeg, 9)) errors.push('Shortleg: mindestens 9 Darts.');
  return errors;
}
