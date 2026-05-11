import { createContext, useContext } from 'react';
import { ActivityLog, BackupLog, DashboardStats, Invoice, MeshType, Order, Permission, Person, Role, SessionUser, User } from '../types/models';

export type BestState = {
  token: string | null;
  session: SessionUser | null;
  loading: boolean;
  error: string;
  search: string;
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
  collaboratorDetail: any;
  customerDetail: any;
};

export type BestActions = {
  setSearch: (value: string) => void;
  setToken: (value: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  reload: () => Promise<void>;
  createUser: (payload: { firstName: string; lastName: string; username: string; password: string; roleKey: string }) => Promise<void>;
  updateRolePermissions: (roleKey: string, permissionKeys: string[]) => Promise<void>;
  createMeshType: (payload: Record<string, unknown>) => Promise<void>;
  createCollaborator: (payload: Record<string, unknown>) => Promise<void>;
  createCustomer: (payload: Record<string, unknown>) => Promise<void>;
  createOrder: (payload: Record<string, unknown>) => Promise<void>;
  updateOrder: (orderId: string, payload: Record<string, unknown>) => Promise<void>;
  createInvoice: (payload: Record<string, unknown>) => Promise<void>;
  updateInvoice: (invoiceId: string, payload: Record<string, unknown>) => Promise<void>;
  runBackup: () => Promise<void>;
  updateBackupSettings: (minutes: number) => Promise<void>;
  loadCollaboratorDetail: (id: string) => Promise<void>;
  loadCustomerDetail: (id: string) => Promise<void>;
  downloadProtected: (url: string, fileName?: string) => Promise<void>;
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
