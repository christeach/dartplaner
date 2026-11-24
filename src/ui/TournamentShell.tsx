import type { Tournament } from '../domain/types';

// placeholder, replaced in Task 13
export function TournamentShell({ t }: { t: Tournament }) {
  return (
    <main className="page">
      <header className="page-header">
        <h1>{t.settings.name}</h1>
        <p className="sub">Turnier läuft</p>
      </header>
    </main>
  );
}
