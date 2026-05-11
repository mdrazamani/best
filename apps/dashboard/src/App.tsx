import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BestContext } from './contexts/best-context';
import { useBestApp } from './hooks/use-best-app';
import { AppHeader } from './components/layout/AppHeader';
import { AppTabs, AppTab } from './components/layout/AppTabs';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { CollaboratorsPage } from './pages/CollaboratorsPage';
import { CustomersPage } from './pages/CustomersPage';
import { MeshTypesPage } from './pages/MeshTypesPage';
import { UsersPage } from './pages/UsersPage';
import { BackupsPage } from './pages/BackupsPage';
import { ActivityPage } from './pages/ActivityPage';

const THEME_KEY = 'best_theme';

export function App() {
  const app = useBestApp();
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const content = useMemo(() => {
    if (!app.token) return <LoginPage />;

    switch (tab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'orders':
        return <OrdersPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'collaborators':
        return <CollaboratorsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'mesh':
        return <MeshTypesPage />;
      case 'users':
        return <UsersPage />;
      case 'backups':
        return <BackupsPage />;
      case 'activity':
        return <ActivityPage />;
      default:
        return <DashboardPage />;
    }
  }, [app.token, tab]);

  return (
    <BestContext.Provider value={app}>
      {app.token ? (
        <div className="app-shell" dir="rtl">
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-brand">
              <strong>BEST</strong>
              <span>{'\u067e\u0646\u0644 \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u062a\u0648\u0644\u06cc\u062f\u06cc \u062a\u0648\u0631\u06cc'}</span>
            </div>
            <AppTabs active={tab} onChange={setTab} onItemClick={() => setSidebarOpen(false)} />
          </aside>

          {sidebarOpen ? (
            <button
              className="overlay"
              onClick={() => setSidebarOpen(false)}
              type="button"
              aria-label={'\u0628\u0633\u062a\u0646 \u0645\u0646\u0648'}
            />
          ) : null}

          <main className="app-main">
            <AppHeader
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              theme={theme}
              onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            />

            {app.loading ? <p className="muted">{`\u062f\u0631 \u062d\u0627\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc...`}</p> : null}
            {app.error ? <p className="error">{app.error}</p> : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      ) : (
        content
      )}
    </BestContext.Provider>
  );
}
