import { useEffect, useReducer, useState } from 'react';
import * as D from '../domain/tournament';
import type { Match, PlayerId, Result, Settings, Tournament } from '../domain/types';
import { clearTournament, loadTournament, saveTournament, STORAGE_KEY } from './persist';

type Stats = Match['stats'];

export type Action =
  | { type: 'create'; settings: Settings; names: string[] }
  | { type: 'redraw' }
  | { type: 'swap'; a: PlayerId; b: PlayerId }
  | { type: 'start' }
  | { type: 'startMatch'; matchId: string; board: number }
  | { type: 'cancelMatch'; matchId: string }
  | { type: 'record'; matchId: string; result: Result; stats: Stats }
  | { type: 'edit'; matchId: string; result: Result; stats: Stats }
  | { type: 'editStats'; matchId: string; stats: Stats }
  | { type: 'withdraw'; playerId: PlayerId }
  | { type: 'setTieOrder'; key: string; order: PlayerId[] }
  | { type: 'clearTieOrder'; key: string }
  | { type: 'startKo' }
  | { type: 'reset' }
  | { type: 'load'; t: Tournament | null };

// loadFailed: the stored tournament was unreadable; storage stays untouched until a new tournament or a reset
export interface State { t: Tournament | null; lastError: string | null; loadFailed: boolean }

const need = (t: Tournament | null): Tournament => {
  if (!t) throw new Error('Kein Turnier vorhanden.');
  return t;
};

function apply(t: Tournament | null, a: Action): Tournament | null {
  const now = Date.now();
  switch (a.type) {
    case 'create': return D.createTournament(a.settings, a.names, now);
    case 'redraw': return D.redraw(need(t), now);
    case 'swap': return D.swapPlayers(need(t), a.a, a.b);
    case 'start': return D.start(need(t), now);
    case 'startMatch': return D.startMatch(need(t), a.matchId, a.board, now);
    case 'cancelMatch': return D.cancelMatch(need(t), a.matchId);
    case 'record': return D.recordResult(need(t), a.matchId, a.result, a.stats, now);
    case 'edit': return D.editResult(need(t), a.matchId, a.result, a.stats, now);
    case 'editStats': return D.editStats(need(t), a.matchId, a.stats);
    case 'withdraw': return D.withdrawPlayer(need(t), a.playerId, now);
    case 'setTieOrder': return D.setTieOrder(need(t), a.key, a.order);
    case 'clearTieOrder': return D.clearTieOrder(need(t), a.key);
    case 'startKo': return D.startKo(need(t));
    case 'reset': return null;
    case 'load': return a.t;
  }
}

export function tournamentReducer(state: State, action: Action): State {
  try {
    const t = apply(state.t, action);
    return { t, lastError: null, loadFailed: state.loadFailed && t === null && action.type !== 'reset' };
  } catch (e) {
    return { ...state, lastError: e instanceof Error ? e.message : String(e) };
  }
}

export function useTournament() {
  const [state, dispatch] = useReducer(tournamentReducer, undefined, (): State => {
    const { t, failed } = loadTournament();
    return { t, lastError: null, loadFailed: failed };
  });
  const [persistOk, setPersistOk] = useState(true);
  useEffect(() => {
    if (state.t) setPersistOk(saveTournament(state.t));
    else if (!state.loadFailed) { clearTournament(); setPersistOk(true); }
  }, [state.t, state.loadFailed]);
  // another tab changed the tournament: follow it (writing the same value back fires no further event)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      const { t, failed } = loadTournament();
      if (!failed) dispatch({ type: 'load', t });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return { t: state.t, dispatch, persistOk, lastError: state.lastError, loadFailed: state.loadFailed };
}
