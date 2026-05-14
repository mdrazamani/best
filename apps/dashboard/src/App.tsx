import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, PanelRightClose, PanelRightOpen } from 'lucide-react';
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
import { NotificationsPage } from './pages/NotificationsPage';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';

const THEME_KEY = 'best_theme';
const SIDEBAR_KEY = 'best_sidebar_collapsed';
const PROJECT_VERSION = '0.1.1';

export function App() {
  const app = useBestApp();
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [tabHistory, setTabHistory] = useState<AppTab[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState<string>('');
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
      case 'notifications':
        return <NotificationsPage />;
      case 'activity':
        return <ActivityPage />;
      default:
        return <DashboardPage />;
    }
  }, [app.token, tab]);

  const navigateToTab = (nextTab: AppTab) => {
    setTab((prev) => {
      if (prev === nextTab) return prev;
      setTabHistory((history) => [...history, prev]);
      return nextTab;
    });
    setMobileSidebarOpen(false);
  };

  const goBack = () => {
    setTabHistory((history) => {
      if (!history.length) return history;
      const nextHistory = [...history];
      const previousTab = nextHistory.pop() as AppTab;
      setTab(previousTab);
      return nextHistory;
    });
  };

  const openNotificationTarget = (item: { type: 'INVOICE_DUE' | 'ORDER_DUE'; orderId?: string }) => {
    if (item.orderId) {
      void app.openOrderDetail(item.orderId);
      navigateToTab('orders');
      return;
    }
    navigateToTab(item.type === 'ORDER_DUE' ? 'orders' : 'invoices');
  };

  const openComingSoon = (title: string) => {
    setComingSoonTitle(title);
    setComingSoonOpen(true);
  };

  const contextValue = {
    ...app,
    currentTab: tab,
    canGoBack: tabHistory.length > 0,
    navigateToTab,
    goBack,
    openNotificationTarget
  };

  return (
    <BestContext.Provider value={contextValue}>
      {app.token ? (
        <div className="relative min-h-screen" dir="rtl">
          <div className="mx-auto w-full max-w-[1760px] px-3 pb-5 pt-3 sm:px-4 sm:pb-6 sm:pt-4 lg:px-6 lg:pt-6">
            <aside
              className={`fixed bottom-3 right-3 top-3 z-[80] flex w-[84vw] max-w-[20rem] flex-col overflow-hidden rounded-xl border border-slate-300/95 bg-white p-3 shadow-[0_28px_48px_-34px_rgba(15,23,42,0.85)] transition-all duration-300 dark:border-slate-700/95 dark:bg-card lg:bottom-6 lg:right-6 lg:top-6 lg:max-w-none ${
                mobileSidebarOpen ? 'translate-x-0' : 'translate-x-[112%] lg:translate-x-0'
              } ${sidebarCollapsed ? 'lg:w-[5.25rem] lg:px-2.5 lg:py-3' : 'lg:w-[18rem] lg:p-4'}`}
            >
              <div className={`mb-4 flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!sidebarCollapsed ? (
                  <div>
                    <p className="text-xl font-extrabold tracking-tight text-primary">بست</p>
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

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <AppTabs
                    active={tab}
                    onChange={navigateToTab}
                    collapsed={sidebarCollapsed}
                    onItemClick={() => setMobileSidebarOpen(false)}
                    onDisabledItemClick={openComingSoon}
                  />
                </div>

                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <span>نسخه {PROJECT_VERSION}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      ساخته شده با
                      <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            {mobileSidebarOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-[70] bg-slate-950/56 backdrop-blur-[1px] lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="بستن منو"
              />
            ) : null}

            <main className={`min-w-0 transition-[padding] duration-300 ${sidebarCollapsed ? 'lg:pr-[5.9rem]' : 'lg:pr-[19.5rem]'}`}>
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

          <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>بخش {comingSoonTitle}</DialogTitle>
                <DialogDescription>
                  این بخش در آینده به سیستم اضافه خواهد شد.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        content
      )}
    </BestContext.Provider>
  );
}
