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
  createdAt?: string;
  userRoles?: Array<{ role?: Role }>;
};

export type MeshType = {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  unitPrice?: number;
  isDefault?: boolean;
  createdAt?: string;
};
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
  title?: string | null;
  customerId?: string | null;
  collaboratorId?: string | null;
  workType: 'NEW_CONSTRUCTION' | 'REPAIR';
  stage: 'RECEIVED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
  totalPrice: number;
  discountAmount: number;
  expectedCompletionDate?: string | null;
  createdAt: string;
  customer?: Person;
  collaborator?: Person | null;
  lineItems?: Array<{
    id: string;
    meshTypeId: string;
    meshType?: MeshType;
    width: number;
    height: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    description?: string | null;
  }>;
  paymentSummary: {
    total: number;
    paidAmount: number;
    remainingAmount: number;
    percent: number;
    status: 'paid' | 'partial' | 'unpaid';
  };
  invoices?: Array<{ id: string }>;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  title?: string | null;
  amount: number;
  discountAmount: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payerType?: 'COLLABORATOR';
  payerId?: string | null;
  dueDate?: string;
  description?: string;
  createdAt: string;
  order?: Order | null;
  orders?: Order[];
  paymentHistory?: Array<{
    id: string;
    amount: number;
    paidAt: string;
    note?: string | null;
    createdBy?: UserRef;
  }>;
};

export type DashboardStats = {
  totalOrders: number;
  totalMeshes?: number;
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
