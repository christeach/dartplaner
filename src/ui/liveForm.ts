import { resolveSlot } from '../domain/resolve';
import { freeBoards, queue } from '../domain/scheduler';
import { pendingTies } from '../domain/tournament';
import type { Match, PlayerStats, Tournament } from '../domain/types';

/** Free board → suggested match (null when every queued match shares a player with an earlier suggestion). */
export function boardSuggestions(t: Tournament): Map<number, Match | null> {
  const q = queue(t);
  const taken = new Set<string | null>();
  const out = new Map<number, Match | null>();
  for (const board of freeBoards(t)) {
    const m = q.find((x) => [x.a, x.b].every((s) => !taken.has(resolveSlot(t.matches, s)))) ?? null;
    if (m) for (const s of [m.a, m.b]) taken.add(resolveSlot(t.matches, s));
    out.set(board, m);
  }
  return out;
}

export function canStartKo(t: Tournament): boolean {
  const group = t.matches.filter((m) => m.bracket === 'group');
  return t.phase === 'groups' && group.length > 0 && group.length === t.matches.length
    && group.every((m) => m.status === 'done' || m.status === 'void') && pendingTies(t).length === 0;
}

export type StatsForm = Record<keyof PlayerStats, string>;
export const emptyStatsForm: StatsForm = { s180: '', highScore: '', highFinish: '', shortLeg: '' };

export const statsToForm = (s: PlayerStats | undefined): StatsForm => ({
  s180: s?.s180 ? String(s.s180) : '',
  highScore: s?.highScore?.toString() ?? '', highFinish: s?.highFinish?.toString() ?? '', shortLeg: s?.shortLeg?.toString() ?? '',
});

export function formToStats(f: StatsForm): PlayerStats | undefined {
  if (Object.values(f).every((v) => v.trim() === '')) return undefined;
  const opt = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const s: PlayerStats = { s180: opt(f.s180) ?? 0 };
  for (const k of ['highScore', 'highFinish', 'shortLeg'] as const) {
    const v = opt(f[k]);
    if (v !== undefined) s[k] = v;
  }
  return s;
}

export function resultLabel(a: number | null, b: number | null, legsToWin: number, nameA: string, nameB: string): string {
  if (a === null || b === null || (a === legsToWin) === (b === legsToWin)) return 'Speichern';
  return a === legsToWin ? `Speichern · ${a}:${b} für ${nameA}` : `Speichern · ${b}:${a} für ${nameB}`;
}
