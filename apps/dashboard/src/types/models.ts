export type UserRef = { id: string; firstName?: string; lastName?: string; username?: string };

export type SessionUser = {
  userId: string;
  username: string;
  roleKeys: string[];
  sessionId: string;
};

export type Permission = {
  id: string;
  key: string;
  resource: string;
  apiName: string;
  method: string;
  path: string;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  rolePermissions?: Array<{ permission: Permission }>;
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED';
  userRoles?: Array<{ role?: Role }>;
};

export type MeshType = { id: string; title: string; description?: string; isActive: boolean };
export type Person = {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  description?: string;
  createdAt?: string;
  referredByCollaborator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  } | null;
  _count?: { orders: number };
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  collaboratorId?: string | null;
  workType: 'NEW_CONSTRUCTION' | 'REPAIR';
  stage: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
  totalPrice: number;
  expectedCompletionDate?: string | null;
  createdAt: string;
  customer?: Person;
  collaborator?: Person | null;
  meshType?: MeshType;
  lineItems?: Array<{
    id: string;
    width: number;
    height: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  paymentSummary: {
    total: number;
    paidAmount: number;
    remainingAmount: number;
    percent: number;
    status: 'paid' | 'partial' | 'unpaid';
  };
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payerType?: 'CUSTOMER' | 'COLLABORATOR';
  payerId?: string | null;
  dueDate?: string;
  description?: string;
  createdAt: string;
  order: Order;
};

export type DashboardStats = {
  totalOrders: number;
  ordersToday: number;
  processingOrders: number;
  totalSales: number;
  receivedAmount: number;
  remainingAmount: number;
  unpaidInvoices: number;
};

export type BackupLog = {
  id: string;
  status: string;
  createdAt: string;
  excelFiles: string[];
};

export type ActivityLog = {
  id: string;
  entityType: string;
  action: string;
  description?: string;
  createdAt: string;
  actor?: UserRef;
};

export type NotificationItem = {
  id: string;
  type: 'INVOICE_DUE' | 'ORDER_DUE';
  orderId?: string;
  invoiceId?: string;
  level: 'warning' | 'critical';
  title: string;
  description: string;
  dueDate: string;
};
