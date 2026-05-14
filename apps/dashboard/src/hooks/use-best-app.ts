import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiBasePath, apiCall, configureApiAuth } from '../lib/api';
import { ActivityLog, BackupLog, DashboardStats, Invoice, MeshType, NotificationItem, Order, Permission, Person, Role, SessionUser, User } from '../types/models';

const ACCESS_TOKEN_KEY = 'best_admin_token';
const REFRESH_TOKEN_KEY = 'best_admin_refresh_token';
const DISMISSED_NOTIFICATIONS_KEY = 'best_dismissed_notifications';

export function useBestApp() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshTokenState] = useState<string | null>(() => localStorage.getItem(REFRESH_TOKEN_KEY));
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [meshTypes, setMeshTypes] = useState<MeshType[]>([]);
  const [collaborators, setCollaborators] = useState<Person[]>([]);
  const [customers, setCustomers] = useState<Person[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [backupInterval, setBackupInterval] = useState(1440);
  const [collaboratorDetail, setCollaboratorDetail] = useState<any>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });

  const tokenRef = useRef<string | null>(token);
  const refreshTokenRef = useRef<string | null>(refreshToken);

  const setAuthTokens = (nextAccess: string | null, nextRefresh: string | null) => {
    tokenRef.current = nextAccess;
    refreshTokenRef.current = nextRefresh;

    if (nextAccess) localStorage.setItem(ACCESS_TOKEN_KEY, nextAccess);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);

    if (nextRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, nextRefresh);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);

    setTokenState(nextAccess);
    setRefreshTokenState(nextRefresh);
  };

  const clearDetails = () => {
    setCollaboratorDetail(null);
    setCustomerDetail(null);
    setOrderDetail(null);
  };

  const setToken = (value: string | null) => {
    setAuthTokens(value, value ? refreshTokenRef.current : null);
  };

  const logout = () => {
    setAuthTokens(null, null);
    setSession(null);
    clearDetails();
  };

  const reload = async () => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const [
        me,
        dashboardData,
        meshData,
        collaboratorData,
        customerData,
        orderData,
        invoiceData,
        backupData,
        activityData,
        userData,
        roleData,
        permissionData,
        settings
      ] = await Promise.all([
        apiCall<SessionUser>('/auth/me', accessToken),
        apiCall<DashboardStats>('/reports/dashboard', accessToken),
        apiCall<MeshType[]>('/mesh-types', accessToken),
        apiCall<Person[]>('/collaborators', accessToken),
        apiCall<Person[]>('/customers', accessToken),
        apiCall<Order[]>('/orders', accessToken),
        apiCall<Invoice[]>('/invoices', accessToken),
        apiCall<BackupLog[]>('/backups/logs', accessToken),
        apiCall<ActivityLog[]>('/operation-logs?limit=100', accessToken),
        apiCall<User[]>('/users', accessToken),
        apiCall<Role[]>('/roles', accessToken),
        apiCall<Permission[]>('/permissions', accessToken),
        apiCall<{ backupIntervalMinutes: number }>('/backups/settings', accessToken)
      ]);

      setSession(me);
      setDashboard(dashboardData);
      setMeshTypes(meshData);
      setCollaborators(collaboratorData);
      setCustomers(customerData);
      setOrders(orderData);
      setInvoices(invoiceData);
      setBackups(backupData);
      setActivity(activityData);
      setUsers(userData);
      setRoles(roleData);
      setPermissions(permissionData);
      setBackupInterval(settings.backupIntervalMinutes);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout();
      }
      setError(e instanceof Error ? e.message : '??? ?? ?????? ???????');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const result = await apiCall<{ accessToken: string; refreshToken: string }>('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setAuthTokens(result.accessToken, result.refreshToken);
  };

  const postAndReload = async (url: string, payload: Record<string, unknown>, method: 'POST' | 'PATCH' | 'PUT' = 'POST') => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    await apiCall(url, accessToken, {
      method,
      body: JSON.stringify(payload)
    });
    await reload();
  };

  const deleteAndReload = async (url: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    await apiCall(url, accessToken, { method: 'DELETE' });
    await reload();
  };

  const runBackup = async () => {
    const accessToken = tokenRef.current;
    if (!accessToken) return null;
    const result = await apiCall<{ backupId: string }>('/backups/run', accessToken, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await reload();
    return result;
  };

  const downloadProtected = async (url: string, fileName?: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;

    const response = await fetch(`${apiBasePath()}${url}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('??? ?? ?????? ????');
    }

    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    if (fileName) a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const loadCollaboratorDetail = async (id: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    const data = await apiCall<any>(`/collaborators/${id}`, accessToken);
    setCollaboratorDetail(data);
  };

  const loadCustomerDetail = async (id: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    const data = await apiCall<any>(`/customers/${id}`, accessToken);
    setCustomerDetail(data);
  };

  const loadOrderDetail = async (id: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    const data = await apiCall<any>(`/orders/${id}`, accessToken);
    setOrderDetail(data);
  };

  const openCollaboratorDetail = async (id: string) => {
    setCustomerDetail(null);
    setOrderDetail(null);
    await loadCollaboratorDetail(id);
  };

  const openCustomerDetail = async (id: string) => {
    setCollaboratorDetail(null);
    setOrderDetail(null);
    await loadCustomerDetail(id);
  };

  const openOrderDetail = async (id: string) => {
    setCollaboratorDetail(null);
    setCustomerDetail(null);
    await loadOrderDetail(id);
  };

  const acknowledgeNotification = (notificationId: string) => {
    setDismissedNotifications((prev) => {
      if (prev.includes(notificationId)) return prev;
      const next = [...prev, notificationId];
      localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => tokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      setTokens: ({ accessToken, refreshToken: newRefreshToken }) => setAuthTokens(accessToken, newRefreshToken),
      onAuthFailure: () => logout()
    });

    return () => {
      configureApiAuth(null);
    };
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    void reload();
  }, [token]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const normalized = (date?: string | null) => (date ? new Date(date) : null);

    const invoiceItems: NotificationItem[] = invoices
      .filter((invoice) => invoice.status !== 'PAID')
      .flatMap((invoice) => {
        const due = normalized(invoice.dueDate);
        if (!due || due > soonThreshold) return [];
        const level: NotificationItem['level'] = due < now ? 'critical' : 'warning';
        return [{
          id: `inv-${invoice.id}`,
          type: 'INVOICE_DUE',
          invoiceId: invoice.id,
          orderId: invoice.order.id,
          level,
          title: `???? ?????? ${invoice.invoiceNumber}`,
          description: `???? ?????? ?????? ????? ${invoice.order.orderNumber} ?? ????? ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} ???.`,
          dueDate: due.toISOString()
        }];
      });

    const orderItems: NotificationItem[] = orders
      .filter((order) => order.stage !== 'DELIVERED' && order.stage !== 'CANCELLED')
      .flatMap((order) => {
        const due = normalized(order.expectedCompletionDate);
        if (!due || due > soonThreshold) return [];
        const level: NotificationItem['level'] = due < now ? 'critical' : 'warning';
        return [{
          id: `ord-${order.id}`,
          type: 'ORDER_DUE',
          orderId: order.id,
          level,
          title: `???? ????? ????? ${order.orderNumber}`,
          description: `???? ????? ????? ?? ????? ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} ???.`,
          dueDate: due.toISOString()
        }];
      });

    return [...invoiceItems, ...orderItems]
      .filter((item) => !dismissedNotifications.includes(item.id))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [invoices, orders, dismissedNotifications]);

  return {
    token,
    session,
    loading,
    error,
    dashboard,
    meshTypes,
    collaborators,
    customers,
    orders,
    invoices,
    backups,
    activity,
    users,
    roles,
    permissions,
    backupInterval,
    notifications,
    collaboratorDetail,
    customerDetail,
    orderDetail,
    setToken,
    login,
    logout,
    reload,
    createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) => postAndReload('/users', payload),
    removeUser: (userId: string) => deleteAndReload(`/users/${userId}`),
    updateRolePermissions: (roleKey: string, permissionKeys: string[]) => postAndReload(`/permissions/roles/${roleKey}`, { permissionKeys }, 'PUT'),
    createMeshType: (payload: Record<string, unknown>) => postAndReload('/mesh-types', payload),
    removeMeshType: (meshTypeId: string) => deleteAndReload(`/mesh-types/${meshTypeId}`),
    createCollaborator: (payload: Record<string, unknown>) => postAndReload('/collaborators', payload),
    removeCollaborator: (collaboratorId: string) => deleteAndReload(`/collaborators/${collaboratorId}`),
    createCustomer: (payload: Record<string, unknown>) => postAndReload('/customers', payload),
    removeCustomer: (customerId: string) => deleteAndReload(`/customers/${customerId}`),
    createOrder: (payload: Record<string, unknown>) => postAndReload('/orders', payload),
    removeOrder: (orderId: string) => deleteAndReload(`/orders/${orderId}`),
    updateOrder: (orderId: string, payload: Record<string, unknown>) => postAndReload(`/orders/${orderId}`, payload, 'PATCH'),
    createInvoice: (payload: Record<string, unknown>) => postAndReload('/invoices', payload),
    removeInvoice: (invoiceId: string) => deleteAndReload(`/invoices/${invoiceId}`),
    updateInvoice: (invoiceId: string, payload: Record<string, unknown>) => postAndReload(`/invoices/${invoiceId}`, payload, 'PATCH'),
    runBackup,
    updateBackupSettings: (minutes: number) => postAndReload('/backups/settings', { backupIntervalMinutes: minutes }, 'PUT'),
    loadCollaboratorDetail,
    loadCustomerDetail,
    loadOrderDetail,
    openCollaboratorDetail,
    openCustomerDetail,
    openOrderDetail,
    closeCollaboratorDetail: () => setCollaboratorDetail(null),
    closeCustomerDetail: () => setCustomerDetail(null),
    closeOrderDetail: () => setOrderDetail(null),
    acknowledgeNotification,
    downloadProtected
  };
}
