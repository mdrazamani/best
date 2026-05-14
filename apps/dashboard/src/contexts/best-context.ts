import { createContext, useContext } from 'react';
import { ActivityLog, BackupLog, DashboardStats, Invoice, MeshType, NotificationItem, Order, Permission, Person, Role, SessionUser, User } from '../types/models';
import type { AppTab } from '../components/layout/AppTabs';

export type BestState = {
  token: string | null;
  session: SessionUser | null;
  loading: boolean;
  error: string;
  dashboard: DashboardStats | null;
  meshTypes: MeshType[];
  collaborators: Person[];
  customers: Person[];
  orders: Order[];
  invoices: Invoice[];
  backups: BackupLog[];
  activity: ActivityLog[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
  backupInterval: number;
  notifications: NotificationItem[];
  collaboratorDetail: any;
  customerDetail: any;
  orderDetail: any;
  currentTab: AppTab;
  canGoBack: boolean;
};

export type BestActions = {
  setToken: (value: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  reload: () => Promise<void>;
  createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateRolePermissions: (roleKey: string, permissionKeys: string[]) => Promise<void>;
  createMeshType: (payload: Record<string, unknown>) => Promise<void>;
  removeMeshType: (meshTypeId: string) => Promise<void>;
  createCollaborator: (payload: Record<string, unknown>) => Promise<void>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;
  createCustomer: (payload: Record<string, unknown>) => Promise<void>;
  removeCustomer: (customerId: string) => Promise<void>;
  createOrder: (payload: Record<string, unknown>) => Promise<void>;
  removeOrder: (orderId: string) => Promise<void>;
  updateOrder: (orderId: string, payload: Record<string, unknown>) => Promise<void>;
  createInvoice: (payload: Record<string, unknown>) => Promise<void>;
  removeInvoice: (invoiceId: string) => Promise<void>;
  updateInvoice: (invoiceId: string, payload: Record<string, unknown>) => Promise<void>;
  runBackup: () => Promise<{ backupId: string } | null>;
  updateBackupSettings: (minutes: number) => Promise<void>;
  loadCollaboratorDetail: (id: string) => Promise<void>;
  loadCustomerDetail: (id: string) => Promise<void>;
  loadOrderDetail: (id: string) => Promise<void>;
  openCollaboratorDetail: (id: string) => Promise<void>;
  openCustomerDetail: (id: string) => Promise<void>;
  openOrderDetail: (id: string) => Promise<void>;
  closeCollaboratorDetail: () => void;
  closeCustomerDetail: () => void;
  closeOrderDetail: () => void;
  acknowledgeNotification: (notificationId: string) => void;
  downloadProtected: (url: string, fileName?: string) => Promise<void>;
  navigateToTab: (tab: AppTab) => void;
  goBack: () => void;
  openNotificationTarget: (item: NotificationItem) => void;
};

export type BestContextType = BestState & BestActions;

export const BestContext = createContext<BestContextType | null>(null);

export const useBestContext = () => {
  const context = useContext(BestContext);
  if (!context) {
    throw new Error('BestContext is missing');
  }
  return context;
};
