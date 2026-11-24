import type { Tournament } from '../domain/types';
import { downloadXlsx, exportFileName } from '../export/xlsx';

export function ExportView({ t }: { t: Tournament }) {
  return (
    <section className="card stack" aria-labelledby="export-h">
      <h2 id="export-h">Export</h2>
      {t.phase !== 'done' && <p className="banner" role="note">vorläufig – das Turnier läuft noch</p>}
      <div className="row">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>Als PDF drucken / speichern</button>
        <button type="button" className="btn btn-lg" onClick={() => downloadXlsx(t)}>Excel herunterladen</button>
      </div>
      <p className="hint">PDF: im Druckdialog „Als PDF speichern“ wählen. Excel-Datei: {exportFileName(t)}</p>
    </section>
  );
}
