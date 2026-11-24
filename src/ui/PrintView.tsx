import type { Tournament } from '../domain/types';
import { eveningHighlights } from '../export/highlights';
import './print.css';
import { hasGroupTables, PlacementList, resultText, StandingsTable } from './TablesView';
import { formatDate, koLayout, slotLabel } from './viewModel';

/** Print-only layout (A4); hidden on screen by print.css. */
export function PrintView({ t }: { t: Tournament }) {
  const { columns, lists } = koLayout(t);
  const h = eveningHighlights(t);
  const highlights = [
    ['Meiste 180er', h.most180], ['Höchster Highscore', h.highScore],
    ['Höchstes Finish', h.highFinish], ['Kürzestes Leg', h.shortLeg && { ...h.shortLeg, value: `${h.shortLeg.value} Darts` }],
  ].filter(([, b]) => b) as [string, { names: string; value: number | string }][];

  return (
    <div className="print-view">
      <header className="pv-head">
        <h1>{t.settings.name}</h1>
        <p>{formatDate(t.settings.date)}{t.phase !== 'done' && ' · vorläufig – das Turnier läuft noch'}</p>
      </header>

      <section className="pv-section">
        <h2>Endplatzierung</h2>
        <PlacementList t={t} />
      </section>

      {(columns.length > 0 || lists.length > 0) && (
        <section className="pv-section">
          <h2>K.O.-Runde</h2>
          <div className="pv-ko">
            {[...columns, ...lists].map((s) => (
              <div key={s.title} className="pv-block">
                <h3>{s.title}</h3>
                <ul>
                  {s.matches.map((m) => (
                    <li key={m.id}>
                      <span className="pv-muted">{m.label}: </span>
                      {resultText(t, m) ?? `${slotLabel(t, m.a)} – ${slotLabel(t, m.b)}`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasGroupTables(t) && (
        <section className="pv-section">
          <h2>Abschlusstabellen</h2>
          <div className="pv-groups">
            {t.groups.map((g) => (
              <div key={g.id} className="pv-block">
                <h3>{g.name}</h3>
                <StandingsTable t={t} g={g} />
              </div>
            ))}
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="pv-section">
          <h2>Highlights</h2>
          <dl className="pv-highlights">
            {highlights.map(([label, b]) => (
              <div key={label}><dt>{label}</dt><dd>{b.value} – {b.names}</dd></div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
