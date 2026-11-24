# Dartplaner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser-only web app for a darts club to set up, run (board view) and export tournaments in four modes, including the club's "2 Ligen + K.O. + Platzierungsspiele".

**Architecture:** All tournament logic lives in pure TypeScript functions in `src/domain/` (no React), operating on one serializable `Tournament` object. Every match is a node whose two sides are `Slot`s (a player, the winner/loser of another match, or a bye); a single `autoAdvance` pass resolves byes and walkovers, so all modes share one engine. React UI in `src/ui/` dispatches to the domain functions through a reducer; state is mirrored to `localStorage`.

**Tech Stack:** Vite + React 18 + TypeScript (strict), Vitest, SheetJS (`xlsx` 0.20.3 from cdn.sheetjs.com), plain CSS (`@media print` for PDF). Node 22.

**Spec:** `docs/superpowers/specs/2026-11-24-dartplaner-design.md` — read it before any task; section numbers below refer to it.

## Global Constraints

- Everything free; no backend, no accounts, no database. Static hosting (GitHub Pages or Netlify), so `vite.config.ts` uses `base: './'`.
- UI language: German. All visible strings German.
- One tournament at a time, one device.
- Defaults: boards 4 (min 1); legs to win group 3 / K.O. 3 / Finale 4; placement games use the K.O. value; mode default `groupsKo` with 2 groups, placement games on, third place on.
- Scoring: win 2, loss 0; tiebreak order points → leg difference → legs won → head-to-head (recursive mini-table) → manual Stechen (spec §7).
- Stats ranges: 180er ≥ 0 integer; Highscore 1–180; Highfinish 2–170; Shortleg ≥ 9 (spec §6.3).
- Club mode quarterfinal threshold: **each** league ≥ 6 players, else top 2 per league to semifinal (spec §8.1).
- No Swiss system, no scorer, no clock (spec §3).
- Visual design via skill `/ui-ux-pro-max:design`; final UI check via `/unslop-anything` (spec §5).
- Randomness only through the injected seeded RNG (`src/domain/rng.ts`), never `Math.random` in domain code.

## Review Focus

1. Page reload in the middle of the evening (running boards, half-entered group) → everything comes back exactly; test in Task 10.
2. Player withdrawn while his match is running on a board → match ends as walkover for the opponent (K.O.) or is voided (group), board is freed; test in Task 8.
3. Pasted name list with blank lines, trailing spaces, "anna" and "Anna" → blanks dropped, trimmed, duplicate rejected with a message; test in Task 8.
4. `localStorage` unavailable or full (private window) → app still runs without persistence and shows no crash; test in Task 10.
5. Correcting a K.O. result after the follow-up match was started → refused; before it was started → winner swap propagates into the follow-up match; test in Task 8.

---

### Task 1: Project scaffold, domain types, seeded RNG

**Files:**
- Create: project via Vite template, `.gitignore`, `src/domain/types.ts`, `src/domain/rng.ts`
- Test: `src/domain/rng.test.ts`

**Interfaces:**
- Produces (`types.ts`, exact):

```ts
export type PlayerId = string;
export interface Player { id: PlayerId; name: string; withdrawnAt?: number }
export type Mode =
  | { kind: 'groupsKo'; groups: number; placementGames: boolean; thirdPlace: boolean; koFieldSize?: 4 | 8 | 16 }
  | { kind: 'roundRobin'; finalTopTwo: boolean }
  | { kind: 'singleKo'; thirdPlace: boolean }
  | { kind: 'doubleKo' };
export interface Settings { name: string; date: string /* YYYY-MM-DD */; boards: number;
  legs: { group: number; ko: number; final: number }; mode: Mode }
export type Slot =
  | { kind: 'player'; id: PlayerId }
  | { kind: 'winnerOf'; matchId: string }
  | { kind: 'loserOf'; matchId: string }
  | { kind: 'bye' };
export interface PlayerStats { s180: number; highScore?: number; highFinish?: number; shortLeg?: number }
export type Result = { kind: 'legs'; a: number; b: number } | { kind: 'walkover'; winner: 'a' | 'b' };
export type Bracket = 'group' | 'main' | 'placement' | 'winners' | 'losers' | 'final';
export interface Match {
  id: string; bracket: Bracket; groupId?: string; round: number; order: number; label: string;
  a: Slot; b: Slot; legsToWin: number;
  status: 'open' | 'running' | 'done' | 'void';
  board?: number; startedAt?: number; finishedAt?: number;
  result?: Result; stats?: { a?: PlayerStats; b?: PlayerStats };
  winnerPlace?: number; loserPlace?: number; loserPlaceTo?: number;
}
export interface Group { id: string; name: string; playerIds: PlayerId[] }
export type Phase = 'setup' | 'groups' | 'tiebreak' | 'ko' | 'done';
export interface PlaceEntry { playerId: PlayerId; place: number; placeTo?: number }
export interface Tournament {
  version: 1; seed: number; settings: Settings; players: Player[]; groups: Group[];
  matches: Match[]; phase: Phase;
  tieOrder: Record<string, PlayerId[]>;   // key = TieBlock.key, value = manual order (Stechen)
  fixedPlaces: PlaceEntry[];              // places assigned without a match (non-qualifiers, lone player)
}
```

