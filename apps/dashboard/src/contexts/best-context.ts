import { createContext, useContext } from 'react';
import { ActivityLog, BackupLog, DashboardStats, InventoryItem, Invoice, MeshType, NotificationItem, Order, Permission, Person, Role, SessionUser, User } from '../types/models';
import type { AppTab } from '../components/layout/AppTabs';

export type BestState = {
  token: string | null;
  session: SessionUser | null;
  loading: boolean;
  error: string;
  dashboard: DashboardStats | null;
  meshTypes: MeshType[];
  inventoryItems: InventoryItem[];
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
  invoiceDetail: any;
  currentTab: AppTab;
  canGoBack: boolean;
};

export type BestActions = {
  setToken: (value: string | null) => void;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  reload: () => Promise<any>;
  createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) => Promise<any>;
  removeUser: (userId: string) => Promise<any>;
  updateRolePermissions: (roleKey: string, permissionKeys: string[]) => Promise<any>;
  createMeshType: (payload: Record<string, unknown>) => Promise<any>;
  updateMeshType: (meshTypeId: string, payload: Record<string, unknown>) => Promise<any>;
  removeMeshType: (meshTypeId: string) => Promise<any>;
  createInventoryItem: (payload: Record<string, unknown>) => Promise<any>;
  adjustInventoryItem: (itemId: string, payload: Record<string, unknown>) => Promise<any>;
  removeInventoryItem: (itemId: string) => Promise<any>;
  createCollaborator: (payload: Record<string, unknown>) => Promise<any>;
  removeCollaborator: (collaboratorId: string) => Promise<any>;
  createCustomer: (payload: Record<string, unknown>) => Promise<any>;
  removeCustomer: (customerId: string) => Promise<any>;
  createOrder: (payload: Record<string, unknown>) => Promise<any>;
  removeOrder: (orderId: string) => Promise<any>;
  updateOrder: (orderId: string, payload: Record<string, unknown>) => Promise<any>;
  createInvoice: (payload: Record<string, unknown>) => Promise<any>;
  removeInvoice: (invoiceId: string) => Promise<any>;
  updateInvoice: (invoiceId: string, payload: Record<string, unknown>) => Promise<any>;
  addInvoicePayment: (invoiceId: string, payload: Record<string, unknown>) => Promise<any>;
  runBackup: () => Promise<{ backupId: string } | null>;
  updateBackupSettings: (minutes: number) => Promise<any>;
  loadCollaboratorDetail: (id: string) => Promise<any>;
  loadCustomerDetail: (id: string) => Promise<any>;
  loadOrderDetail: (id: string) => Promise<any>;
  loadInvoiceDetail: (id: string) => Promise<any>;
  openCollaboratorDetail: (id: string) => Promise<any>;
  openCustomerDetail: (id: string) => Promise<any>;
  openOrderDetail: (id: string) => Promise<any>;
  openInvoiceDetail: (id: string) => Promise<any>;
  closeCollaboratorDetail: () => void;
  closeCustomerDetail: () => void;
  closeOrderDetail: () => void;
  closeInvoiceDetail: () => void;
  acknowledgeNotification: (notificationId: string) => void;
  downloadProtected: (url: string, fileName?: string) => Promise<any>;
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
