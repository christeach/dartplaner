import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { createTournament, recordResult, start, startMatch, withdrawPlayer } from '../domain/tournament';
import type { Settings } from '../domain/types';
import { buildWorkbook, exportFileName } from './xlsx';

const settings: Settings = { name: 'Turnier 11/24', date: '2026-11-24', boards: 2, legs: { group: 2, ko: 2, final: 2 }, mode: { kind: 'roundRobin', finalTopTwo: false } };
const rows = (wb: XLSX.WorkBook, s: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1 });

describe('xlsx export', () => {
  it('has the four sheets and the Spiele header', () => {
    const t = start(createTournament(settings, ['Anna', 'Ben', 'Cem'], 1), 1);
    const wb = buildWorkbook(t);
    expect(wb.SheetNames).toEqual(['Spiele', 'Tabellen', 'Platzierung', 'Highlights']);
    expect(rows(wb, 'Spiele')[0]).toEqual(['Runde', 'Gruppe', 'Board', 'Spieler 1', 'Spieler 2', 'Legs 1', 'Legs 2', 'Sieger',
      '180er 1', 'Highscore 1', 'Highfinish 1', 'Shortleg 1', '180er 2', 'Highscore 2', 'Highfinish 2', 'Shortleg 2']);
    expect(rows(wb, 'Tabellen')[0]).toEqual(['Tabelle']);
    expect(rows(wb, 'Tabellen')[1]).toEqual(['Platz', 'Name', 'Spiele', 'Siege', 'Niederlagen', 'Legs', 'Leg-Differenz', 'Punkte']);
  });

  it('shows played results and kampflos for walkovers', () => {
    const ko: Settings = { ...settings, mode: { kind: 'singleKo', thirdPlace: false } };
    let t = start(createTournament(ko, ['Anna', 'Ben', 'Cem', 'Dora'], 1), 1);
    t = startMatch(t, t.matches[0].id, 1, 2);
    t = recordResult(t, t.matches[1].id, { kind: 'legs', a: 2, b: 1 }, undefined, 3);
    t = withdrawPlayer(t, (t.matches[0].a as { id: string }).id, 4);
    const sp = rows(buildWorkbook(t), 'Spiele').slice(1);
    expect(sp.some((r) => r[5] === 2 && r[6] === 1)).toBe(true);
    expect(sp.some((r) => r[5] === 'kampflos' && r[6] === 'kampflos')).toBe(true);
  });

  it('builds the file name with sanitized characters', () => {
    expect(exportFileName(createTournament(settings, ['A', 'B', 'C'], 1))).toBe('Turnier 11_24_2026-11-24.xlsx');
  });
});