- Produces (`rng.ts`): `createRng(seed: number): () => number` (mulberry32, values in [0,1)), `shuffle<T>(items: readonly T[], rng: () => number): T[]` (Fisher–Yates, returns copy).

- [ ] **Step 1: Scaffold.** `npm create vite@5 . -- --template react-ts`, `npm i`, `npm i -D vitest@2`, add `"test": "vitest run"` to `package.json`, set `base: './'` in `vite.config.ts`, add `.superpowers/` and `node_modules/` and `dist/` to `.gitignore`, `git init -b main`.
- [ ] **Step 2: Write failing tests** in `rng.test.ts`: `createRng(42)` called twice yields identical first 5 values; `shuffle([1..10], createRng(1))` is a permutation of the input, differs from `createRng(2)` result, and leaves the input array unchanged.
- [ ] **Step 3: Run** `npm test` → FAIL (module not found).
- [ ] **Step 4: Implement** `types.ts` (verbatim above) and `rng.ts`.
- [ ] **Step 5: Run** `npm test` → PASS; `npx tsc --noEmit` → no errors.
- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: scaffold vite react-ts, domain types, seeded rng"` (include `docs/`).

---

### Task 2: Group draw and round-robin pairings

**Files:**
- Create: `src/domain/groups.ts`, `src/domain/roundRobin.ts`
- Test: `src/domain/groups.test.ts`, `src/domain/roundRobin.test.ts`

**Interfaces:**
- Consumes: `shuffle`, `createRng`, types.
- Produces:
  - `drawGroups(playerIds: PlayerId[], groupCount: number, rng: () => number): Group[]` — shuffle, then deal one by one into groups; ids `g1..gN`; names `"Liga A"`, `"Liga B"` when `groupCount === 2`, else `"Gruppe A"`, `"Gruppe B"`, ….
  - `roundRobinMatches(group: { id: string; playerIds: PlayerId[] }, legsToWin: number, idPrefix: string): Match[]` — circle method (dummy bye when odd, bye pairings omitted), `bracket: 'group'`, `round` = circle round (1-based), `label: ''` (the caller sets `"<Gruppenname> · Runde r"`).
  - `interleave(groupsMatches: Match[][]): Match[]` — assigns `order` so groups alternate within each round.

- [ ] **Step 1: Write failing tests:**
  - `drawGroups` with 13 ids, 2 groups → sizes `[7, 6]`; union equals input; same seed → same result.
  - `drawGroups` with 10 ids, 3 groups → sizes differ by at most 1.
  - `roundRobinMatches` for 5 players → 10 matches, every unordered pair exactly once, no player twice in one round, rounds 1..5.
  - for 6 players → 15 matches, rounds 1..5, each player exactly once per round.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** the three functions.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(domain): group draw and round-robin pairings`.

---

### Task 3: Standings with tiebreaks

**Files:**
- Create: `src/domain/standings.ts`
- Test: `src/domain/standings.test.ts`

**Interfaces:**
- Consumes: `Match`, `PlayerId`.
- Produces:

```ts
export interface StandingRow { playerId: PlayerId; played: number; won: number; lost: number;
  legsFor: number; legsAgainst: number; legDiff: number; points: number;
  rank: number;            // equal for unresolved ties
  tieKey?: string;         // set when rank is shared after all criteria and no manual order
  withdrawn: boolean }
export function computeStandings(playerIds: PlayerId[], matches: Match[],
  withdrawn: ReadonlySet<PlayerId>, tieOrder: Record<string, PlayerId[]>, keyPrefix: string): StandingRow[];
