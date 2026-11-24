import type { Match, PlayerId, Slot } from './types';

export function winnerSide(m: Match): 'a' | 'b' | null {
  if (m.status !== 'done' || !m.result) return null;
  if (m.result.kind === 'walkover') return m.result.winner;
  if (m.result.a === m.result.b) return null;
  return m.result.a > m.result.b ? 'a' : 'b';
}

export function resolveSlot(matches: Match[], slot: Slot): PlayerId | 'bye' | null {
  if (slot.kind === 'player') return slot.id;
  if (slot.kind === 'bye') return 'bye';
  const m = matches.find((x) => x.id === slot.matchId);
  const w = m && winnerSide(m);
  if (!m || !w) return null;
  const side = (w === 'a') === (slot.kind === 'winnerOf') ? m.a : m.b;
  return resolveSlot(matches, side);
}

export function isPlayable(matches: Match[], m: Match): boolean {
  if (m.status !== 'open') return false;
  const a = resolveSlot(matches, m.a), b = resolveSlot(matches, m.b);
  return a !== null && a !== 'bye' && b !== null && b !== 'bye';
}

export function autoAdvance(matches: Match[], withdrawn: ReadonlySet<PlayerId>, now: number): Match[] {
  let cur = matches;
  for (;;) {
    let changed = false;
    const next = cur.map((m) => {
      if (m.status !== 'open') return m;
      const a = resolveSlot(cur, m.a), b = resolveSlot(cur, m.b);
      if (a === null || b === null) return m;
      const aOut = a === 'bye' || withdrawn.has(a), bOut = b === 'bye' || withdrawn.has(b);
      if (!aOut && !bOut) return m;
      changed = true;
      const { board: _board, ...rest } = m;
      return { ...rest, status: 'done' as const, finishedAt: now,
        result: { kind: 'walkover' as const, winner: aOut && !bOut ? 'b' as const : 'a' as const } };
    });
    if (!changed) return cur;
    cur = next;
  }
}
