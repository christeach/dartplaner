import type { Group, PlayerId } from './types';
import { shuffle } from './rng';

export function drawGroups(playerIds: PlayerId[], groupCount: number, rng: () => number): Group[] {
  const groups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
    id: `g${i + 1}`,
    name: `${groupCount === 2 ? 'Liga' : 'Gruppe'} ${String.fromCharCode(65 + i)}`,
    playerIds: [],
  }));
  shuffle(playerIds, rng).forEach((id, i) => groups[i % groupCount].playerIds.push(id));
  return groups;
}