export function tieKeyFor(keyPrefix: string, ids: PlayerId[]): string; // `${keyPrefix}:${[...ids].sort().join(',')}`
```

Only matches with `status === 'done'` and `result.kind === 'legs'` count. Withdrawn players are sorted after all others (among themselves by the same criteria, rank shared, never a `tieKey`). Algorithm for a block of equal (points, legDiff, legsFor): compute the mini-table over matches between block members only; split by mini (points, legDiff, legsFor); if the split produced more than one sub-block, recurse on each sub-block of size > 1 (mini-table restricted to that sub-block); if no split, apply `tieOrder[tieKeyFor(prefix, block)]` when present, otherwise mark the block with that `tieKey` and a shared rank.

- [ ] **Step 1: Write failing tests:**
  - Points: win = 2, loss = 0; legDiff = legsFor − legsAgainst.
  - Two players equal on points, different legDiff → higher legDiff first.
  - Equal points and legDiff, different legsFor → higher legsFor first.
  - Equal on 1–3, A beat B directly → A first.
  - Three-way tie where the mini-table separates C on top but A/B are still equal in the mini-table and A beat B → order C, A, B (recursive restart).
  - Perfect three-way cycle (A>B, B>C, C>A, all 3:1) → all three share a rank with the same `tieKey`; after `tieOrder[tieKey] = [B, C, A]` → ranks 1,2,3 in that order.
  - Withdrawn player with 2 wins still sorted below a player with 0 wins.
  - `void` and `open` matches are ignored.
- [ ] **Step 2: Run** `npm test -- standings` → FAIL.
- [ ] **Step 3: Implement** `computeStandings`, `tieKeyFor`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): standings with recursive head-to-head`.

---

### Task 4: Slot engine and single-elimination bracket builder

**Files:**
- Create: `src/domain/resolve.ts`, `src/domain/bracket.ts`
- Test: `src/domain/resolve.test.ts`, `src/domain/bracket.test.ts`

**Interfaces:**
- Consumes: types.
- Produces (`resolve.ts`):
  - `resolveSlot(matches: Match[], slot: Slot): PlayerId | 'bye' | null` — `null` = not yet decided. Winner/loser of a done match whose result is a walkover against a bye resolves to the player / `'bye'`; both sides bye → winner and loser are `'bye'`.
  - `winnerSide(m: Match): 'a' | 'b' | null`.
  - `autoAdvance(matches: Match[], withdrawn: ReadonlySet<PlayerId>, now: number): Match[]` — repeat until no change: an `open` match whose both slots are resolved and one side is `'bye'` or a withdrawn player becomes `done` with `{ kind: 'walkover', winner }` (winner = the non-bye/non-withdrawn side; both bye or both withdrawn → winner `'a'`), `finishedAt = now`, no board.
  - `isPlayable(matches: Match[], m: Match): boolean` — `open` and both slots resolve to real players.
- Produces (`bracket.ts`):
  - `nextPow2(n: number): number`
  - `standardSeedOrder(size: number): number[]` — 0-based seed indexes in bracket position order (size 8 → `[0,7,3,4,1,6,2,5]`).
  - `byeSeeding(entries: Slot[], size: number): Slot[]` — treats `entries` as seeds 0..n−1, pads seeds n..size−1 with `{kind:'bye'}`, returns them in `standardSeedOrder` positions; this guarantees no bye–bye pair and spreads byes over both halves.
  - `buildSingleElim(entries: Slot[], opts: { idPrefix: string; legsKo: number; legsFinal: number; thirdPlace: boolean; placementGames: boolean; firstPlace: number }): Match[]` — `entries.length` is a power of two, already in bracket position order (pair i = entries[2i], entries[2i+1]); adjacent winners meet next round; final uses `legsFinal`, everything else `legsKo`. Final: `winnerPlace = firstPlace`, `loserPlace = firstPlace + 1`. Losers of a round with `n` matches (rounds before the semifinal): when `placementGames` → feed `placementBracket` with start place `firstPlace + n`; else shared `loserPlace = firstPlace + n`, `loserPlaceTo = firstPlace + 2n − 1`. Semifinal losers: `thirdPlace` true → one match for `firstPlace + 2`/`+3` (even when `placementGames` is false); false → shared `firstPlace + 2` to `firstPlace + 3`.
  - `placementBracket(slots: Slot[], startPlace: number, legs: number, idPrefix: string): Match[]` — `slots.length` power of two; 2 slots → one match (winner start, loser start+1); more → pair adjacent (i, i+1), winners recurse at `startPlace`, losers at `startPlace + slots.length/2`. `bracket: 'placement'`.
  - Labels (German, exact): `"Viertelfinale 1"`, `"Halbfinale 1"`, `"Finale"`, `"Spiel um Platz 3"`, `"Spiel um Platz 5"`, `"Platzierung 5–8"`, `"Runde 1"` for rounds before the Viertelfinale.

- [ ] **Step 1: Write failing tests:**
  - `standardSeedOrder(8)` = `[0,7,3,4,1,6,2,5]`; `standardSeedOrder(4)` = `[0,3,1,2]`.
  - `byeSeeding` of 5 players to 8 → 3 byes, no bye–bye pair, byes in both halves.
  - `buildSingleElim` 8 entries, thirdPlace true, placementGames false → 4 QF + 2 SF + final + 3rd place = 8 matches; QF loser range 5–8; final legs = `legsFinal`.
  - Same with `placementGames: true` → plus placement matches for 5–8 (2 + 2 = 4) → 12 matches; winners of QF1-loser vs QF2-loser and QF3-loser vs QF4-loser meet for place 5, losers for place 7.
  - `autoAdvance` on a 5-player bracket: 3 first-round matches become `done` walkovers; their winners resolve in round 2.
  - Withdrawn player in a playable K.O. match → after `autoAdvance` opponent wins by walkover; loser still gets that match's `loserPlace`.
  - `resolveSlot` of `winnerOf` an unfinished match → `null`.
