import { resolveSlot } from '../domain/resolve';
import type { StandingRow } from '../domain/standings';
import type { Match, PlaceEntry, PlayerId, Slot, Tournament } from '../domain/types';

export const placeLabel = (place: number, placeTo?: number): string =>
  placeTo && placeTo !== place ? `${place}–${placeTo}` : String(place);

export const formatDate = (iso: string): string => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };

/** Rank cell per row: a shared rank appears once (as a range) on the first row of its block. */
export const rankLabels = (rows: StandingRow[]): string[] => rows.map((r, i) =>
  i > 0 && rows[i - 1].rank === r.rank ? '' : placeLabel(r.rank, r.rank + rows.filter((x) => x.rank === r.rank).length - 1));

export function placeGroups(entries: PlaceEntry[]): { label: string; playerIds: PlayerId[] }[] {
  const out: { label: string; playerIds: PlayerId[] }[] = [];
  for (const e of [...entries].sort((x, y) => x.place - y.place)) {
    const label = placeLabel(e.place, e.placeTo);
    const last = out[out.length - 1];
    if (last?.label === label) last.playerIds.push(e.playerId); else out.push({ label, playerIds: [e.playerId] });
  }
  return out;
}

export function slotLabel(t: Tournament, slot: Slot): string {
  const id = resolveSlot(t.matches, slot);
  if (id === 'bye') return 'Freilos';
  if (id) return t.players.find((p) => p.id === id)?.name ?? '?';
  if (slot.kind !== 'winnerOf' && slot.kind !== 'loserOf') return '?';
  const label = t.matches.find((m) => m.id === slot.matchId)?.label ?? '?';
  return `${slot.kind === 'winnerOf' ? 'Sieger' : 'Verlierer'} ${label}`;
}

export interface KoSection { title: string; matches: Match[] }

const isPlaceGame = (m: Match) => m.label.startsWith('Spiel um Platz');
// the 3rd-place game shares the final's round; list it after the final
const byRound = (x: Match, y: Match) => x.round - y.round || +isPlaceGame(x) - +isPlaceGame(y) || x.order - y.order;

function roundTitle(ms: Match[]): string {
  if (ms[0].bracket === 'winners') return `Gewinnerrunde ${ms[0].round}`;
  const n = ms.filter((m) => !isPlaceGame(m)).length;
  return n === 1 ? 'Finale' : n === 2 ? 'Halbfinale' : n === 4 ? 'Viertelfinale' : `Runde ${ms[0].round}`;
}

/** Main bracket ('main'/'winners') as one column per round; other K.O. brackets as headed lists. */
export function koLayout(t: Tournament): { columns: KoSection[]; lists: KoSection[] } {
  const main = t.matches.filter((m) => m.bracket === 'main' || m.bracket === 'winners').sort(byRound);
  const rounds = [...new Set(main.map((m) => m.round))].map((r) => main.filter((m) => m.round === r));
  const lists = ([['placement', 'Platzierungsspiele'], ['losers', 'Verliererrunde'], ['final', 'Finale']] as const)
    .map(([b, title]) => ({ title, matches: t.matches.filter((m) => m.bracket === b).sort(byRound) }))
    .filter((s) => s.matches.length > 0);
  return { columns: rounds.map((ms) => ({ title: roundTitle(ms), matches: ms })), lists };
}

/** Extra place info a label does not already carry, e.g. "Verlierer: Platz 5–8". */
export const placeHint = (m: Match): string | null =>
  m.loserPlace && !m.winnerPlace ? `Verlierer: Platz ${placeLabel(m.loserPlace, m.loserPlaceTo)}` : null;

export const hasGroupTables = (t: Tournament) => t.settings.mode.kind === 'groupsKo' || t.settings.mode.kind === 'roundRobin';

export const playerName = (t: Tournament, m: Match, side: 'a' | 'b') => {
  const id = resolveSlot(t.matches, m[side]);
  return t.players.find((p) => p.id === id)?.name ?? '?';
};

/** "A 3:1 B" or "A kampflos"; null for bye advances (nothing was played). */
export function resultText(t: Tournament, m: Match): string | null {
  const a = resolveSlot(t.matches, m.a), b = resolveSlot(t.matches, m.b);
  if (m.status !== 'done' || !m.result || !a || !b || a === 'bye' || b === 'bye') return null;
  if (m.result.kind === 'walkover') return `${playerName(t, m, m.result.winner)} kampflos gegen ${playerName(t, m, m.result.winner === 'a' ? 'b' : 'a')}`;
  return `${playerName(t, m, 'a')} ${m.result.a}:${m.result.b} ${playerName(t, m, 'b')}`;
}
