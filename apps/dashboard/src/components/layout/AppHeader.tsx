import { fullName } from '../../lib/format';
import { useBestContext } from '../../contexts/best-context';

export function AppHeader() {
  const { session, search, setSearch, reload, logout } = useBestContext();

  return (
    <header className="header">
      <div>
        <h1>BEST</h1>
        <small>{session ? `${session.username}` : fullName(undefined)}</small>
      </div>
      <div className="header-actions">
        <input placeholder="\u062c\u0633\u062a\u062c\u0648" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={() => void reload()}>
          {'\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc'}
        </button>
        <button onClick={logout}>{'\u062e\u0631\u0648\u062c'}</button>
      </div>
    </header>
  );
}
