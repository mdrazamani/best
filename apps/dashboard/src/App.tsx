import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
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
import { Button } from './components/ui/button';

const THEME_KEY = 'best_theme';
const SIDEBAR_KEY = 'best_sidebar_collapsed';

export function App() {
  const app = useBestApp();
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

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
        <div className="min-h-screen" dir="rtl">
          <div className="mx-auto flex w-full max-w-[1700px] gap-4 p-4 lg:p-6">
            <aside
              className={`fixed inset-y-4 right-4 z-40 w-72 rounded-2xl border bg-card/95 p-4 shadow-soft backdrop-blur transition-transform duration-300 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] ${
                mobileSidebarOpen ? 'translate-x-0' : 'translate-x-[120%] lg:translate-x-0'
              } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                {!sidebarCollapsed ? (
                  <div>
                    <p className="text-lg font-bold tracking-tight text-primary">BEST</p>
                    <p className="text-xs text-muted-foreground">پنل حسابداری تولیدی توری</p>
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  aria-label="تغییر وضعیت سایدبار"
                >
                  {sidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                </Button>
              </div>

              <AppTabs
                active={tab}
                onChange={setTab}
                collapsed={sidebarCollapsed}
                onItemClick={() => setMobileSidebarOpen(false)}
              />
            </aside>

            {mobileSidebarOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="بستن منو"
              />
            ) : null}

            <main className="w-full min-w-0 flex-1">
              <AppHeader
                onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
                theme={theme}
                onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              />

              {app.loading ? <p className="mb-4 text-sm text-muted-foreground">در حال بارگذاری...</p> : null}
              {app.error ? <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{app.error}</p> : null}

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      ) : (
        content
      )}
    </BestContext.Provider>
  );
}