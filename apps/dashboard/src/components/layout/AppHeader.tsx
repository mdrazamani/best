import { Menu, Moon, Sun } from 'lucide-react';
import { useBestContext } from '../../contexts/best-context';

export function AppHeader({
  onToggleSidebar,
  theme,
  onToggleTheme
}: {
  onToggleSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { session, search, setSearch, reload, logout } = useBestContext();

  return (
    <header className="topbar">
      <div className="topbar-main">
        <button
          className="icon-btn mobile-only"
          onClick={onToggleSidebar}
          type="button"
          aria-label={'\u0628\u0627\u0632 \u06a9\u0631\u062f\u0646 \u0645\u0646\u0648'}
        >
          <Menu size={18} />
        </button>
        <div>
          <h1>BEST</h1>
          <small>{session?.username ?? '-'}</small>
        </div>
      </div>

      <div className="topbar-actions">
        <input
          placeholder={'\u062c\u0633\u062a\u062c\u0648 \u062f\u0631 \u062f\u0627\u062f\u0647\u200c\u0647\u0627'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="ghost-btn" onClick={() => void reload()} type="button">
          {'\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc'}
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          type="button"
          aria-label={'\u062a\u063a\u06cc\u06cc\u0631 \u062a\u0645'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={logout} type="button">
          {'\u062e\u0631\u0648\u062c'}
        </button>
      </div>
    </header>
  );
}
