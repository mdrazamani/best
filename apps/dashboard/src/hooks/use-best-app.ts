import { useEffect, useMemo, useState } from 'react';
import { apiBasePath, apiCall } from '../lib/api';
import { ActivityLog, BackupLog, DashboardStats, Invoice, MeshType, Order, Permission, Person, Role, SessionUser, User } from '../types/models';

const TOKEN_KEY = 'best_admin_token';
const IDLE_MS = 30 * 60 * 1000;

export function useBestApp() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
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

  const setToken = (value: string | null) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(value);
  };

  const logout = () => {
    setToken(null);
    setSession(null);
  };

  const reload = async () => {
    if (!token) return;

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
        apiCall<SessionUser>('/auth/me', token),
        apiCall<DashboardStats>('/reports/dashboard', token),
        apiCall<MeshType[]>(`/mesh-types${search ? `?q=${encodeURIComponent(search)}` : ''}`, token),
        apiCall<Person[]>(`/collaborators${search ? `?q=${encodeURIComponent(search)}` : ''}`, token),
        apiCall<Person[]>(`/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`, token),
        apiCall<Order[]>(`/orders${search ? `?q=${encodeURIComponent(search)}` : ''}`, token),
        apiCall<Invoice[]>(`/invoices${search ? `?q=${encodeURIComponent(search)}` : ''}`, token),
        apiCall<BackupLog[]>('/backups/logs', token),
        apiCall<ActivityLog[]>('/operation-logs?limit=100', token),
        apiCall<User[]>('/users', token),
        apiCall<Role[]>('/roles', token),
        apiCall<Permission[]>('/permissions', token),
        apiCall<{ backupIntervalMinutes: number }>('/backups/settings', token)
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
      setError(
        e instanceof Error ? e.message : '\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u0637\u0644\u0627\u0639\u0627\u062a'
      );
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const result = await apiCall<{ accessToken: string }>('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(result.accessToken);
  };

  const postAndReload = async (url: string, payload: Record<string, unknown>, method: 'POST' | 'PATCH' | 'PUT' = 'POST') => {
    if (!token) return;
    await apiCall(url, token, {
      method,
      body: JSON.stringify(payload)
    });
    await reload();
  };

  const downloadProtected = async (url: string, fileName?: string) => {
    if (!token) return;

    const response = await fetch(`${apiBasePath()}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0641\u0627\u06cc\u0644');
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
    if (!token) return;
    const data = await apiCall<any>(`/collaborators/${id}`, token);
    setCollaboratorDetail(data);
  };

  const loadCustomerDetail = async (id: string) => {
    if (!token) return;
    const data = await apiCall<any>(`/customers/${id}`, token);
    setCustomerDetail(data);
  };

  useEffect(() => {
    void reload();
  }, [token, search]);

  useEffect(() => {
    if (!token) return;

    let timer = window.setTimeout(logout, IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, IDLE_MS);
    };

    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((eventName) => {
      window.addEventListener(eventName, reset);
    });

    return () => {
      window.clearTimeout(timer);
      ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((eventName) => {
        window.removeEventListener(eventName, reset);
      });
    };
  }, [token]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    return orders.filter((item) =>
      item.orderNumber.includes(search) ||
      `${item.customer?.firstName ?? ''} ${item.customer?.lastName ?? ''}`.includes(search) ||
      `${item.collaborator?.firstName ?? ''} ${item.collaborator?.lastName ?? ''}`.includes(search)
    );
  }, [orders, search]);

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    return invoices.filter((item) => item.invoiceNumber.includes(search) || item.order.orderNumber.includes(search));
  }, [invoices, search]);

  return {
    token,
    session,
    loading,
    error,
    search,
    dashboard,
    meshTypes,
    collaborators,
    customers,
    orders: filteredOrders,
    invoices: filteredInvoices,
    backups,
    activity,
    users,
    roles,
    permissions,
    backupInterval,
    collaboratorDetail,
    customerDetail,
    setSearch,
    setToken,
    login,
    logout,
    reload,
    createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) => postAndReload('/users', payload),
    updateRolePermissions: (roleKey: string, permissionKeys: string[]) => postAndReload(`/permissions/roles/${roleKey}`, { permissionKeys }, 'PUT'),
    createMeshType: (payload: Record<string, unknown>) => postAndReload('/mesh-types', payload),
    createCollaborator: (payload: Record<string, unknown>) => postAndReload('/collaborators', payload),
    createCustomer: (payload: Record<string, unknown>) => postAndReload('/customers', payload),
    createOrder: (payload: Record<string, unknown>) => postAndReload('/orders', payload),
    updateOrder: (orderId: string, payload: Record<string, unknown>) => postAndReload(`/orders/${orderId}`, payload, 'PATCH'),
    createInvoice: (payload: Record<string, unknown>) => postAndReload('/invoices', payload),
    updateInvoice: (invoiceId: string, payload: Record<string, unknown>) => postAndReload(`/invoices/${invoiceId}`, payload, 'PATCH'),
    runBackup: () => postAndReload('/backups/run', {}),
    updateBackupSettings: (minutes: number) => postAndReload('/backups/settings', { backupIntervalMinutes: minutes }, 'PUT'),
    loadCollaboratorDetail,
    loadCustomerDetail,
    downloadProtected
  };
}