- [ ] **Step 2: Run** `npm test -- bracket resolve` → FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): slot engine and single-elimination builder`.

---

### Task 5: Club mode (2 Ligen) K.O. and placement generation

**Files:**
- Create: `src/domain/clubKo.ts`
- Test: `src/domain/clubKo.test.ts`

**Interfaces:**
- Consumes: `buildSingleElim`, `placementBracket`, types.
- Produces: `buildClubKo(rankA: PlayerId[], rankB: PlayerId[], opts: { legsKo: number; legsFinal: number; placementGames: boolean; thirdPlace: boolean }): { matches: Match[]; fixedPlaces: PlaceEntry[] }` — `rankA`/`rankB` = final league order, withdrawn players already removed.
  - `q = (rankA.length >= 6 && rankB.length >= 6) ? 4 : 2`.
  - q = 4: entries in order `[A1,B4, B2,A3, B1,A4, A2,B3]` → `buildSingleElim` with `firstPlace 1`; VF loser games per `placementGames` (spec §8.1).
  - q = 2: entries `[A1,B2, B1,A2]`.
  - Remaining: for r = q+1 … max(len): if both A_r and B_r exist → one match `"Spiel um Platz p"`, `p = 2q + 1 + 2(r − q − 1)`, `winnerPlace p`, `loserPlace p+1`, legs = `legsKo`, `bracket: 'placement'`; lone player → `fixedPlaces` with the next place. When `placementGames` false → no remaining matches; A_r and B_r share `p` to `p+1` in `fixedPlaces` (lone player gets `p` alone).
  - Withdrawn players get shared last places in `fixedPlaces`, added by the caller (Task 8), not here.

- [ ] **Step 1: Write failing tests:**
  - 7 + 6 players, placement on: VF pairings exactly A1–B4, B2–A3, B1–A4, A2–B3; HF1 = winners VF1/VF2; A5–B5 for 9, A6–B6 for 11, A7 fixed place 13; places 1..13 appear once each after simulating all matches (helper: every match won by side a).
  - 5 + 6 players → semifinal variant A1–B2, B1–A2; A3–B3 for 5, A4–B4 for 7, A5–B5 for 9; B6 fixed 11.
  - 6 + 6, placement off → no "Spiel um Platz 5"/"9" matches; VF losers share 5–8; A5/B5 share 9–10.
  - 2 + 2 → only semis, final, 3rd place.
- [ ] **Step 2: Run** `npm test -- clubKo` → FAIL.
- [ ] **Step 3: Implement** `buildClubKo`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): club mode knockout and placement games`.

---

### Task 6: Multi-group (> 2) qualification and seeding

**Files:**
- Create: `src/domain/multiGroupKo.ts`
- Test: `src/domain/multiGroupKo.test.ts`

**Interfaces:**
- Consumes: `StandingRow`, `tieKeyFor`, `buildSingleElim`, `standardSeedOrder`.
- Produces:
  - `koFieldOptions(groupSizes: number[]): (4 | 8 | 16)[]` — cap `c = ceil(min(groupSizes)/2)`; F valid if `groups ≤ F ≤ c·groups`; descending. Empty → mode invalid.
  - `qualify(groups: { id: string; rows: StandingRow[] }[], field: 4 | 8 | 16, fillerOrder?: PlayerId[]): { seeds: { playerId: PlayerId; groupId: string; groupRank: number }[]; fillerTieKey?: string; eliminated: { playerId: PlayerId; groupRank: number }[] }` — `k = floor(field / groups)` direct per group (withdrawn rows skipped); fillers = best of rank k+1 across groups, compared by points per game, then legDiff per game, then legsFor per game; unresolved equality across the cut → `fillerTieKey = tieKeyFor('fillers', ids)` unless `fillerOrder` resolves it. Seeds ordered: all rank 1 (cross-group compared the same way), then rank 2, …, fillers last.
  - `seedEntries(seeds, field): Slot[]` — place seeds by `standardSeedOrder`, then repair: for each first-round pair with both players from the same group, swap the lower-seeded player with the nearest lower seed of the same pot (same `groupRank`) from a different group.
  - `nonQualifierPlaces(eliminated, field): PlaceEntry[]` — shared places by group rank: all eliminated with the same group rank share a range starting at `field + 1`; ranges consecutive.

