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

const normalizeErrorMessage = (error: unknown, fallback = 'خطا در انجام عملیات') => {
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
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری اطلاعات');
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
      toast.success('ورود با موفقیت انجام شد.');
    } catch (error) {
      const message = normalizeErrorMessage(error, 'خطا در ورود به سیستم');
      setError(message);
      toast.error(message);
      throw error;
    }
  };

  const postAndReload = async (
    url: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH' | 'PUT' = 'POST',
    successMessage?: string
  ) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    try {
      await apiCall(url, accessToken, {
        method,
        body: JSON.stringify(payload)
      });
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
      toast.success('بکاپ با موفقیت اجرا شد.');
      return result;
    } catch (error) {
      const message = normalizeErrorMessage(error, 'خطا در اجرای بکاپ');
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
        throw new Error('خطا در دریافت فایل');
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
      toast.success('دانلود فایل انجام شد.');
    } catch (error) {
      const message = normalizeErrorMessage(error, 'خطا در دریافت فایل');
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
      .filter((invoice) => invoice.status !== 'PAID' && invoice.order?.stage !== 'CANCELLED')
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
          title: `موعد تکمیل سفارش ${invoice.invoiceNumber}`,
          description: `موعد تکمیل سفارش مرتبط با سفارش ${invoice.order.orderNumber} در تاریخ ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} است.`,
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
          title: `موعد تکمیل سفارش ${order.orderNumber}`,
          description: `موعد تکمیل سفارش در تاریخ ${new Date(due).toLocaleDateString('fa-IR-u-ca-persian')} است.`,
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
    createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) =>
      postAndReload('/users', payload, 'POST', 'کاربر جدید با موفقیت ایجاد شد.'),
    removeUser: (userId: string) => deleteAndReload(`/users/${userId}`, 'کاربر با موفقیت حذف شد.'),
    updateRolePermissions: (roleKey: string, permissionKeys: string[]) =>
      postAndReload(`/permissions/roles/${roleKey}`, { permissionKeys }, 'PUT', 'دسترسی‌های نقش با موفقیت ذخیره شد.'),
    createMeshType: (payload: Record<string, unknown>) => postAndReload('/mesh-types', payload, 'POST', 'نوع توری با موفقیت ایجاد شد.'),
    removeMeshType: (meshTypeId: string) => deleteAndReload(`/mesh-types/${meshTypeId}`, 'نوع توری با موفقیت حذف شد.'),
    createCollaborator: (payload: Record<string, unknown>) => postAndReload('/collaborators', payload, 'POST', 'همکار با موفقیت ایجاد شد.'),
    removeCollaborator: (collaboratorId: string) => deleteAndReload(`/collaborators/${collaboratorId}`, 'همکار با موفقیت حذف شد.'),
    createCustomer: (payload: Record<string, unknown>) => postAndReload('/customers', payload, 'POST', 'مشتری با موفقیت ایجاد شد.'),
    removeCustomer: (customerId: string) => deleteAndReload(`/customers/${customerId}`, 'مشتری با موفقیت حذف شد.'),
    createOrder: (payload: Record<string, unknown>) => postAndReload('/orders', payload, 'POST', 'سفارش با موفقیت ثبت شد.'),
    removeOrder: (orderId: string) => deleteAndReload(`/orders/${orderId}`, 'سفارش با موفقیت حذف شد.'),
    updateOrder: (orderId: string, payload: Record<string, unknown>) =>
      postAndReload(`/orders/${orderId}`, payload, 'PATCH', 'سفارش با موفقیت به‌روزرسانی شد.'),
    createInvoice: (payload: Record<string, unknown>) => postAndReload('/invoices', payload, 'POST', 'فاکتور با موفقیت ثبت شد.'),
    removeInvoice: (invoiceId: string) => deleteAndReload(`/invoices/${invoiceId}`, 'فاکتور با موفقیت حذف شد.'),
    updateInvoice: (invoiceId: string, payload: Record<string, unknown>) =>
      postAndReload(`/invoices/${invoiceId}`, payload, 'PATCH', 'فاکتور با موفقیت به‌روزرسانی شد.'),
    runBackup,
    updateBackupSettings: (minutes: number) =>
      postAndReload('/backups/settings', { backupIntervalMinutes: minutes }, 'PUT', 'تنظیمات بکاپ با موفقیت ذخیره شد.'),
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
