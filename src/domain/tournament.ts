import { buildSingleElim, byeSeeding, nextPow2 } from './bracket';
import { buildClubKo } from './clubKo';
import { buildDoubleElim } from './doubleElim';
import { drawGroups } from './groups';
import { koFieldOptions, nonQualifierPlaces, qualify, seedEntries } from './multiGroupKo';
import { autoAdvance, isPlayable, resolveSlot, winnerSide } from './resolve';
import { createRng, shuffle } from './rng';
import { interleave, roundRobinMatches } from './roundRobin';
import { computeStandings, type StandingRow } from './standings';
import type { Group, Match, PlaceEntry, Phase, PlayerId, Result, Settings, Slot, Tournament } from './types';
import { isValidLegs, validateSetup, validateStats } from './validate';

type Stats = Match['stats'];
export interface PendingTie { key: string; playerIds: PlayerId[]; label: string }

const fail = (msg: string): never => { throw new Error(msg); };
const withdrawnSet = (t: Tournament) => new Set(t.players.filter((p) => p.withdrawnAt !== undefined).map((p) => p.id));
const getMatch = (t: Tournament, id: string) => t.matches.find((m) => m.id === id) ?? fail('Spiel nicht gefunden.');
const put = (ms: Match[], m: Match) => ms.map((x) => (x.id === m.id ? m : x));
const ids = (m: Match) => [m.a, m.b].flatMap((s) => (s.kind === 'player' ? [s.id] : []));
const koStarted = (t: Tournament) => t.matches.some((m) => m.bracket !== 'group');
const groupsFinished = (t: Tournament) => t.matches.length > 0
  && t.matches.every((m) => m.bracket !== 'group' || m.status === 'done' || m.status === 'void');
const free = ({ board: _b, ...m }: Match): Match => m;

export function groupStandings(t: Tournament, g: Group): StandingRow[] {
  return computeStandings(g.playerIds, t.matches.filter((m) => m.groupId === g.id), withdrawnSet(t), t.tieOrder, g.id);
}

function draw(settings: Settings, playerIds: PlayerId[], seed: number): Group[] {
  const rng = createRng(seed);
  const { mode } = settings;
  if (mode.kind === 'groupsKo') return drawGroups(playerIds, mode.groups, rng);
  if (mode.kind === 'roundRobin') return [{ id: 'g1', name: 'Tabelle', playerIds: shuffle(playerIds, rng) }];
  return [{ id: 'g1', name: 'Teilnehmer', playerIds: shuffle(playerIds, rng) }];
}

export function createTournament(settings: Settings, names: string[], seed: number): Tournament {
  const errors = validateSetup(settings, names.length);
  if (errors.length) fail(errors.join(' '));
  const players = names.map((name, i) => ({ id: `p${i + 1}`, name }));
  return { version: 1, seed, settings, players, groups: draw(settings, players.map((p) => p.id), seed),
    matches: [], phase: 'setup', tieOrder: {}, fixedPlaces: [] };
}

const requireSetup = (t: Tournament) => { if (t.phase !== 'setup') fail('Nach dem Start ist die Einteilung fest.'); };

export function redraw(t: Tournament, seed: number): Tournament {
  requireSetup(t);
  return { ...t, seed, groups: draw(t.settings, t.players.map((p) => p.id), seed) };
}

export function swapPlayers(t: Tournament, a: PlayerId, b: PlayerId): Tournament {
  requireSetup(t);
  const all = t.groups.flatMap((g) => g.playerIds);
  if (!all.includes(a) || !all.includes(b)) fail('Spieler nicht gefunden.');
  const swap = (id: PlayerId) => (id === a ? b : id === b ? a : id);
  return { ...t, groups: t.groups.map((g) => ({ ...g, playerIds: g.playerIds.map(swap) })) };
}

export function start(t: Tournament, now: number): Tournament {
  requireSetup(t);
  const { mode, legs } = t.settings;
  if (mode.kind === 'groupsKo' || mode.kind === 'roundRobin') {
    const matches = interleave(t.groups.map((g) => roundRobinMatches(g, legs.group, g.id)
      .map((m) => ({ ...m, label: `${g.name} · Runde ${m.round}` }))));
    return { ...t, matches, phase: 'groups' };
  }
  const entries: Slot[] = t.groups[0].playerIds.map((id) => ({ kind: 'player', id }));
  const padded = byeSeeding(entries, nextPow2(entries.length));
  const bracket = mode.kind === 'singleKo'
    ? buildSingleElim(padded, { idPrefix: 'ko', legsKo: legs.ko, legsFinal: legs.final, thirdPlace: mode.thirdPlace,
      placementGames: false, firstPlace: 1 })
    : buildDoubleElim(padded, { legsKo: legs.ko, legsFinal: legs.final });
  return { ...t, matches: autoAdvance(bracket, withdrawnSet(t), now), phase: 'ko' };
}