- [ ] **Step 1: Write failing tests:**
  - `koFieldOptions([4,4,4])` = `[4]`; `koFieldOptions([5,5,5,5])` = `[8,4]`; `koFieldOptions([2,2,2,2,2,2,2,2])` = `[8]`.
  - 3 groups × 4, field 4 → 3 group winners + best second; filler tie between two seconds with identical per-game values → `fillerTieKey` set.
  - Property over configs (3×4 field 4, 4×5 field 8, 8×4 field 16, 5×6 field 8): no first-round pair from the same group; for field 8 with 4 groups, each group's rank 1 and rank 2 are in opposite halves.
  - `nonQualifierPlaces` for 4×5 field 8: all four 3rd-placed share 9–12, all 4th share 13–16, all 5th 17–20.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): multi-group qualification and seeding`.

---

### Task 7: Double elimination builder

**Files:**
- Create: `src/domain/doubleElim.ts`
- Test: `src/domain/doubleElim.test.ts`

**Interfaces:**
- Consumes: `byeSeeding`, `standardSeedOrder`, `resolveSlot`, `autoAdvance`.
- Produces: `buildDoubleElim(entries: Slot[], opts: { legsKo: number; legsFinal: number }): Match[]` — `entries` power of two, size N = 2^k ≥ 4. Winners bracket (`bracket: 'winners'`) like single elim without third place. Losers bracket (`'losers'`) has 2(k−1) rounds: LB round 1 pairs WB round 1 losers adjacently; every even LB round pairs the previous LB winners with the losers of the next WB round in **reversed** order (avoids immediate rematches); odd LB rounds > 1 pair LB winners adjacently. Grand final (`'final'`, `"Finale"`, `legsFinal`): WB winner vs LB winner, one match, no reset. Places: final 1/2; LB last-round loser 3; an earlier LB round's losers share the range directly below the later rounds' places (N=8: 4, 5–6, 7–8). Bye sides propagate through `autoAdvance` (a bye "loser" in LB makes its opponent advance).

- [ ] **Step 1: Write failing tests:**
  - N = 8: 7 WB + 6 LB + 1 final = 14 matches; places after simulating "side a always wins": 1, 2, 3, 4, 5–6 ×2, 7–8 ×2.
  - N = 8 with 5 players (3 byes): after `autoAdvance` with all real matches won by side a, every real player has exactly one place, no player appears in two open matches, no `open` match has both sides resolved to `'bye'`.
  - 6 players: same invariants.
  - A player is eliminated only after his second loss (losses per player across the simulation ≤ 2; champion may have 0).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): double elimination`.

---

### Task 8: Tournament lifecycle

