import { useTournament } from '../state/useTournament';
import { SetupScreen } from './SetupScreen';
import { TournamentShell } from './TournamentShell';

export default function App() {
  const { t, dispatch, persistOk, lastError } = useTournament();
  if (!t || t.phase === 'setup') return <SetupScreen t={t} dispatch={dispatch} lastError={lastError} />;
  return <TournamentShell t={t} dispatch={dispatch} persistOk={persistOk} lastError={lastError} />;
}