function phaseOf(t: Tournament): Phase {
  if (t.phase === 'setup') return 'setup';
  if (koStarted(t)) return t.matches.every((m) => m.bracket === 'group' || m.status === 'done') ? 'done' : 'ko';
  if (!groupsFinished(t)) return 'groups';
  if (pendingTies(t).length) return 'tiebreak';
  const { mode } = t.settings;
  return mode.kind === 'roundRobin' && !mode.finalTopTwo ? 'done' : 'groups';
}
const settle = (t: Tournament): Tournament => ({ ...t, phase: phaseOf(t) });

export function startMatch(t: Tournament, matchId: string, board: number, now: number): Tournament {
  const m = getMatch(t, matchId);
  if (!isPlayable(t.matches, m)) fail('Dieses Spiel ist nicht spielbar.');
  if (!Number.isInteger(board) || board < 1 || board > t.settings.boards) fail('Ungültiges Board.');
  const running = t.matches.filter((x) => x.status === 'running');
  if (running.some((x) => x.board === board)) fail(`Board ${board} ist belegt.`);
  const busy = new Set(running.flatMap(ids));
  if (ids(m).some((id) => busy.has(id))) fail('Ein Spieler steht bereits an einem Board.');
  return { ...t, matches: put(t.matches, { ...m, status: 'running', board, startedAt: now }) };
}

export function cancelMatch(t: Tournament, matchId: string): Tournament {
  const m = getMatch(t, matchId);
  if (m.status !== 'running') fail('Dieses Spiel läuft nicht.');
  const { startedAt: _s, ...rest } = free(m);
  return { ...t, matches: put(t.matches, { ...rest, status: 'open' }) };
}

function checkInput(m: Match, result: Result, stats: Stats) {
  if (result.kind !== 'legs' || !isValidLegs(result, m.legsToWin)) fail(`Ungültiges Ergebnis: ein Spieler braucht genau ${m.legsToWin} Legs.`);
  const errors = [stats?.a, stats?.b].flatMap((s) => (s ? validateStats(s) : []));
  if (errors.length) fail(errors.join(' '));
}

export function recordResult(t: Tournament, matchId: string, result: Result, stats: Stats, now: number): Tournament {
  const m = getMatch(t, matchId);
  if (!isPlayable(t.matches, { ...m, status: m.status === 'running' ? 'open' : m.status })) fail('Dieses Spiel ist nicht spielbar.');
  checkInput(m, result, stats);
  const done: Match = { ...free(m), status: 'done', result, finishedAt: now, ...(stats ? { stats } : {}) };
  return settle({ ...t, matches: autoAdvance(put(t.matches, done), withdrawnSet(t), now) });
}

const refersTo = (s: Slot, id: string) => (s.kind === 'winnerOf' || s.kind === 'loserOf') && s.matchId === id;

// Downstream matches, following auto-walkovers transitively; blocked if any reached match was played or runs.
function downstream(matches: Match[], id: string): { walkovers: string[]; blocked: boolean } {
  const walkovers: string[] = [];
  let blocked = false;
  for (let queue = [id]; queue.length;) {
    const cur = queue.shift()!;
    for (const d of matches.filter((x) => refersTo(x.a, cur) || refersTo(x.b, cur))) {
      if (d.status === 'running' || (d.status === 'done' && d.result?.kind === 'legs')) blocked = true;
      else if (d.status === 'done' && !walkovers.includes(d.id)) { walkovers.push(d.id); queue.push(d.id); }
    }
  }
  return { walkovers, blocked };
}

export function canEditResult(t: Tournament, matchId: string): boolean {
  const m = getMatch(t, matchId);
  if (m.status !== 'done' || m.result?.kind !== 'legs') return false;
  if (m.bracket === 'group') return !koStarted(t);
  return !downstream(t.matches, matchId).blocked;
}

export function editResult(t: Tournament, matchId: string, result: Result, stats: Stats, now: number): Tournament {
  if (!canEditResult(t, matchId)) fail('Dieses Ergebnis kann nicht mehr geändert werden.');
  const m = getMatch(t, matchId);
  checkInput(m, result, stats);
  const { stats: _s, ...rest } = m;
  const reset = new Set(downstream(t.matches, matchId).walkovers);
  const matches = t.matches.map((x) => {
    if (x.id === matchId) return { ...rest, result, ...(stats ? { stats } : {}) };
    if (!reset.has(x.id)) return x;
    const { result: _r, finishedAt: _f, ...open } = x;
    return { ...open, status: 'open' as const };
  });
  return settle({ ...t, matches: autoAdvance(matches, withdrawnSet(t), now) });
}