**Files:**
- Create: `src/domain/tournament.ts`, `src/domain/validate.ts`
- Test: `src/domain/tournament.test.ts`, `src/domain/validate.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces (`validate.ts`):
  - `parseNames(text: string, existing: string[]): { names: string[]; errors: string[] }` — split on newlines, trim, drop empty; duplicate (case-insensitive, also against `existing`) → error `Doppelter Name: "<name>"`.
  - `minPlayers(mode: Mode): number` — groupsKo 2 groups: 4; groupsKo n>2: 2n; roundRobin 3; singleKo 3; doubleKo 4.
  - `validateSetup(settings: Settings, playerCount: number): string[]` — German messages; covers min players (message suggests "Jeder gegen jeden"), boards ≥ 1, legs ≥ 1, and groupsKo n>2 with empty `koFieldOptions`.
  - `isValidLegs(r: { a: number; b: number }, legsToWin: number): boolean` — integers 0..N, exactly one equals N.
  - `validateStats(s: PlayerStats): string[]` — ranges from Global Constraints.
- Produces (`tournament.ts`), all pure, each returns a new `Tournament` and throws `Error` with a German message on invalid calls:
  - `createTournament(settings: Settings, names: string[], seed: number): Tournament` — phase `setup`, players with ids `p1..pn`, groups drawn via `rng` (groupsKo; roundRobin = one group named "Tabelle"), or bracket entry order shuffled (KO modes, stored as a single group `"Teilnehmer"` in drawn order).
  - `redraw(t, seed)`, `swapPlayers(t, a: PlayerId, b: PlayerId)` — only in `setup`.
  - `start(t, now)` — groupsKo/roundRobin: create group matches (labels like `"Liga A · Runde 1"`), phase `groups`; singleKo/doubleKo: build bracket with `byeSeeding` + `autoAdvance`, phase `ko`.
  - `startMatch(t, matchId, board, now)` — requires `isPlayable`, a free board, and neither player in a running match.
  - `cancelMatch(t, matchId)` — running → open, board cleared.
  - `recordResult(t, matchId, result: Result, stats, now)` — validates legs, sets `done`, frees board, runs `autoAdvance`, then phase transition: all group matches done/void → `tiebreak` if `pendingTies(t)` non-empty, else stays `groups` with the K.O. ready (UI calls `startKo`); roundRobin without final and no pending tie → `done`; all K.O. matches done → `done`.
  - `canEditResult(t, matchId): boolean` — group match: phase is `groups` or `tiebreak`; K.O. match: no match referencing it via `winnerOf`/`loserOf` is `running`, or `done` with a legs result (auto-walkovers that depend on it are recomputed).
  - `editResult(t, matchId, result, stats, now)` — requires `canEditResult`.
  - `withdrawPlayer(t, playerId, now)` — sets `withdrawnAt`; group phase: his `open` and `running` group matches → `void` (board freed); K.O. phase: his `running` match → walkover for the opponent (board freed), then `autoAdvance`.
  - `pendingTies(t): { key: string; playerIds: PlayerId[]; label: string }[]` — relevant ranks: club with placement games → all; club without → ranks 1..q+1; multi-group → ranks 1..k+1 plus `fillerTieKey`; roundRobin → rank 1 (ranks 1..3 if `finalTopTwo`); excludes keys already in `tieOrder`.
  - `setTieOrder(t, key, order: PlayerId[])` — stores it, re-evaluates the phase.
  - `startKo(t)` — requires all group matches done/void and no pending ties; groupsKo 2 → `buildClubKo`; n>2 → `qualify` + `seedEntries` + `buildSingleElim` (`placementGames` from mode, `firstPlace 1`) + `nonQualifierPlaces`; roundRobin with `finalTopTwo` → one final match (1st vs 2nd, `legsFinal`), others placed by standings; withdrawn players appended to `fixedPlaces` sharing the last places. Phase `ko`.
  - `computePlacements(t): PlaceEntry[]` — from `winnerPlace`/`loserPlace`/`loserPlaceTo` of done matches plus `fixedPlaces`; roundRobin without final → from standings (shared ranks → shared places); sorted by place; byes excluded.

- [ ] **Step 1: Write failing tests** (`validate.test.ts`): `parseNames("Anna\n\n  Bernd \nanna", [])` → names `["Anna","Bernd"]`, one error containing `anna`; `isValidLegs({a:3,b:1},3)` true, `{a:3,b:3}` false, `{a:2,b:1}` false, `{a:4,b:0}` false; `validateStats({s180:0, highFinish:171})` → one error; `minPlayers` values above.
- [ ] **Step 2: Write failing tests** (`tournament.test.ts`), each with seed 7 and an incrementing `now`:
  - Club evening, 13 players, end to end: create → start → record all group results (side a wins 3:0) → if `tiebreak`, resolve via `setTieOrder` → `startKo` → record all → phase `done`; `computePlacements` gives places 1..13 exactly once.
  - Withdrawal in the group phase while his match is running → that match `void`, board free; he is not among the K.O. participants; he gets the last place.
  - Withdrawal in the K.O. while his match is running → opponent wins by walkover, board free.
  - K.O. `canEditResult`: after QF1 done and HF1 not started → true, and editing flips the HF1 participant; after HF1 started → false.
  - Editing a group result recomputes standings (rank changes after 3:0 is edited to 0:3).
  - `startMatch` refuses a second match for a player who is already running, and refuses an occupied board.
  - Single K.O., 5 players, thirdPlace on → reaches `done` with places 1, 2, 3, 4, and 5–8 for the one QF loser.
  - roundRobin, 4 players, perfect points tie for 1st → phase `tiebreak`; after `setTieOrder` → `done`.
- [ ] **Step 3: Run** `npm test -- tournament validate` → FAIL.
- [ ] **Step 4: Implement** both files.
- [ ] **Step 5: Run** `npm test` → all PASS.
- [ ] **Step 6: Commit** `feat(domain): tournament lifecycle, validation, withdrawals`.

---

### Task 9: Board suggestion

**Files:**
- Create: `src/domain/scheduler.ts`
- Test: `src/domain/scheduler.test.ts`

**Interfaces:**
- Consumes: `isPlayable`, `resolveSlot`, `Tournament`.
- Produces:
  - `freeBoards(t): number[]` — 1..`settings.boards` without a running match.
  - `lastFinished(t, playerId): number` — latest `finishedAt` of his done matches with a legs result; none → `-Infinity`.
  - `queue(t): Match[]` — playable matches whose players are not in a running match. Phase `groups`: sorted by `max(lastFinished(a), lastFinished(b))` ascending, then `round`, then `order`. Phase `ko`: `round` first (main and placement mixed), then the pause key, then `order`.
  - `suggestNext(t): Match | null` — `queue(t)[0] ?? null`.

- [ ] **Step 1: Write failing tests:** a player who just finished is not in the first suggestion when another match with rested players exists; a player currently running is never in `queue`; with boards 1–3 running, `freeBoards` = `[4]`; empty queue → `suggestNext` null; in the K.O. phase round 1 comes before round 2 even if the round-2 players have rested longer.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): board suggestions`.

