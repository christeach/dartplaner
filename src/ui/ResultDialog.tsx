import { useId, useState } from 'react';
import { resolveSlot } from '../domain/resolve';
import type { Match, PlayerStats, Result, Tournament } from '../domain/types';
import { isValidLegs, validateStats } from '../domain/validate';
import { formToStats, resultLabel, statsToForm, type StatsForm } from './liveForm';
import { Modal } from './Modal';

type Stats = Match['stats'];
type Side = 'a' | 'b';

// locked: the legs result is final (a follow-up match was played), only the stats can still change
interface Props { match: Match; t: Tournament; mode: 'new' | 'edit'; locked?: boolean; onSave(result: Result, stats: Stats): void; onClose(): void }

// prefix = how validateStats names the field in its messages
const FIELDS: { key: keyof PlayerStats; label: string; prefix: string; min: number; max?: number }[] = [
  { key: 's180', label: '180er', prefix: '180er', min: 0 },
  { key: 'highScore', label: 'Highscore', prefix: 'Highscore', min: 1, max: 180 },
  { key: 'highFinish', label: 'Highfinish', prefix: 'Highfinish', min: 2, max: 170 },
  { key: 'shortLeg', label: 'Shortleg', prefix: 'Shortleg', min: 9 },
];

export const playerName = (t: Tournament, m: Match, side: Side) => {
  const id = resolveSlot(t.matches, m[side]);
  return t.players.find((p) => p.id === id)?.name ?? '?';
};

export function ResultDialog({ match: m, t, mode, locked = false, onSave, onClose }: Props) {
  const id = useId();
  const n = m.legsToWin;
  const prev = m.result?.kind === 'legs' ? m.result : null;
  const [legs, setLegs] = useState<Record<Side, number | null>>({ a: prev?.a ?? null, b: prev?.b ?? null });
  const [form, setForm] = useState<Record<Side, StatsForm>>({ a: statsToForm(m.stats?.a), b: statsToForm(m.stats?.b) });
  const [touched, setTouched] = useState(false);
  const names = { a: playerName(t, m, 'a'), b: playerName(t, m, 'b') };

  const parsed = { a: formToStats(form.a), b: formToStats(form.b) };
  const errors = { a: parsed.a ? validateStats(parsed.a) : [], b: parsed.b ? validateStats(parsed.b) : [] };
  const legsOk = legs.a !== null && legs.b !== null && isValidLegs({ a: legs.a, b: legs.b }, n);
  const canSave = legsOk && errors.a.length === 0 && errors.b.length === 0;

  const save = () => {
    if (!canSave) return;
    // untouched stats go back unchanged; edited ones as an object (in edit mode an empty object clears them)
    const stats: Stats = !touched ? m.stats
      : !parsed.a && !parsed.b && mode === 'new' ? undefined
      : { ...(parsed.a ? { a: parsed.a } : {}), ...(parsed.b ? { b: parsed.b } : {}) };
    onSave({ kind: 'legs', a: legs.a!, b: legs.b! }, stats);
  };

  const title = locked ? 'Statistik korrigieren' : mode === 'edit' ? 'Ergebnis korrigieren'
    : `Ergebnis${m.board ? ` · Board ${m.board}` : ''} · First to ${n}`;

  return (
    <Modal title={title} onClose={onClose}>
      <p className="hint">{m.label}{mode === 'edit' ? ` · First to ${n}` : ''}</p>
      {locked && <p>Das Ergebnis steht fest, weil ein Folgespiel schon läuft oder gespielt ist. Die Statistik lässt sich noch ändern.</p>}
      <div className="stack" style={{ gap: 'var(--sp-4)' }}>
        {(['a', 'b'] as const).map((side) => (
          <div key={side} className="score-row" role="group" aria-labelledby={`${id}-${side}`}>
            <span id={`${id}-${side}`} className="score-name">{names[side]}</span>
            <div className="score-buttons">
              {Array.from({ length: n + 1 }, (_, k) => (
                <button key={k} type="button" className="score-btn" aria-pressed={legs[side] === k} disabled={locked}
                  aria-label={`${names[side]}: ${k} Legs`} onClick={() => setLegs({ ...legs, [side]: k })}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        ))}
        {legs.a !== null && legs.b !== null && !legsOk && (
          <p className="hint" role="status">Genau ein Spieler braucht {n} Legs.</p>
        )}

        <details className="stats" open={locked || (mode === 'edit' && !!m.stats)}>
          <summary>Statistik (optional)</summary>
          <div className="grid-2">
            {(['a', 'b'] as const).map((side) => (
              <fieldset key={side} className="plain">
                <legend className="label">{names[side]}</legend>
                <div className="stats-fields">
                  {FIELDS.map((f) => {
                    const err = errors[side].find((e) => e.startsWith(`${f.prefix}:`));
                    const fid = `${id}-${side}-${f.key}`;
                    return (
                      <div key={f.key} className="field">
                        <label htmlFor={fid}>{f.label}</label>
                        <input id={fid} type="number" inputMode="numeric" className="input input-num"
                          min={f.min} max={f.max} value={form[side][f.key]} aria-invalid={!!err}
                          aria-describedby={err ? `${fid}-err` : undefined}
                          onChange={(e) => { setTouched(true); setForm({ ...form, [side]: { ...form[side], [f.key]: e.target.value } }); }} />
                        {err && <p id={`${fid}-err`} className="field-error">{err}</p>}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </details>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
          {locked ? 'Statistik speichern' : resultLabel(legs.a, legs.b, n, names.a, names.b)}
        </button>
      </div>
    </Modal>
  );
}