export function editStats(t: Tournament, matchId: string, stats: Stats): Tournament {
  const m = getMatch(t, matchId);
  if (m.status !== 'done') fail('Highlights gibt es nur für beendete Spiele.');
  const errors = [stats?.a, stats?.b].flatMap((s) => (s ? validateStats(s) : []));
  if (errors.length) fail(errors.join(' '));
  const { stats: _s, ...rest } = m;
  return { ...t, matches: put(t.matches, { ...rest, ...(stats ? { stats } : {}) }) };
}

export function withdrawPlayer(t: Tournament, playerId: PlayerId, now: number): Tournament {
  if (t.phase === 'setup') fail('Vor dem Start wird niemand abgemeldet – wer fehlt, wird einfach nicht eingetragen.');
  if (t.phase === 'done') fail('Das Turnier ist bereits beendet.');
  const p = t.players.find((x) => x.id === playerId) ?? fail('Spieler nicht gefunden.');
  if (p.withdrawnAt !== undefined) fail(`${p.name} ist bereits abgemeldet.`);
  const players = t.players.map((x) => (x.id === playerId ? { ...x, withdrawnAt: now } : x));
  const withdrawn = new Set([...withdrawnSet(t), playerId]);
  const mine = (m: Match) => ids(m).includes(playerId);
  let matches = t.matches.map((m): Match => {
    if (!mine(m)) return m;
    if (m.bracket === 'group' && (m.status === 'open' || m.status === 'running')) return { ...free(m), status: 'void' };
    if (m.bracket !== 'group' && m.status === 'running') {
      const winner = resolveSlot(t.matches, m.a) === playerId ? 'b' : 'a';
      return { ...free(m), status: 'done', finishedAt: now, result: { kind: 'walkover', winner } };
    }
    return m;
  });
  matches = autoAdvance(matches, withdrawn, now);
  return settle({ ...t, players, matches });
}

// --- group stage → K.O. ---

const placeEntries = (blocks: PlayerId[][], first: number): PlaceEntry[] => {
  const out: PlaceEntry[] = [];
  for (const b of blocks) {
    const place = first + out.length;
    for (const id of b) out.push({ playerId: id, place, ...(b.length > 1 ? { placeTo: place + b.length - 1 } : {}) });
  }
  return out;
};
// rows of active players grouped by shared rank
const rankBlocks = (rows: StandingRow[]) => {
  const blocks: PlayerId[][] = [];
  for (const r of rows.filter((x) => !x.withdrawn)) {
    const last = blocks[blocks.length - 1];
    if (last && rows.find((x) => x.playerId === last[0])!.rank === r.rank) last.push(r.playerId); else blocks.push([r.playerId]);
  }
  return blocks;
};

// withdrawn players share the last places
const withdrawnPlaces = (t: Tournament) => {
  const out = t.players.filter((p) => p.withdrawnAt !== undefined).map((p) => p.id);
  return out.length ? placeEntries([out], t.players.length - out.length + 1) : [];
};

function koField(t: Tournament): 4 | 8 | 16 | undefined {
  const { mode } = t.settings;
  if (mode.kind !== 'groupsKo') return undefined;
  const w = withdrawnSet(t);
  const options = koFieldOptions(t.groups.map((g) => g.playerIds.filter((id) => !w.has(id)).length));
  return options.find((f) => !mode.koFieldSize || f <= mode.koFieldSize);
}

function qualifyMulti(t: Tournament, field: 4 | 8 | 16) {
  const rows = t.groups.map((g) => ({ id: g.id, rows: groupStandings(t, g) }));
  const first = qualify(rows, field);
  const order = first.fillerTieKey ? t.tieOrder[first.fillerTieKey] : undefined;
  return order ? qualify(rows, field, order) : first;
}

export function pendingTies(t: Tournament): PendingTie[] {
  const { mode } = t.settings;
  if ((mode.kind !== 'groupsKo' && mode.kind !== 'roundRobin') || koStarted(t) || !groupsFinished(t)) return [];
  const w = withdrawnSet(t);
  const active = (g: Group) => g.playerIds.filter((id) => !w.has(id)).length;
  let limit: number;
  let filler: PendingTie | undefined;
  if (mode.kind === 'roundRobin') limit = mode.finalTopTwo ? 3 : 1;
  else if (mode.groups === 2) {
    const q = t.groups.every((g) => active(g) >= 6) ? 4 : 2;
    limit = mode.placementGames ? Infinity : q + 1;
  } else {
    const field = koField(t);
    limit = field ? Math.floor(field / mode.groups) + 1 : 1;
    const key = field && qualifyMulti(t, field).fillerTieKey;
    if (key) filler = { key, playerIds: key.slice(key.indexOf(':') + 1).split(','), label: 'Stechen um die Auffüllplätze' };
  }
  const ties: PendingTie[] = [];
  for (const g of t.groups) {
    const rows = groupStandings(t, g);
    for (const r of rows) {
      if (!r.tieKey || r.rank > limit || ties.some((x) => x.key === r.tieKey)) continue;
      const playerIds = rows.filter((x) => x.tieKey === r.tieKey).map((x) => x.playerId);
      ties.push({ key: r.tieKey, playerIds, label: `Stechen ${g.name}: Platz ${r.rank}–${r.rank + playerIds.length - 1}` });
    }
  }
  return [...ties, ...(filler ? [filler] : [])].filter((x) => !t.tieOrder[x.key]);
}

