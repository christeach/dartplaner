import { canEditResult, computePlacements, groupStandings } from '../domain/tournament';
import type { Group, PlayerId, Tournament } from '../domain/types';
import { hasGroupTables, placeGroups, rankLabels, resultText } from './viewModel';

interface Props { t: Tournament; onEdit(matchId: string): void }

function Name({ t, id }: { t: Tournament; id: PlayerId }) {
  const p = t.players.find((x) => x.id === id);
  return <>{p?.name ?? '?'}{p?.withdrawnAt !== undefined && <span className="hint"> (abgemeldet)</span>}</>;
}

export function StandingsTable({ t, g }: { t: Tournament; g: Group }) {
  const rows = groupStandings(t, g);
  const ranks = rankLabels(rows);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th scope="col">Platz</th><th scope="col" className="col-name">Name</th><th scope="col">Spiele</th><th scope="col">Siege</th>
            <th scope="col">Niederlagen</th><th scope="col">Legs</th><th scope="col">Leg-Differenz</th><th scope="col">Punkte</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.playerId} className={r.withdrawn ? 'row-out' : undefined}>
              <td>{ranks[i]}</td>
              <th scope="row" className="col-name"><Name t={t} id={r.playerId} /></th>
              <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td>
              <td>{r.legsFor}:{r.legsAgainst}</td><td>{r.legDiff > 0 ? `+${r.legDiff}` : r.legDiff}</td>
              <td><b>{r.points}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlacementList({ t }: { t: Tournament }) {
  return (
    <ol className="places">
      {placeGroups(computePlacements(t)).map((g) => (
        <li key={g.label}>
          <span className="place">{g.label}.</span>
          <span>{g.playerIds.map((id, i) => <span key={id}>{i > 0 && ', '}<Name t={t} id={id} /></span>)}</span>
        </li>
      ))}
    </ol>
  );
}

export function TablesView({ t, onEdit }: Props) {
  const done = t.matches.filter((m) => resultText(t, m) !== null).sort((x, y) => (y.finishedAt ?? 0) - (x.finishedAt ?? 0));
  const anyPlaces = computePlacements(t).length > 0;
  return (
    <div className="stack">
      {anyPlaces && (
        <section className="card" aria-labelledby="places-h">
          <h2 id="places-h">{t.phase === 'done' ? 'Endplatzierung' : 'Platzierung (vorläufig)'}</h2>
          <PlacementList t={t} />
        </section>
      )}

      {hasGroupTables(t) && t.groups.map((g) => (
        <section key={g.id} className="card" aria-labelledby={`table-${g.id}`}>
          <h2 id={`table-${g.id}`}>{g.name}</h2>
          <StandingsTable t={t} g={g} />
        </section>
      ))}

      <section className="card" aria-labelledby="played-h">
        <h2 id="played-h">Gespielte Spiele</h2>
        {done.length ? (
          <ol className="list">
            {done.map((m) => (
              <li key={m.id} className="list-row">
                <span>{resultText(t, m)}<span className="hint"> · {m.label}</span></span>
                {m.result?.kind === 'legs' && (
                  <button type="button" className="btn" onClick={() => onEdit(m.id)}>
                    {canEditResult(t, m.id) ? 'Korrigieren' : 'Statistik ändern'}
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : <p className="hint">Noch kein Spiel beendet.</p>}
      </section>
    </div>
  );
}