---

### Task 10: Persistence and app state hook

**Files:**
- Create: `src/state/persist.ts`, `src/state/useTournament.ts`
- Test: `src/state/persist.test.ts`

**Interfaces:**
- Produces:
  - `STORAGE_KEY = 'dartplaner.v1'`
  - `loadTournament(storage?: Storage): Tournament | null` — null on missing key, parse error, `version !== 1`, or a throwing storage.
  - `saveTournament(t: Tournament, storage?: Storage): boolean` — false when storage throws.
  - `clearTournament(storage?: Storage): void`
  - `useTournament(): { t: Tournament | null; dispatch: (a: Action) => void; persistOk: boolean; lastError: string | null }` — `useReducer` over an `Action` union mirroring the Task 8 functions (`create`, `redraw`, `swap`, `start`, `startMatch`, `cancelMatch`, `record`, `edit`, `withdraw`, `setTieOrder`, `startKo`, `reset`). The reducer catches domain errors, keeps the old state, and sets `lastError`. It saves after every change. When `persistOk` is false, the UI shows "Speichern im Browser nicht möglich – bitte Seite nicht neu laden".
- `now` comes from `Date.now()` in the reducer; the seed comes from `Date.now()` in `create`/`redraw`.

- [ ] **Step 1: Write failing tests** with a fake `Storage` object: save→load roundtrip equals the input (club tournament mid-group with a running match on board 2); corrupt JSON → null; a storage whose `setItem` throws → `saveTournament` returns false; `getItem` throws → `loadTournament` null.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(state): localStorage persistence and reducer hook`.

---

### Task 11: Excel export and highlights

**Files:**
- Create: `src/export/highlights.ts`, `src/export/xlsx.ts`
- Test: `src/export/highlights.test.ts`, `src/export/xlsx.test.ts`

**Interfaces:**
- Install: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- Produces:
  - `playerHighlights(t): { playerId: PlayerId; name: string; s180: number; highScore?: number; highFinish?: number; shortLeg?: number }[]` — sum of 180s, max highScore, max highFinish, min shortLeg.
  - `eveningHighlights(t): { most180?: { names: string; value: number }; highScore?: { names: string; value: number }; highFinish?: { names: string; value: number }; shortLeg?: { names: string; value: number } }` — ties: names joined with `", "`.
  - `buildWorkbook(t): XLSX.WorkBook` — sheets exactly `"Spiele"`, `"Tabellen"`, `"Platzierung"`, `"Highlights"`; columns per spec §9; walkover rows show `"kampflos"` in the legs columns; void matches omitted.
  - `exportFileName(t): string` — `<name>_<YYYY-MM-DD>.xlsx`, characters `\/:*?"<>|` replaced by `_`.
  - `downloadXlsx(t): void` — `XLSX.writeFile(buildWorkbook(t), exportFileName(t))`.

