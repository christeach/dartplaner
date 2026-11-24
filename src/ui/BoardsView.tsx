import { useState } from 'react';
import { queue } from '../domain/scheduler';
import { canEditResult, pendingTies, type PendingTie } from '../domain/tournament';
import type { Match, PlayerId, Result, Tournament } from '../domain/types';
import type { Action } from '../state/useTournament';
import { boardSuggestions, canStartKo } from './liveForm';
import { Modal } from './Modal';
import { ResultDialog } from './ResultDialog';
import { playerName } from './viewModel';

interface Props { t: Tournament; dispatch: (a: Action) => void; onEdit(matchId: string): void }

const RECENT = 5;
const NEXT = 8;

export function BoardsView({ t, dispatch, onEdit }: Props) {
  const [entering, setEntering] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const suggestions = boardSuggestions(t);
  const q = queue(t);
  const ties = t.phase === 'tiebreak' ? pendingTies(t) : [];
  const koReady = canStartKo(t);
  const vs = (m: Match) => <><b>{playerName(t, m, 'a')}</b> <span className="vs">vs</span> <b>{playerName(t, m, 'b')}</b></>;
  const recent = t.matches.filter((m) => m.status === 'done' && m.result?.kind === 'legs')
    .sort((x, y) => (y.finishedAt ?? 0) - (x.finishedAt ?? 0)).slice(0, RECENT);
  const entered = entering ? t.matches.find((m) => m.id === entering) : undefined;
  const start = (matchId: string, board: number) => dispatch({ type: 'startMatch', matchId, board });

  return (
    <div className="stack">
      {ties.length > 0 && (
        <section className="banner" aria-labelledby="ties-h">
          <h2 id="ties-h">Stechen nötig</h2>
          <p>Diese Spieler sind nach allen Kriterien gleich. Spielt die Reihenfolge aus (z. B. Bull-Off) und tippt die Spieler in der Reihenfolge an, beginnend mit dem Besten.</p>
          {ties.map((tie) => <TieOrder key={tie.key} t={t} tie={tie} dispatch={dispatch} />)}
          <DecidedTies t={t} dispatch={dispatch} />
        </section>
      )}

      {koReady && (
        <section className="banner banner-live" aria-labelledby="ko-h">
          <h2 id="ko-h">Gruppenphase beendet</h2>
          <p>Alle Gruppenspiele sind gespielt. Die Abschlusstabellen stehen unter „Tabellen“.</p>
          <DecidedTies t={t} dispatch={dispatch} />
          <div className="row">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'startKo' })}>
              K.O.-Runde starten
            </button>
          </div>
        </section>
      )}

      {t.phase === 'done' && (
        <section className="banner banner-live" aria-labelledby="done-h">
          <h2 id="done-h">Turnier beendet</h2>
          <p>Alle Spiele sind gespielt. Endstand unter „Tabellen“ und „Export“.</p>
        </section>
      )}

      {t.phase !== 'done' && <section aria-labelledby="boards-h">
        <h2 id="boards-h" className="sr-only">Boards</h2>
        <ul className="tiles">
          {Array.from({ length: t.settings.boards }, (_, i) => i + 1).map((board) => {
            const running = t.matches.find((m) => m.status === 'running' && m.board === board);
            const next = suggestions.get(board) ?? null;
            return (
              <li key={board} className={running ? 'tile tile-live' : 'tile'}>
                <h3 className="tile-head"><span className="tile-board">Board <b>{board}</b></span> <span className="tile-state">{running ? 'läuft' : 'frei'}</span></h3>
                {running ? <>
                  <p className="tile-players">{vs(running)}</p>
                  <p className="hint">{running.label} · First to {running.legsToWin}</p>
                  <div className="tile-actions">
                    <button type="button" className="btn btn-primary" onClick={() => setEntering(running.id)}>Ergebnis eintragen</button>
                    <button type="button" className="btn" onClick={() => dispatch({ type: 'cancelMatch', matchId: running.id })}>Abbrechen</button>
                  </div>
                </> : next ? <>
                  <p className="hint">Vorschlag</p>
                  <p className="tile-players">{vs(next)}</p>
                  <p className="hint">{next.label} · First to {next.legsToWin}</p>
                  <div className="tile-actions">
                    <button type="button" className="btn btn-primary" onClick={() => start(next.id, board)}>Spiel starten</button>
                    <button type="button" className="btn" onClick={() => setPicking(board)}>Anderes Spiel</button>
                  </div>
                </> : <p className="hint">{koReady ? 'Gruppenphase beendet – K.O.-Runde starten' : 'Gerade kein Spiel möglich.'}</p>}
              </li>
            );
          })}
        </ul>
      </section>}

      {q.length > 0 && (
        <section className="card" aria-labelledby="next-h">
          <h2 id="next-h">Als Nächstes</h2>
          <ol className="list">
            {q.slice(0, NEXT).map((m) => (
              <li key={m.id} className="list-row">
                <span><span className="tile-players">{vs(m)}</span><span className="hint"> · {m.label}</span></span>
                <button type="button" className="btn" onClick={() => setEntering(m.id)}>Ohne Board eintragen</button>
              </li>
            ))}
          </ol>
          {q.length > NEXT && <p className="hint">+{q.length - NEXT} weitere</p>}
        </section>
      )}

      {recent.length > 0 && (
        <section className="card" aria-labelledby="recent-h">
          <h2 id="recent-h">Letzte Ergebnisse</h2>
          <ol className="list">
            {recent.map((m) => {
              const r = m.result as Extract<Result, { kind: 'legs' }>;
              return (
                <li key={m.id} className="list-row">
                  <span>{playerName(t, m, 'a')} <b>{r.a}:{r.b}</b> {playerName(t, m, 'b')}<span className="hint"> · {m.label}</span></span>
                  {canEditResult(t, m.id) && <button type="button" className="btn" onClick={() => onEdit(m.id)}>Korrigieren</button>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {entered && (
        <ResultDialog match={entered} t={t} mode="new" onClose={() => setEntering(null)}
          onSave={(result, stats) => { dispatch({ type: 'record', matchId: entered.id, result, stats }); setEntering(null); }} />
      )}

      {picking !== null && (
        <Modal title={`Spiel für Board ${picking}`} onClose={() => setPicking(null)}>
          {q.length ? (
            <ol className="list">
              {q.map((m) => (
                <li key={m.id} className="list-row">
                  <span><span className="tile-players">{vs(m)}</span><span className="hint"> · {m.label}</span></span>
                  <button type="button" className="btn btn-primary" onClick={() => { start(m.id, picking); setPicking(null); }}>Starten</button>
                </li>
              ))}
            </ol>
          ) : <p>Kein offenes Spiel.</p>}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => setPicking(null)}>Schließen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TieOrder({ t, tie, dispatch }: { t: Tournament; tie: PendingTie; dispatch: (a: Action) => void }) {
  const [order, setOrder] = useState<PlayerId[]>([]);
  const name = (id: PlayerId) => t.players.find((p) => p.id === id)?.name ?? id;
  const tap = (id: PlayerId) => {
    const next = [...order, id];
    // the last one is decided once all others are placed
    const rest = tie.playerIds.filter((x) => !next.includes(x));
    setOrder(rest.length === 1 ? [...next, rest[0]] : next);
  };
  const complete = order.length === tie.playerIds.length;
  return (
    <div className="tie">
      <h3>{tie.label}</h3>
      <ul className="tie-players">
        {tie.playerIds.map((id) => {
          const pos = order.indexOf(id);
          return (
            <li key={id}>
              <button type="button" className="player" aria-pressed={pos >= 0} disabled={pos >= 0} onClick={() => tap(id)}>
                {pos >= 0 && <span className="tie-pos">{pos + 1}.</span>} {name(id)}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <button type="button" className="btn" disabled={!order.length} onClick={() => setOrder([])}>Zurücksetzen</button>
        <button type="button" className="btn btn-primary" disabled={!complete}
          onClick={() => dispatch({ type: 'setTieOrder', key: tie.key, order })}>Reihenfolge übernehmen</button>
      </div>
    </div>
  );
}

function DecidedTies({ t, dispatch }: { t: Tournament; dispatch: (a: Action) => void }) {
  const name = (id: PlayerId) => t.players.find((p) => p.id === id)?.name ?? id;
  return Object.entries(t.tieOrder).map(([key, order]) => (
    <div key={key} className="row">
      <span>Stechen entschieden: {order.map(name).join(', ')}</span>
      <button type="button" className="btn" onClick={() => dispatch({ type: 'clearTieOrder', key })}>Stechen zurücksetzen</button>
    </div>
  ));
}
