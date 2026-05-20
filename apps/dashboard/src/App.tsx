import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
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
import { InventoryPage } from './pages/InventoryPage';
import { UsersPage } from './pages/UsersPage';
import { BackupsPage } from './pages/BackupsPage';
import { ActivityPage } from './pages/ActivityPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';

const THEME_KEY = 'best_theme';
const SIDEBAR_KEY = 'best_sidebar_collapsed';
const ACTIVE_TAB_KEY = 'best_active_tab';
const PROJECT_VERSION = '0.1.1';
const APP_TABS: AppTab[] = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers', 'mesh', 'warehouse', 'users', 'backups', 'notifications', 'activity'];
const ASSISTANT_TABS: AppTab[] = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers', 'mesh', 'warehouse', 'notifications'];
const TAB_PATH: Record<AppTab, string> = {
  dashboard: 'dashboard',
  orders: 'orders',
  invoices: 'invoices',
  collaborators: 'collaborators',
  customers: 'customers',
  mesh: 'mesh',
  warehouse: 'warehouse',
  users: 'users',
  backups: 'backups',
  notifications: 'notifications',
  activity: 'activity'
};

type RouteSnapshot = {
  tab: AppTab | null;
  detailId?: string;
};

const decodePathSegment = (value?: string) => {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseRouteFromPath = (): RouteSnapshot => {
  if (typeof window === 'undefined') return { tab: null };
  const [segment, detailSegment] = window.location.pathname.split('/').filter(Boolean);
  if (!segment) return { tab: null };
  const entry = Object.entries(TAB_PATH).find(([, value]) => value === segment);
  const tab = (entry?.[0] as AppTab | undefined) ?? null;
  if (!tab) return { tab: null };
  return { tab, detailId: decodePathSegment(detailSegment) };
};

const pathForTab = (tab: AppTab, detailId?: string) => {
  const base = `/${TAB_PATH[tab]}`;
  if (!detailId) return base;
  if (tab === 'orders' || tab === 'collaborators' || tab === 'customers' || tab === 'invoices') {
    return `${base}/${encodeURIComponent(detailId)}`;
  }
  return base;
};

export function App() {
  const app = useBestApp();
  const [bootReady, setBootReady] = useState(false);
  const [tab, setTab] = useState<AppTab>(() => {
    const route = parseRouteFromPath();
    if (route.tab) return route.tab;
    const stored = localStorage.getItem(ACTIVE_TAB_KEY);
    return stored && APP_TABS.includes(stored as AppTab) ? (stored as AppTab) : 'dashboard';
  });
  const [tabHistory, setTabHistory] = useState<AppTab[]>([]);
  const skipPathSyncRef = useRef(false);
  const initialRouteAppliedRef = useRef(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  const visibleTabs = useMemo(
    () => (app.session?.roleKeys?.includes('manager') ? APP_TABS : ASSISTANT_TABS),
    [app.session]
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detailId =
      tab === 'orders'
        ? app.orderDetail?.id
        : tab === 'invoices'
          ? app.invoiceDetail?.id
        : tab === 'collaborators'
          ? app.collaboratorDetail?.id
          : tab === 'customers'
            ? app.customerDetail?.id
            : undefined;
    const targetPath = pathForTab(tab, detailId);
    if (window.location.pathname === targetPath) return;
    if (skipPathSyncRef.current) {
      skipPathSyncRef.current = false;
      return;
    }
    window.history.replaceState({}, '', targetPath);
  }, [tab, app.orderDetail?.id, app.invoiceDetail?.id, app.collaboratorDetail?.id, app.customerDetail?.id]);

  useEffect(() => {
    const onPopState = () => {
      const route = parseRouteFromPath();
      const pathTab = route.tab ?? 'dashboard';
      skipPathSyncRef.current = true;
      setTab(pathTab);
      setMobileSidebarOpen(false);

      if (pathTab === 'orders') {
        app.closeInvoiceDetail();
        app.closeCollaboratorDetail();
        app.closeCustomerDetail();
        if (route.detailId) void app.openOrderDetail(route.detailId);
        else app.closeOrderDetail();
        return;
      }
      if (pathTab === 'invoices') {
        app.closeOrderDetail();
        app.closeCollaboratorDetail();
        app.closeCustomerDetail();
        if (route.detailId) void app.openInvoiceDetail(route.detailId);
        else app.closeInvoiceDetail();
        return;
      }
      if (pathTab === 'collaborators') {
        app.closeInvoiceDetail();
        app.closeOrderDetail();
        app.closeCustomerDetail();
        if (route.detailId) void app.openCollaboratorDetail(route.detailId);
        else app.closeCollaboratorDetail();
        return;
      }
      if (pathTab === 'customers') {
        app.closeInvoiceDetail();
        app.closeOrderDetail();
        app.closeCollaboratorDetail();
        if (route.detailId) void app.openCustomerDetail(route.detailId);
        else app.closeCustomerDetail();
        return;
      }

      app.closeInvoiceDetail();
      app.closeOrderDetail();
      app.closeCollaboratorDetail();
      app.closeCustomerDetail();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [app]);

  useEffect(() => {
    if (!app.token || !app.session || initialRouteAppliedRef.current) return;
    initialRouteAppliedRef.current = true;
    const route = parseRouteFromPath();
    const routeTab = route.tab ?? 'dashboard';
    const nextTab = visibleTabs.includes(routeTab) ? routeTab : 'dashboard';
    if (tab !== nextTab) {
      setTab(nextTab);
    }

    if (nextTab === 'orders') {
      app.closeInvoiceDetail();
      app.closeCollaboratorDetail();
      app.closeCustomerDetail();
      if (route.detailId) void app.openOrderDetail(route.detailId);
      else app.closeOrderDetail();
      return;
    }
    if (nextTab === 'invoices') {
      app.closeOrderDetail();
      app.closeCollaboratorDetail();
      app.closeCustomerDetail();
      if (route.detailId) void app.openInvoiceDetail(route.detailId);
      else app.closeInvoiceDetail();
      return;
    }
    if (nextTab === 'collaborators') {
      app.closeInvoiceDetail();
      app.closeOrderDetail();
      app.closeCustomerDetail();
      if (route.detailId) void app.openCollaboratorDetail(route.detailId);
      else app.closeCollaboratorDetail();
      return;
    }
    if (nextTab === 'customers') {
      app.closeInvoiceDetail();
      app.closeOrderDetail();
      app.closeCollaboratorDetail();
      if (route.detailId) void app.openCustomerDetail(route.detailId);
      else app.closeCustomerDetail();
      return;
    }

    app.closeInvoiceDetail();
    app.closeOrderDetail();
    app.closeCollaboratorDetail();
    app.closeCustomerDetail();
  }, [app, tab, app.token, app.session, visibleTabs]);

  useEffect(() => {
    if (!app.token || !app.session) return;
    if (visibleTabs.includes(tab)) return;
    skipPathSyncRef.current = true;
    setTab('dashboard');
  }, [app.token, app.session, tab, visibleTabs]);

  useEffect(() => {
    let alive = true;

    const waitForBoot = async () => {
      const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
      const fontsReady =
        typeof document !== 'undefined' && 'fonts' in document
          ? (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
          : Promise.resolve();

      await Promise.race([fontsReady, timeout]);
      if (alive) {
        setBootReady(true);
      }
    };

    void waitForBoot();
    return () => {
      alive = false;
    };
  }, []);

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
      case 'warehouse':
        return <InventoryPage />;
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

  const resetTabDetails = (targetTab: AppTab) => {
    if (targetTab === 'orders') {
      app.closeOrderDetail();
      return;
    }
    if (targetTab === 'invoices') {
      app.closeInvoiceDetail();
      return;
    }
    if (targetTab === 'collaborators') {
      app.closeCollaboratorDetail();
      return;
    }
    if (targetTab === 'customers') {
      app.closeCustomerDetail();
    }
  };

  const navigateToTab = (nextTab: AppTab) => {
    if (tab !== nextTab) {
      resetTabDetails(nextTab);
    }
    setTab((prev) => {
      if (prev === nextTab) {
        return prev;
      }
      const targetPath = pathForTab(nextTab);
      if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
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
      const targetPath = pathForTab(previousTab);
      if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
        window.history.replaceState({}, '', targetPath);
      }
      setTab(previousTab);
      return nextHistory;
    });
  };

  const openOrderDetailWithRoute = async (id: string) => {
    if (tab !== 'orders') {
      setTabHistory((history) => [...history, tab]);
      setTab('orders');
    }
    await app.openOrderDetail(id);
    const targetPath = pathForTab('orders', id);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const openInvoiceDetailWithRoute = async (id: string) => {
    if (tab !== 'invoices') {
      setTabHistory((history) => [...history, tab]);
      setTab('invoices');
    }
    await app.openInvoiceDetail(id);
    const targetPath = pathForTab('invoices', id);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const openCollaboratorDetailWithRoute = async (id: string) => {
    if (tab !== 'collaborators') {
      setTabHistory((history) => [...history, tab]);
      setTab('collaborators');
    }
    await app.openCollaboratorDetail(id);
    const targetPath = pathForTab('collaborators', id);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const openCustomerDetailWithRoute = async (id: string) => {
    if (tab !== 'customers') {
      setTabHistory((history) => [...history, tab]);
      setTab('customers');
    }
    await app.openCustomerDetail(id);
    const targetPath = pathForTab('customers', id);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeOrderDetailWithRoute = () => {
    app.closeOrderDetail();
    const targetPath = pathForTab('orders');
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeInvoiceDetailWithRoute = () => {
    app.closeInvoiceDetail();
    const targetPath = pathForTab('invoices');
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeCollaboratorDetailWithRoute = () => {
    app.closeCollaboratorDetail();
    const targetPath = pathForTab('collaborators');
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeCustomerDetailWithRoute = () => {
    app.closeCustomerDetail();
    const targetPath = pathForTab('customers');
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const openNotificationTarget = (item: { type: 'INVOICE_DUE' | 'ORDER_DUE'; orderId?: string; invoiceId?: string }) => {
    if (item.type === 'INVOICE_DUE' && item.invoiceId) {
      void openInvoiceDetailWithRoute(item.invoiceId);
      return;
    }
    if (item.orderId) {
      void openOrderDetailWithRoute(item.orderId);
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
    openOrderDetail: openOrderDetailWithRoute,
    openInvoiceDetail: openInvoiceDetailWithRoute,
    openCollaboratorDetail: openCollaboratorDetailWithRoute,
    openCustomerDetail: openCustomerDetailWithRoute,
    closeOrderDetail: closeOrderDetailWithRoute,
    closeInvoiceDetail: closeInvoiceDetailWithRoute,
    closeCollaboratorDetail: closeCollaboratorDetailWithRoute,
    closeCustomerDetail: closeCustomerDetailWithRoute,
    currentTab: tab,
    canGoBack: tabHistory.length > 0,
    navigateToTab,
    goBack,
    openNotificationTarget
  };

  const waitingForInitialData = Boolean(app.token) && !app.session && !app.error;
  const showStartupLoader = !bootReady || waitingForInitialData;
  const showOverlayLoader = app.loading && !showStartupLoader;

  return (
    <BestContext.Provider value={contextValue}>
      <ToastContainer
        position="top-left"
        rtl
        theme={theme}
        autoClose={4300}
        pauseOnHover
        pauseOnFocusLoss
        hideProgressBar={false}
        closeOnClick
        draggable
        newestOnTop={false}
        stacked
        toastClassName="best-toast"
        progressClassName="best-toast-progress"
      />
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
                    <p className="text-xl font-extrabold tracking-tight text-primary">توربست</p>
                    <p className="text-xs text-muted-foreground">پنل حسابداری تولیدی</p>
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
                    visibleTabs={visibleTabs}
                    onItemClick={() => setMobileSidebarOpen(false)}
                    onDisabledItemClick={openComingSoon}
                  />
                </div>

                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                  {sidebarCollapsed ? (
                    <div className="text-center text-[9px] font-medium text-muted-foreground">
                      <span>{PROJECT_VERSION}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <span>نسخه {PROJECT_VERSION}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        ساخته شده با
                        <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                      </span>
                    </div>
                  )}
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

          {showOverlayLoader ? (
            <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/28 backdrop-blur-[1.5px] dark:bg-slate-950/45">
              <div className="rounded-2xl border border-slate-300/90 bg-white/96 p-5 shadow-xl dark:border-slate-700/90 dark:bg-slate-900/92">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-300 border-t-primary dark:border-slate-700 dark:border-t-primary" />
              </div>
            </div>
          ) : null}

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

          {showStartupLoader ? (
            <div className="fixed inset-0 z-[260] flex items-center justify-center bg-background/96 backdrop-blur-[2px]">
              <div className="flex w-[min(26rem,92vw)] flex-col items-center gap-4 rounded-2xl border border-slate-300/90 bg-white/95 px-6 py-8 shadow-xl dark:border-slate-700/90 dark:bg-slate-900/95">
                <div className="relative">
                  <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                  <div className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">در حال آماده‌سازی پنل</p>
                  <p className="text-xs text-muted-foreground sm:text-sm">لطفا چند لحظه صبر کنید...</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        content
      )}
    </BestContext.Provider>
  );
}