- [ ] **Step 1: Write failing tests:** highlights aggregation over two matches; `buildWorkbook` sheet names; "Spiele" header row; a walkover row contains `kampflos`; `exportFileName` for name `Turnier 11/24` on 2026-11-24 → `Turnier 11_24_2026-11-24.xlsx`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(export): xlsx export and highlights`.

---

### Task 12: Visual design system and setup screen

**Files:**
- Create: `src/ui/theme.css`, `src/ui/App.tsx`, `src/ui/SetupScreen.tsx`
- Modify: `src/main.tsx` (render `src/ui/App.tsx`, import `theme.css`)
- Delete: Vite template demo files (`src/App.tsx`, `src/App.css`, `src/index.css`, `src/assets/react.svg`)

**Interfaces:**
- Consumes: `useTournament`, `parseNames`, `validateSetup`, `minPlayers`, `koFieldOptions`.
- Produces: `App` switches on `t?.phase`: null or `setup` → `SetupScreen`; otherwise `TournamentShell` (Task 13). CSS custom properties in `theme.css` are used by all later UI.

- [ ] **Step 1: Run the skill `/ui-ux-pro-max:design`** with this brief: "Turnierverwaltung für einen Dartverein, Bedienung durch eine Person am Laptop/Tablet im Vereinsheim, große Touch-Ziele, gut lesbar aus 1–2 m, deutsch, Hauptbildschirm Board-Kacheln (Variante A aus `.superpowers/brainstorm/*/content/live-ansicht.html`)". Put the resulting tokens (colors light/dark, type scale, spacing, radius) into `theme.css`.
- [ ] **Step 2: Implement `SetupScreen`** — fields per spec §6.1: name; date defaulting to today; names textarea with live `parseNames` errors and player count; mode picker with mode-specific options; legs group/ko/final; boards. "Auslosen" → `create`. Draw preview with "Neu auslosen" and tap-two-to-swap. "Turnier starten" is disabled while `validateSetup` returns errors, and the errors are listed.
- [ ] **Step 3: Verify:** `npm run dev`, create a 13-player club tournament, redraw, swap two players, start; `npx tsc --noEmit` clean; `npm test` still PASS.
- [ ] **Step 4: Commit** `feat(ui): design tokens and setup screen`.

---

### Task 13: Board view and result dialog

**Files:**
- Create: `src/ui/TournamentShell.tsx`, `src/ui/BoardsView.tsx`, `src/ui/ResultDialog.tsx`

**Interfaces:**
- Consumes: `freeBoards`, `queue`, `suggestNext`, `isValidLegs`, `validateStats`, `canEditResult`, `pendingTies`, `useTournament`.
- Produces: `TournamentShell` with tabs **Boards · Tabellen · K.O. · Export** (K.O. tab hidden for roundRobin without final). The header shows the tournament name, the `persistOk` warning and `lastError`, plus a menu with "Spieler abmelden" (confirm dialog) and "Neues Turnier" (confirm dialog → `reset`). `ResultDialog` props: `{ match: Match; t: Tournament; mode: 'new' | 'edit'; onSave(result: Result, stats): void; onClose(): void }`.

- [ ] **Step 1: Implement `BoardsView`** per mockup A. Each board gets a tile: running (players, label, "first to N", "Ergebnis eintragen", "Abbrechen") or free (suggestion + "Spiel starten"; "Anderes Spiel" opens a queue picker). Below the tiles: the "Als Nächstes" list (`queue`) with "Ohne Board eintragen". In phase `tiebreak`: banner "Stechen nötig" listing `pendingTies` with tap-to-order → `setTieOrder`. When the group phase is complete and no ties are pending: button "K.O.-Runde starten" → `startKo`.
- [ ] **Step 2: Implement `ResultDialog`** — tap buttons 0..N per player; save disabled until `isValidLegs`; save label `"Speichern · 3:1 für <Name>"`; collapsible "Statistik (optional)" with 180er/Highscore/Highfinish/Shortleg number inputs and inline `validateStats` errors. The same dialog handles edit mode, opened from Tabellen/K.O. on done matches when `canEditResult`.
- [ ] **Step 3: Verify** in the browser: run a 13-player club evening with 4 boards to the end, reload midway (state intact), withdraw a player while his match runs, correct one group result.
- [ ] **Step 4: Commit** `feat(ui): board view and result entry`.

---

### Task 14: Tables, K.O. tree, export and print view

**Files:**
- Create: `src/ui/TablesView.tsx`, `src/ui/KoView.tsx`, `src/ui/ExportView.tsx`, `src/ui/PrintView.tsx`, `src/ui/print.css`

**Interfaces:**
- Consumes: `computeStandings`, `computePlacements`, `eveningHighlights`, `downloadXlsx`, `resolveSlot`, `canEditResult`.

- [ ] **Step 1: `TablesView`** — one table per group, columns per spec §7; withdrawn players marked "abgemeldet"; shared ranks shown once; list of done matches with an edit entry.
- [ ] **Step 2: `KoView`** — main bracket as columns per round; placement and losers-bracket matches listed under their own headings with their place labels; tapping a done match opens edit if `canEditResult`.
- [ ] **Step 3: `ExportView`** — "Als PDF drucken / speichern" (`window.print()`) and "Excel herunterladen" (`downloadXlsx`); both always available, labelled "vorläufig" until phase `done`.
- [ ] **Step 4: `PrintView` + `print.css`** — shown only under `@media print` (screen UI hidden): A4, name + date, final placement large, K.O. tree, final group tables, evening highlights.
- [ ] **Step 5: Verify** in the browser print preview: fits A4 portrait for 13 players; the Excel file opens with four sheets.
- [ ] **Step 6: Commit** `feat(ui): tables, bracket, export and print layout`.

---

### Task 15: Unslop review and static build

**Files:**
- Modify: UI files as findings require
- Create: `README.md` (German: what it is, `npm i`, `npm run dev`, `npm run build`, deploy by uploading `dist/` to Netlify Drop or GitHub Pages)

- [ ] **Step 1: Run the skill `/unslop-anything`** (review, then treat) on `src/ui/`; apply fixes that do not change behavior.
- [ ] **Step 2: Run** `npm test` → PASS; `npx tsc --noEmit` clean; `npm run build` → `dist/` produced; `npx vite preview`: setup → start → one result works from the built files.
- [ ] **Step 3: Commit** `chore: unslop pass, readme, production build`.
