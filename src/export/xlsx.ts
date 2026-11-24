import * as XLSX from 'xlsx';
import { winnerSide, resolveSlot } from '../domain/resolve';
import { computePlacements, groupStandings } from '../domain/tournament';
import type { PlayerStats, Tournament } from '../domain/types';
import { playerHighlights } from './highlights';

type Cell = string | number | undefined;
const statCells = (s?: PlayerStats): Cell[] => [s?.s180, s?.highScore, s?.highFinish, s?.shortLeg];

export function buildWorkbook(t: Tournament): XLSX.WorkBook {
  const name = (id: string) => t.players.find((p) => p.id === id)?.name ?? id;
  const spiele: Cell[][] = [['Runde', 'Gruppe', 'Board', 'Spieler 1', 'Spieler 2', 'Legs 1', 'Legs 2', 'Sieger',
    '180er 1', 'Highscore 1', 'Highfinish 1', 'Shortleg 1', '180er 2', 'Highscore 2', 'Highfinish 2', 'Shortleg 2']];
  for (const m of t.matches) {
    const a = resolveSlot(t.matches, m.a), b = resolveSlot(t.matches, m.b);
    if (m.status !== 'done' || !m.result || !a || !b || a === 'bye' || b === 'bye') continue;
    const w = winnerSide(m);
    const legs: Cell[] = m.result.kind === 'legs' ? [m.result.a, m.result.b] : ['kampflos', 'kampflos'];
    spiele.push([m.label, t.groups.find((g) => g.id === m.groupId)?.name, m.board, name(a), name(b), ...legs,
      w ? name(w === 'a' ? a : b) : undefined, ...statCells(m.stats?.a), ...statCells(m.stats?.b)]);
  }

  const tabellen: Cell[][] = [];
  for (const g of t.groups) {
    tabellen.push([g.name], ['Platz', 'Name', 'Spiele', 'Siege', 'Niederlagen', 'Legs', 'Leg-Differenz', 'Punkte']);
    for (const r of groupStandings(t, g)) {
      tabellen.push([r.rank, r.withdrawn ? `${name(r.playerId)} (abgemeldet)` : name(r.playerId), r.played, r.won, r.lost, `${r.legsFor}:${r.legsAgainst}`, r.legDiff, r.points]);
    }
    tabellen.push([]);
  }

  const platzierung: Cell[][] = [['Platz', 'Name'],
    ...[...computePlacements(t)].sort((x, y) => x.place - y.place)
      .map((p): Cell[] => [p.placeTo ? `${p.place}–${p.placeTo}` : p.place, name(p.playerId)])];

  const highlights: Cell[][] = [['Name', '180er', 'Highscore', 'Highfinish', 'Shortleg'],
    ...playerHighlights(t).map((h): Cell[] => [h.name, h.s180, h.highScore, h.highFinish, h.shortLeg])];

  const wb = XLSX.utils.book_new();
  for (const [title, rows] of [['Spiele', spiele], ['Tabellen', tabellen], ['Platzierung', platzierung], ['Highlights', highlights]] as const) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows as Cell[][]), title);
  }
  return wb;
}

export const exportFileName = (t: Tournament): string =>
  `${t.settings.name.replace(/[\\/:*?"<>|]/g, '_')}_${t.settings.date}.xlsx`;

export const downloadXlsx = (t: Tournament): void => { XLSX.writeFile(buildWorkbook(t), exportFileName(t)); };