export function setTieOrder(t: Tournament, key: string, order: PlayerId[]): Tournament {
  const tie = pendingTies(t).find((x) => x.key === key) ?? fail('Kein offenes Stechen mit diesem Schlüssel.');
  if (order.length !== tie.playerIds.length || !tie.playerIds.every((id) => order.includes(id))) {
    fail('Die Reihenfolge muss genau die Spieler des Stechens enthalten.');
  }
  return settle({ ...t, tieOrder: { ...t.tieOrder, [key]: order } });
}

export function startKo(t: Tournament): Tournament {
  const { mode, legs } = t.settings;
  if (mode.kind !== 'groupsKo' && !(mode.kind === 'roundRobin' && mode.finalTopTwo)) throw new Error('Dieser Modus hat keine K.O.-Runde.');
  if (koStarted(t)) fail('Die K.O.-Runde läuft bereits.');
  if (!groupsFinished(t)) fail('Es sind noch nicht alle Gruppenspiele beendet.');
  if (pendingTies(t).length) fail('Zuerst muss das Stechen entschieden werden.');
  const ranked = (g: Group) => groupStandings(t, g).filter((r) => !r.withdrawn).map((r) => r.playerId);
  let ko: Match[];
  let fixedPlaces: PlaceEntry[];
  if (mode.kind === 'roundRobin') {
    const rows = groupStandings(t, t.groups[0]);
    const [first, second] = ranked(t.groups[0]);
    ko = [{ id: 'rr-final', bracket: 'final', round: 1, order: 0, label: 'Finale', a: { kind: 'player', id: first },
      b: { kind: 'player', id: second }, legsToWin: legs.final, status: 'open', winnerPlace: 1, loserPlace: 2 }];
    fixedPlaces = placeEntries(rankBlocks(rows).slice(2), 3);
  } else if (mode.groups === 2) {
    ({ matches: ko, fixedPlaces } = buildClubKo(ranked(t.groups[0]), ranked(t.groups[1]),
      { legsKo: legs.ko, legsFinal: legs.final, placementGames: mode.placementGames, thirdPlace: mode.thirdPlace }));
  } else {
    const field = koField(t) ?? fail('Mit diesen Gruppengrößen ist kein K.O.-Feld (4, 8 oder 16) möglich.');
    const q = qualifyMulti(t, field);
    ko = buildSingleElim(seedEntries(q.seeds, field), { idPrefix: 'ko', legsKo: legs.ko, legsFinal: legs.final,
      thirdPlace: mode.thirdPlace, placementGames: mode.placementGames, firstPlace: 1 });
    fixedPlaces = nonQualifierPlaces(q.eliminated, field);
  }
  fixedPlaces = [...fixedPlaces, ...withdrawnPlaces(t)];
  return { ...t, matches: [...t.matches, ...ko], fixedPlaces, phase: 'ko' };
}

export function computePlacements(t: Tournament): PlaceEntry[] {
  const { mode } = t.settings;
  let out: PlaceEntry[];
  if (mode.kind === 'roundRobin' && !koStarted(t)) {
    out = [...placeEntries(rankBlocks(groupStandings(t, t.groups[0])), 1), ...withdrawnPlaces(t)];
  } else {
    out = [...t.fixedPlaces];
    for (const m of t.matches) {
      const w = winnerSide(m);
      if (!w) continue;
      const [win, lose] = w === 'a' ? [m.a, m.b] : [m.b, m.a];
      const winner = resolveSlot(t.matches, win), loser = resolveSlot(t.matches, lose);
      if (m.winnerPlace && winner && winner !== 'bye') out.push({ playerId: winner, place: m.winnerPlace });
      if (m.loserPlace && loser && loser !== 'bye') {
        out.push({ playerId: loser, place: m.loserPlace, ...(m.loserPlaceTo ? { placeTo: m.loserPlaceTo } : {}) });
      }
    }
  }
  return out.sort((x, y) => x.place - y.place);
}
