import { useTournament } from '../state/useTournament';
import { SetupScreen } from './SetupScreen';
import { TournamentShell } from './TournamentShell';

export default function App() {
  const { t, dispatch, persistOk, lastError, loadFailed } = useTournament();
  if (!t || t.phase === 'setup') return <SetupScreen t={t} dispatch={dispatch} lastError={lastError} loadFailed={loadFailed} />;
  return <TournamentShell t={t} dispatch={dispatch} persistOk={persistOk} lastError={lastError} />;
}
