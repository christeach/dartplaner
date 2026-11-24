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
