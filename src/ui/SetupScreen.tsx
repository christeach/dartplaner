import { useId, useState } from 'react';
import { koFieldOptions } from '../domain/multiGroupKo';
import { BrandBar } from './Brand';
import type { PlayerId, Settings, Tournament } from '../domain/types';
import { minPlayers, parseNames, validateSetup } from '../domain/validate';
import type { Action } from '../state/useTournament';
import { buildMode, defaultLegs, defaultModeForm, formFromMode, groupSizes, shownLegs, todayIso, usedLegs, type ModeChoice, type ModeForm } from './setupForm';

const MODES: { choice: ModeChoice; label: string }[] = [
  { choice: 'club', label: '2 Ligen + K.O. (Vereinsmodus)' },
  { choice: 'groups', label: 'Gruppen + K.O.' },
  { choice: 'roundRobin', label: 'Jeder gegen jeden' },
  { choice: 'singleKo', label: 'K.O.' },
  { choice: 'doubleKo', label: 'Doppel-K.O.' },
];

interface Props { t: Tournament | null; dispatch: (a: Action) => void; lastError: string | null; loadFailed?: boolean }

export function SetupScreen({ t, dispatch, lastError, loadFailed }: Props) {
  const id = useId();
  const s = t?.settings;
  const [name, setName] = useState(s?.name ?? 'Vereinsturnier');
  const [date, setDate] = useState(s?.date ?? todayIso());
  const [namesText, setNamesText] = useState(t ? t.players.map((p) => p.name).join('\n') : '');
  const [modeForm, setModeForm] = useState<ModeForm>(s ? formFromMode(s.mode) : defaultModeForm);
  const [legs, setLegs] = useState(s?.legs ?? defaultLegs);
  const [boards, setBoards] = useState(s?.boards ?? 4);
  const [picked, setPicked] = useState<PlayerId | null>(null);

  const parsed = parseNames(namesText, []);
  const m = modeForm;
  const fieldOptions = m.choice === 'groups' ? koFieldOptions(groupSizes(parsed.names.length, m.groups)) : [];
  // a chosen K.O. field that the current player count no longer allows falls back to "largest possible"
  const koFieldSize = m.koFieldSize && fieldOptions.includes(m.koFieldSize) ? m.koFieldSize : 0;
  const settings: Settings = { name: name.trim(), date, boards, legs: usedLegs(m, legs), mode: buildMode({ ...m, koFieldSize }) };
  const setupErrors = validateSetup(settings, parsed.names.length);
  const formErrors = [...(settings.name ? [] : ['Bitte einen Turniernamen eingeben.']), ...parsed.errors, ...setupErrors];
  // the draw belongs to the inputs it was made from; any later edit needs a new draw
  const drawStale = !!t && JSON.stringify([t.settings, t.players.map((p) => p.name)])
    !== JSON.stringify([settings, parsed.names]);

  const setMode = (patch: Partial<ModeForm>) => setModeForm({ ...m, ...patch });
  const shown = shownLegs(m);
  const playerName = (pid: PlayerId) => t?.players.find((p) => p.id === pid)?.name ?? pid;

  const pick = (pid: PlayerId) => {
    if (!picked) return setPicked(pid);
    if (picked !== pid) dispatch({ type: 'swap', a: picked, b: pid });
    setPicked(null);
  };
  const num = (v: string) => (v === '' ? NaN : Number(v));

  return (
    <main className="page">
      <BrandBar />
      <div className="page-header">
        <p className="eyebrow">Setup</p>
        <h1 tabIndex={-1}>Neues Turnier</h1>
      </div>

      {loadFailed && <p className="errors banner-msg" role="alert">Gespeichertes Turnier konnte nicht gelesen werden.</p>}

      <div className="stack">
        <section className="card" aria-labelledby={`${id}-h1`}>
          <h2 id={`${id}-h1`}><span className="step" aria-hidden="true">1</span>Turnier</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`${id}-name`}>Turniername</label>
              <input id={`${id}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-date`}>Datum</label>
              <input id={`${id}-date`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby={`${id}-h2`}>
          <h2 id={`${id}-h2`}><span className="step" aria-hidden="true">2</span>Spieler</h2>
          <div className="field">
            <label htmlFor={`${id}-names`}>Spielernamen, ein Name pro Zeile</label>
            <textarea id={`${id}-names`} className="textarea" value={namesText} spellCheck={false}
              aria-invalid={parsed.errors.length > 0} aria-describedby={`${id}-names-info`}
              onChange={(e) => setNamesText(e.target.value)} />
            <div id={`${id}-names-info`} className="stack" style={{ gap: 'var(--sp-2)' }} aria-live="polite">
              <p><span className="count">{parsed.names.length} Spieler</span>
                <span className="hint"> · mindestens {minPlayers(settings.mode)} für diesen Modus</span></p>
              {parsed.errors.length > 0 && <ul className="errors">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby={`${id}-h3`}>
          <h2 id={`${id}-h3`}><span className="step" aria-hidden="true">3</span>Modus</h2>
          <div className="stack">
            <fieldset className="choices">
              <legend className="sr-only">Turniermodus</legend>
              {MODES.map((o) => (
                <label key={o.choice} className="choice">
                  <input type="radio" name={`${id}-mode`} checked={m.choice === o.choice}
                    onChange={() => setMode({ choice: o.choice })} />
                  {o.label}
                </label>
              ))}
            </fieldset>

            <div className="row" style={{ gap: 'var(--sp-5)' }}>
              {m.choice === 'groups' && <>
                <div className="field">
                  <label htmlFor={`${id}-groups`}>Anzahl Gruppen</label>
                  <select id={`${id}-groups`} className="select" value={m.groups}
                    onChange={(e) => setMode({ groups: Number(e.target.value), koFieldSize: 0 })}>
                    {[3, 4, 5, 6, 7, 8].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`${id}-field`}>K.O.-Feld</label>
                  <select id={`${id}-field`} className="select" value={koFieldSize}
                    onChange={(e) => setMode({ koFieldSize: Number(e.target.value) as ModeForm['koFieldSize'] })}>
                    <option value={0}>größtmöglich</option>
                    {fieldOptions.map((f) => <option key={f} value={f}>{f} Spieler</option>)}
                  </select>
                </div>
              </>}
              {(m.choice === 'club' || m.choice === 'groups') && (
                <label className="check">
                  <input type="checkbox" checked={m.placementGames} onChange={(e) => setMode({ placementGames: e.target.checked })} />
                  Platzierungsspiele
                </label>
              )}
              {(m.choice === 'club' || m.choice === 'groups' || m.choice === 'singleKo') && (
                <label className="check">
                  <input type="checkbox" checked={m.thirdPlace} onChange={(e) => setMode({ thirdPlace: e.target.checked })} />
                  Spiel um Platz 3
                </label>
              )}
              {m.choice === 'roundRobin' && (
                <label className="check">
                  <input type="checkbox" checked={m.finalTopTwo} onChange={(e) => setMode({ finalTopTwo: e.target.checked })} />
                  Finale der ersten 2
                </label>
              )}
            </div>

            <fieldset className="plain">
              <legend className="label">Legs zum Sieg</legend>
              <div className="row" style={{ gap: 'var(--sp-5)' }}>
                {shown.group && <NumField id={`${id}-lg`} label="Gruppe/Liga" value={legs.group}
                  onChange={(v) => setLegs({ ...legs, group: num(v) })} />}
                {shown.ko && <NumField id={`${id}-lk`} label="K.O.-Runden" value={legs.ko}
                  onChange={(v) => setLegs({ ...legs, ko: num(v) })} />}
                {shown.final && <NumField id={`${id}-lf`} label="Finale" value={legs.final}
                  onChange={(v) => setLegs({ ...legs, final: num(v) })} />}
              </div>
            </fieldset>
            <NumField id={`${id}-boards`} label="Anzahl Boards" value={boards} onChange={(v) => setBoards(num(v))} />
          </div>
        </section>

        <section className="card" aria-labelledby={`${id}-h4`}>
          <h2 id={`${id}-h4`}><span className="step" aria-hidden="true">4</span>Auslosung</h2>
          <div className="stack">
            <div aria-live="polite">
              {formErrors.length > 0 && <ul className="errors">{formErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
            {lastError && <p className="errors" role="alert">{lastError}</p>}
            <div className="row">
              {t && !drawStale
                ? <button type="button" className="btn" onClick={() => { setPicked(null); dispatch({ type: 'redraw' }); }}>
                  Neu auslosen
                </button>
                : <button type="button" className="btn btn-primary btn-lg" disabled={formErrors.length > 0}
                  onClick={() => { setPicked(null); dispatch({ type: 'create', settings, names: parsed.names }); }}>
                  Auslosen
                </button>}
            </div>

            {t && (drawStale
              ? <p className="errors" role="status">Eingaben geändert. Bitte erneut auslosen.</p>
              : <>
                <p className="hint" aria-live="polite">
                  {picked ? `${playerName(picked)} ausgewählt. Zweiten Spieler antippen zum Tauschen.`
                    : 'Zum Tauschen zwei Spieler nacheinander antippen.'}
                </p>
                <div className="groups">
                  {t.groups.map((g) => (
                    <div key={g.id} className="group">
                      <h3>{g.name}</h3>
                      <ol>
                        {g.playerIds.map((pid) => (
                          <li key={pid}>
                            <button type="button" className="player" aria-pressed={picked === pid} onClick={() => pick(pid)}>
                              {playerName(pid)}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
                <div className="row">
                  <button type="button" className="btn btn-primary btn-lg" disabled={formErrors.length > 0}
                    onClick={() => dispatch({ type: 'start' })}>
                    Turnier starten
                  </button>
                </div>
              </>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function NumField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={1} className="input input-num"
        value={Number.isNaN(value) ? '' : value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
