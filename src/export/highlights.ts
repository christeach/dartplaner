import type { PlayerId, PlayerStats, Slot, Tournament } from '../domain/types';

export interface PlayerHighlight { playerId: PlayerId; name: string; s180: number; highScore?: number; highFinish?: number; shortLeg?: number }
type Best = { names: string; value: number };

const max = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.max(a, b));
const min = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));

export function playerHighlights(t: Tournament): PlayerHighlight[] {
  const rows = new Map<PlayerId, PlayerHighlight>(t.players.map((p) => [p.id, { playerId: p.id, name: p.name, s180: 0 }]));
  const add = (slot: Slot, s?: PlayerStats) => {
    const r = slot.kind === 'player' && s ? rows.get(slot.id) : undefined;
    if (!r || !s) return;
    r.s180 += s.s180;
    const hs = max(r.highScore, s.highScore), hf = max(r.highFinish, s.highFinish), sl = min(r.shortLeg, s.shortLeg);
    if (hs !== undefined) r.highScore = hs;
    if (hf !== undefined) r.highFinish = hf;
    if (sl !== undefined) r.shortLeg = sl;
  };
  for (const m of t.matches) if (m.status === 'done') { add(m.a, m.stats?.a); add(m.b, m.stats?.b); }
  return [...rows.values()];
}

export function eveningHighlights(t: Tournament): { most180?: Best; highScore?: Best; highFinish?: Best; shortLeg?: Best } {
  const rows = playerHighlights(t);
  const best = (get: (r: PlayerHighlight) => number | undefined, better: (a: number, b: number) => boolean): Best | undefined => {
    const c = rows.filter((r) => (get(r) ?? 0) > 0);
    if (!c.length) return undefined;
    const value = c.map((r) => get(r)!).reduce((a, b) => (better(b, a) ? b : a));
    return { names: c.filter((r) => get(r) === value).map((r) => r.name).join(', '), value };
  };
  return {
    most180: best((r) => r.s180, (a, b) => a > b),
    highScore: best((r) => r.highScore, (a, b) => a > b),
    highFinish: best((r) => r.highFinish, (a, b) => a > b),
    shortLeg: best((r) => r.shortLeg, (a, b) => a < b),
  };
}
