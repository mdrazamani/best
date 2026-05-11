import { useMemo, useState } from 'react';
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

export function App() {
  const app = useBestApp();
  const [tab, setTab] = useState<AppTab>('dashboard');

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
        <div className="layout" dir="rtl">
          <AppHeader />
          <AppTabs active={tab} onChange={setTab} />
          {app.loading ? <p className="muted">در حال بارگذاری...</p> : null}
          {app.error ? <p className="error">{app.error}</p> : null}
          {content}
        </div>
      ) : (
        content
      )}
    </BestContext.Provider>
  );
}
