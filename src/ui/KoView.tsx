import { resolveSlot, winnerSide } from '../domain/resolve';
import type { Match, Tournament } from '../domain/types';
import { koLayout, placeHint, slotLabel } from './viewModel';

interface Props { t: Tournament; onEdit(matchId: string): void }

function MatchCard({ t, m, onEdit }: { t: Tournament; m: Match; onEdit(id: string): void }) {
  const w = winnerSide(m);
  const legs = m.result?.kind === 'legs' ? m.result : null;
  const hint = placeHint(m);
  const sides = (['a', 'b'] as const).map((s) => (
    <span key={s} className={w === s ? 'ko-side ko-win' : 'ko-side'}>
      <span>{slotLabel(t, m[s])}</span>
      <span className="ko-score">{legs ? legs[s] : m.result?.kind === 'walkover' && w !== s && resolveSlot(t.matches, m[s]) !== 'bye' ? 'kampflos' : ''}</span>
    </span>
  ));
  const body = <>
    <span className="ko-label">{m.label}{m.status === 'running' && <> · <b className="ko-live">läuft{m.board ? ` · Board ${m.board}` : ''}</b></>}</span>
    {sides}
    {hint && <span className="ko-label">{hint}</span>}
  </>;
  // played matches open the dialog; the shell decides whether legs or only stats may change
  return legs
    ? <button type="button" className="ko-match ko-click" onClick={() => onEdit(m.id)}>{body}</button>
    : <div className={m.status === 'running' ? 'ko-match ko-running' : 'ko-match'}>{body}</div>;
}

export function KoView({ t, onEdit }: Props) {
  const { columns, lists } = koLayout(t);
  if (!columns.length && !lists.length) return <p className="hint">Die K.O.-Runde beginnt nach der Gruppenphase.</p>;
  return (
    <div className="stack">
      {columns.length > 0 && (
        <section aria-label="Hauptrunde" className="bracket">
          {columns.map((c) => (
            <div key={c.title} className="bracket-col">
              <h2 className="bracket-title">{c.title}</h2>
              <ol className="bracket-matches">
                {c.matches.map((m) => <li key={m.id}><MatchCard t={t} m={m} onEdit={onEdit} /></li>)}
              </ol>
            </div>
          ))}
        </section>
      )}
      {lists.map((l) => (
        <section key={l.title} className="card" aria-labelledby={`ko-${l.title}`}>
          <h2 id={`ko-${l.title}`}>{l.title}</h2>
          <ol className="ko-grid">
            {l.matches.map((m) => <li key={m.id}><MatchCard t={t} m={m} onEdit={onEdit} /></li>)}
          </ol>
        </section>
      ))}
    </div>
  );
}
