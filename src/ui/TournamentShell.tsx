import { useEffect, useState } from 'react';
import type { PlayerId, Tournament } from '../domain/types';
import type { Action } from '../state/useTournament';
import { canEditResult } from '../domain/tournament';
import { BoardsView } from './BoardsView';
import { BrandBar } from './Brand';
import { ExportView } from './ExportView';
import { KoView } from './KoView';
import { ConfirmDialog, Modal } from './Modal';
import { PrintView } from './PrintView';
import { ResultDialog } from './ResultDialog';
import { TablesView } from './TablesView';
import { formatDate } from './viewModel';

type Tab = 'boards' | 'tables' | 'ko' | 'export';

interface Props { t: Tournament; dispatch: (a: Action) => void; persistOk: boolean; lastError: string | null }

export function TournamentShell({ t, dispatch, persistOk, lastError }: Props) {
  const [tab, setTab] = useState<Tab>('boards');
  const [editing, setEditing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'withdraw' | 'reset' | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // a success clears lastError; forget the dismissal so the same error shows again next time
  useEffect(() => { if (!lastError) setDismissed(null); }, [lastError]);

  const { mode } = t.settings;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'boards', label: 'Boards' },
    { id: 'tables', label: 'Tabellen' },
    ...(mode.kind === 'roundRobin' && !mode.finalTopTwo ? [] : [{ id: 'ko' as const, label: 'K.O.' }]),
    { id: 'export', label: 'Export' },
  ];
  const edited = editing ? t.matches.find((m) => m.id === editing) : undefined;

  return (
    <main className="page">
      <BrandBar>
        <div className="row" role="group" aria-label="Turnier">
          <button type="button" className="btn" disabled={t.phase === 'done'} onClick={() => setDialog('withdraw')}>Spieler abmelden</button>
          <button type="button" className="btn" onClick={() => setDialog('reset')}>Neues Turnier</button>
        </div>
      </BrandBar>
      <div className="page-header">
        <p className="eyebrow">{formatDate(t.settings.date)}</p>
        <h1 tabIndex={-1}>{t.settings.name}</h1>
      </div>

      {!persistOk && <p className="errors banner-msg" role="alert">Speichern im Browser nicht möglich – bitte Seite nicht neu laden</p>}
      {lastError && lastError !== dismissed && (
        <div className="errors banner-msg alert-row" role="alert">
          <p>{lastError}</p>
          <button type="button" className="btn" onClick={() => setDismissed(lastError)}>Schließen</button>
        </div>
      )}

      <nav className="tabs" aria-label="Ansicht">
        {tabs.map((x) => (
          <button key={x.id} type="button" className="tab" aria-current={tab === x.id ? 'page' : undefined}
            onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </nav>

      {tab === 'boards' && <BoardsView t={t} dispatch={dispatch} onEdit={setEditing} />}
      {tab === 'tables' && <TablesView t={t} onEdit={setEditing} />}
      {tab === 'ko' && <KoView t={t} onEdit={setEditing} />}
      {tab === 'export' && <ExportView t={t} />}
      <PrintView t={t} />

      {edited && (
        <ResultDialog match={edited} t={t} mode="edit" locked={!canEditResult(t, edited.id)} onClose={() => setEditing(null)}
          onSave={(result, stats) => {
            dispatch(canEditResult(t, edited.id) ? { type: 'edit', matchId: edited.id, result, stats } : { type: 'editStats', matchId: edited.id, stats });
            setEditing(null);
          }} />
      )}
      {dialog === 'withdraw' && <WithdrawDialog t={t} dispatch={dispatch} onClose={() => setDialog(null)} />}
      {dialog === 'reset' && (
        <ConfirmDialog title="Neues Turnier" confirm="Turnier löschen und neu anlegen"
          text="Das laufende Turnier wird mit allen Ergebnissen gelöscht. Das lässt sich nicht rückgängig machen. Wer die Ergebnisse behalten will, exportiert sie vorher unter „Export“."
          onConfirm={() => dispatch({ type: 'reset' })} onClose={() => setDialog(null)} />
      )}
    </main>
  );
}

function WithdrawDialog({ t, dispatch, onClose }: { t: Tournament; dispatch: (a: Action) => void; onClose(): void }) {
  const [pid, setPid] = useState<PlayerId>('');
  const active = t.players.filter((p) => p.withdrawnAt === undefined).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const name = t.players.find((p) => p.id === pid)?.name;
  return (
    <Modal title="Spieler abmelden" onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--sp-4)' }}>
        <div className="field">
          <label htmlFor="withdraw-player">Spieler</label>
          <select id="withdraw-player" className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Bitte wählen</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <p>
          {name ? `${name} wird ab jetzt nicht mehr berücksichtigt. ` : 'Der Spieler wird ab jetzt nicht mehr berücksichtigt. '}
          Gespielte Gruppenergebnisse bleiben in der Wertung, offene Gruppenspiele entfallen.
          Ein laufendes oder offenes K.O.-Spiel wird kampflos für den Gegner gewertet. Das lässt sich nicht rückgängig machen.
        </p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" disabled={!pid}
          onClick={() => { dispatch({ type: 'withdraw', playerId: pid }); onClose(); }}>
          {name ? `${name} abmelden` : 'Abmelden'}
        </button>
      </div>
    </Modal>
  );
}
