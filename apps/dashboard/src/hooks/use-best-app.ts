import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ApiError, apiBasePath, apiCall, configureApiAuth } from '../lib/api';
import { ActivityLog, BackupLog, DashboardStats, Invoice, MeshType, NotificationItem, Order, Permission, Person, Role, SessionUser, User } from '../types/models';

const ACCESS_TOKEN_KEY = 'best_admin_token';
const REFRESH_TOKEN_KEY = 'best_admin_refresh_token';
const DISMISSED_NOTIFICATIONS_KEY = 'best_dismissed_notifications';

const tokenIssuedAt = (token: string | null) => {
  if (!token) return 0;
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { iat?: number };
    return typeof parsed.iat === 'number' ? parsed.iat : 0;
  } catch {
    return 0;
  }
};

const normalizeErrorMessage = (error: unknown, fallback = 'Ø®Ø·Ø§ Ø¯Ø± Ø§Ù†Ø¬Ø§Ù… Ø¹Ù…Ù„ÛŒØ§Øª') => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

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
  const [invoiceDetail, setInvoiceDetail] = useState<any>(null);
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
    const currentRefresh = refreshTokenRef.current;
    if (currentRefresh && nextRefresh) {
      const currentRefreshIat = tokenIssuedAt(currentRefresh);
      const nextRefreshIat = tokenIssuedAt(nextRefresh);
      if (nextRefreshIat > 0 && currentRefreshIat > 0 && nextRefreshIat < currentRefreshIat) {
        return;
      }
    }

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
    setInvoiceDetail(null);
  };

  const setToken = (value: string | null) => {
    setAuthTokens(value, value ? refreshTokenRef.current : null);
  };

  const logout = () => {
    setAuthTokens(null, null);
    setSession(null);
    clearDetails();
  };

  const tryAdminCall = async <T,>(path: string, accessToken: string, fallback: T): Promise<T> => {
    try {
      return await apiCall<T>(path, accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        return fallback;
      }
      throw error;
    }
  };

  const reload = async () => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const me = await apiCall<SessionUser>('/auth/me', accessToken);

      const [dashboardData, meshData, collaboratorData, customerData, orderData, invoiceData] = await Promise.all([
        apiCall<DashboardStats>('/reports/dashboard', accessToken),
        apiCall<MeshType[]>('/mesh-types', accessToken),
        apiCall<Person[]>('/collaborators', accessToken),
        apiCall<Person[]>('/customers', accessToken),
        apiCall<Order[]>('/orders', accessToken),
        apiCall<Invoice[]>('/invoices', accessToken)
      ]);

      const isManager = me.roleKeys.includes('manager');
      const [backupData, activityData, userData, roleData, permissionData, settings] = isManager
        ? await Promise.all([
            tryAdminCall<BackupLog[]>('/backups/logs', accessToken, []),
            tryAdminCall<ActivityLog[]>('/operation-logs?limit=100', accessToken, []),
            tryAdminCall<User[]>('/users', accessToken, []),
            tryAdminCall<Role[]>('/roles', accessToken, []),
            tryAdminCall<Permission[]>('/permissions', accessToken, []),
            tryAdminCall<{ backupIntervalMinutes: number }>('/backups/settings', accessToken, { backupIntervalMinutes: 1440 })
          ])
        : [[], [], [], [], [], { backupIntervalMinutes: 1440 }];

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
      setError(e instanceof Error ? e.message : 'Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ø§Ø·Ù„Ø§Ø¹Ø§Øª');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const result = await apiCall<{ accessToken: string; refreshToken: string }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setAuthTokens(result.accessToken, result.refreshToken);
      toast.success('ÙˆØ±ÙˆØ¯ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯.');
    } catch (error) {
      const message = normalizeErrorMessage(error, 'Ø®Ø·Ø§ Ø¯Ø± ÙˆØ±ÙˆØ¯ Ø¨Ù‡ Ø³ÛŒØ³ØªÙ…');
      setError(message);
      toast.error(message);
      throw error;
    }
  };

  const postAndReload = async <T = unknown>(
    url: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH' | 'PUT' = 'POST',
    successMessage?: string
  ): Promise<T> => {
    const accessToken = tokenRef.current;
    if (!accessToken) throw new Error('Ù†Ø´Ø³Øª Ú©Ø§Ø±Ø¨Ø± Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª.');
    try {
      const response = await apiCall<T>(url, accessToken, {
        method,
        body: JSON.stringify(payload)
      });
      await reload();
      if (successMessage) {
        toast.success(successMessage);
      }
      return response;
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setError(message);
      toast.error(message);
      throw error;
    }
  };

  const deleteAndReload = async (url: string, successMessage?: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    try {
      await apiCall(url, accessToken, { method: 'DELETE' });
      await reload();
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setError(message);
      toast.error(message);
      throw error;
    }
  };

  const runBackup = async () => {
    const accessToken = tokenRef.current;
    if (!accessToken) return null;
    try {
      const result = await apiCall<{ backupId: string }>('/backups/run', accessToken, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await reload();
      toast.success('Ø¨Ú©Ø§Ù¾ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ø¬Ø±Ø§ Ø´Ø¯.');
      return result;
    } catch (error) {
      const message = normalizeErrorMessage(error, 'Ø®Ø·Ø§ Ø¯Ø± Ø§Ø¬Ø±Ø§ÛŒ Ø¨Ú©Ø§Ù¾');
      setError(message);
      toast.error(message);
      throw error;
    }
  };

  const downloadProtected = async (url: string, fileName?: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;

    try {
      const response = await fetch(`${apiBasePath()}${url}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª ÙØ§ÛŒÙ„');
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
      toast.success('Ø¯Ø§Ù†Ù„ÙˆØ¯ ÙØ§ÛŒÙ„ Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯.');
    } catch (error) {
      const message = normalizeErrorMessage(error, 'Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª ÙØ§ÛŒÙ„');
      setError(message);
      toast.error(message);
      throw error;
    }
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

  const loadInvoiceDetail = async (id: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    const data = await apiCall<any>(`/invoices/${id}`, accessToken);
    setInvoiceDetail(data);
  };

  const openCollaboratorDetail = async (id: string) => {
    setCustomerDetail(null);
    setOrderDetail(null);
    setInvoiceDetail(null);
    await loadCollaboratorDetail(id);
  };

  const openCustomerDetail = async (id: string) => {
    setCollaboratorDetail(null);
    setOrderDetail(null);
    setInvoiceDetail(null);
    await loadCustomerDetail(id);
  };

  const openOrderDetail = async (id: string) => {
    setCollaboratorDetail(null);
    setCustomerDetail(null);
    setInvoiceDetail(null);
    await loadOrderDetail(id);
  };

  const openInvoiceDetail = async (id: string) => {
    setCollaboratorDetail(null);
    setCustomerDetail(null);
    setOrderDetail(null);
    await loadInvoiceDetail(id);
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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCESS_TOKEN_KEY || event.key === REFRESH_TOKEN_KEY) {
        setTokenState(localStorage.getItem(ACCESS_TOKEN_KEY));
        setRefreshTokenState(localStorage.getItem(REFRESH_TOKEN_KEY));
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const notifications = useMemo<NotificationItem[]>(() => {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const normalized = (date?: string | null) => (date ? new Date(date) : null);

    const invoiceItems: NotificationItem[] = invoices
      .filter((invoice) => {
        if (invoice.status === 'PAID') return false;
        const relatedOrders = Array.isArray(invoice.orders) && invoice.orders.length ? invoice.orders : invoice.order ? [invoice.order] : [];
        return relatedOrders.some((order) => order.stage !== 'CANCELLED');
      })
      .flatMap((invoice) => {
        const due = normalized(invoice.dueDate);
        if (!due || due > soonThreshold) return [];
        const level: NotificationItem['level'] = due < now ? 'critical' : 'warning';
        const relatedOrders = Array.isArray(invoice.orders) && invoice.orders.length ? invoice.orders : invoice.order ? [invoice.order] : [];
        const firstOrder = relatedOrders[0];
        const orderLabel = relatedOrders.map((item) => item.orderNumber).join('ØŒ ') || '-';
        return [{
          id: `inv-${invoice.id}`,
          type: 'INVOICE_DUE',
          invoiceId: invoice.id,
          orderId: firstOrder?.id,
          level,
          title: `Ù…ÙˆØ¹Ø¯ Ø³Ø±Ø±Ø³ÛŒØ¯ ÙØ§Ú©ØªÙˆØ± ${invoice.invoiceNumber}`,
          description: `ÙØ§Ú©ØªÙˆØ± Ù…Ø±ØªØ¨Ø· Ø¨Ø§ Ø³ÙØ§Ø±Ø´(Ù‡Ø§ÛŒ) ${orderLabel} Ø¯Ø± ØªØ§Ø±ÛŒØ® ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} Ø³Ø±Ø±Ø³ÛŒØ¯ Ù…ÛŒâ€ŒØ´ÙˆØ¯.`,
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
          title: `Ù…ÙˆØ¹Ø¯ ØªÚ©Ù…ÛŒÙ„ Ø³ÙØ§Ø±Ø´ ${order.orderNumber}`,
          description: `Ù…ÙˆØ¹Ø¯ ØªÚ©Ù…ÛŒÙ„ Ø³ÙØ§Ø±Ø´ Ø¯Ø± ØªØ§Ø±ÛŒØ® ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} Ø§Ø³Øª.`,
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
    invoiceDetail,
    setToken,
    login,
    logout,
    reload,
    createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) =>
      postAndReload('/users', payload, 'POST', 'Ú©Ø§Ø±Ø¨Ø± Ø¬Ø¯ÛŒØ¯ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§ÛŒØ¬Ø§Ø¯ Ø´Ø¯.'),
    removeUser: (userId: string) => deleteAndReload(`/users/${userId}`, 'Ú©Ø§Ø±Ø¨Ø± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    updateRolePermissions: (roleKey: string, permissionKeys: string[]) =>
      postAndReload(`/permissions/roles/${roleKey}`, { permissionKeys }, 'PUT', 'Ø¯Ø³ØªØ±Ø³ÛŒâ€ŒÙ‡Ø§ÛŒ Ù†Ù‚Ø´ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯.'),
    createMeshType: (payload: Record<string, unknown>) => postAndReload('/mesh-types', payload, 'POST', 'نوع توری با موفقیت ایجاد شد.'),
    updateMeshType: (meshTypeId: string, payload: Record<string, unknown>) =>
      postAndReload(/mesh-types/, payload, 'PATCH', 'نوع توری با موفقیت بروزرسانی شد.'),
    removeMeshType: (meshTypeId: string) => deleteAndReload(`/mesh-types/${meshTypeId}`, 'Ù†ÙˆØ¹ ØªÙˆØ±ÛŒ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    createCollaborator: (payload: Record<string, unknown>) => postAndReload('/collaborators', payload, 'POST', 'Ù‡Ù…Ú©Ø§Ø± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§ÛŒØ¬Ø§Ø¯ Ø´Ø¯.'),
    removeCollaborator: (collaboratorId: string) => deleteAndReload(`/collaborators/${collaboratorId}`, 'Ù‡Ù…Ú©Ø§Ø± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    createCustomer: (payload: Record<string, unknown>) => postAndReload('/customers', payload, 'POST', 'Ù…Ø´ØªØ±ÛŒ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§ÛŒØ¬Ø§Ø¯ Ø´Ø¯.'),
    removeCustomer: (customerId: string) => deleteAndReload(`/customers/${customerId}`, 'Ù…Ø´ØªØ±ÛŒ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    createOrder: (payload: Record<string, unknown>) => postAndReload('/orders', payload, 'POST', 'Ø³ÙØ§Ø±Ø´ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø«Ø¨Øª Ø´Ø¯.'),
    removeOrder: (orderId: string) => deleteAndReload(`/orders/${orderId}`, 'Ø³ÙØ§Ø±Ø´ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    updateOrder: (orderId: string, payload: Record<string, unknown>) =>
      postAndReload(`/orders/${orderId}`, payload, 'PATCH', 'Ø³ÙØ§Ø±Ø´ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯.'),
    createInvoice: (payload: Record<string, unknown>) => postAndReload('/invoices', payload, 'POST', 'ÙØ§Ú©ØªÙˆØ± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø«Ø¨Øª Ø´Ø¯.'),
    removeInvoice: (invoiceId: string) => deleteAndReload(`/invoices/${invoiceId}`, 'ÙØ§Ú©ØªÙˆØ± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø­Ø°Ù Ø´Ø¯.'),
    updateInvoice: (invoiceId: string, payload: Record<string, unknown>) =>
      postAndReload(`/invoices/${invoiceId}`, payload, 'PATCH', 'ÙØ§Ú©ØªÙˆØ± Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯.'),
    addInvoicePayment: (invoiceId: string, payload: Record<string, unknown>) =>
      postAndReload(`/invoices/${invoiceId}/payments`, payload, 'POST', 'Ù¾Ø±Ø¯Ø§Ø®Øª Ø¬Ø¯ÛŒØ¯ Ø«Ø¨Øª Ø´Ø¯.'),
    runBackup,
    updateBackupSettings: (minutes: number) =>
      postAndReload('/backups/settings', { backupIntervalMinutes: minutes }, 'PUT', 'ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ø¨Ú©Ø§Ù¾ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯.'),
    loadCollaboratorDetail,
    loadCustomerDetail,
    loadOrderDetail,
    loadInvoiceDetail,
    openCollaboratorDetail,
    openCustomerDetail,
    openOrderDetail,
    openInvoiceDetail,
    closeCollaboratorDetail: () => setCollaboratorDetail(null),
    closeCustomerDetail: () => setCustomerDetail(null),
    closeOrderDetail: () => setOrderDetail(null),
    closeInvoiceDetail: () => setInvoiceDetail(null),
    acknowledgeNotification,
    downloadProtected
  };
}

