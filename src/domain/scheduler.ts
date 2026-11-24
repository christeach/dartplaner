import { isPlayable, resolveSlot } from './resolve';
import type { Match, PlayerId, Tournament } from './types';

export function freeBoards(t: Tournament): number[] {
  const used = new Set(t.matches.filter((m) => m.status === 'running').map((m) => m.board));
  return Array.from({ length: t.settings.boards }, (_, i) => i + 1).filter((b) => !used.has(b));
}

export function lastFinished(t: Tournament, playerId: PlayerId): number {
  return Math.max(-Infinity, ...t.matches
    .filter((m) => m.status === 'done' && m.result?.kind === 'legs' && m.finishedAt !== undefined
      && [m.a, m.b].some((s) => resolveSlot(t.matches, s) === playerId))
    .map((m) => m.finishedAt!));
}

export function queue(t: Tournament): Match[] {
  if (t.phase !== 'groups' && t.phase !== 'ko') return [];
  const busy = new Set<PlayerId | 'bye' | null>(t.matches.filter((m) => m.status === 'running')
    .flatMap((m) => [resolveSlot(t.matches, m.a), resolveSlot(t.matches, m.b)]));
  const pause = (m: Match) => Math.max(...[m.a, m.b].map((s) => lastFinished(t, resolveSlot(t.matches, s) as PlayerId)));
  const ko = t.phase === 'ko';
  const cmp = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1); // explicit: -Infinity - -Infinity is NaN
  return t.matches
    .filter((m) => isPlayable(t.matches, m) && ![m.a, m.b].some((s) => busy.has(resolveSlot(t.matches, s))))
    .map((m) => ({ m, p: pause(m) }))
    .sort((x, y) => ko
      ? x.m.round - y.m.round || cmp(x.p, y.p) || x.m.order - y.m.order
      : cmp(x.p, y.p) || x.m.round - y.m.round || x.m.order - y.m.order)
    .map((x) => x.m);
}

export function suggestNext(t: Tournament): Match | null {
  return queue(t)[0] ?? null;
}
