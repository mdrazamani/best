export type OrderStatus = 'received' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid';
export type WorkType = 'new_construction' | 'repair';

export type OrderLineItem = {
  id: string;
  meshTypeId: string;
  meshTitle: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  total: number;
  description: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
};

export type Collaborator = {
  id: string;
  name: string;
  phone: string;
  role: string;
  note: string;
  createdAt: string;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  collaboratorId: string;
  collaboratorName: string;
  title: string;
  status: OrderStatus;
  workType: WorkType;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  lineItems: OrderLineItem[];
  dueDate: string;
  note: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  orderId: string;
  orderTitle: string;
  customerName: string;
  title: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
  dueDate: string;
  note: string;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  note: string;
};

export type MeshType = {
  id: string;
  title: string;
  unitPrice: number;
  isActive: number;
  isDefault: number;
  note: string;
};

export type LocalUser = {
  id: string;
  username: string;
  name: string;
  role: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  seen: number;
  createdAt: string;
};

export type Activity = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
};

export type AppSnapshot = {
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
  inventory: InventoryItem[];
  collaborators: Collaborator[];
  meshTypes: MeshType[];
  users: LocalUser[];
  notifications: NotificationItem[];
  activities: Activity[];
};

export type DashboardStats = {
  customers: number;
  activeOrders: number;
  unpaidTotal: number;
  lowStock: number;
  todayOrders: number;
};

export type ReportSummary = {
  totalSales: number;
  received: number;
  remaining: number;
  paidInvoices: number;
  unpaidInvoices: number;
  cancelledOrders: number;
  deliveredOrders: number;
  inventoryValue: number;
};

export type NewCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
};

export type NewCollaboratorInput = {
  name: string;
  phone?: string;
  role?: string;
  note?: string;
};

export type NewOrderInput = {
  customerId: string;
  collaboratorId?: string;
  title: string;
  workType?: WorkType;
  discount?: number;
  lineItems?: Array<Omit<OrderLineItem, 'id' | 'total'>>;
  dueDate?: string;
  note?: string;
};

export type NewInvoiceInput = {
  orderId: string;
  title?: string;
  amount: number;
  paid?: number;
  dueDate?: string;
  note?: string;
};

export type NewInventoryInput = {
  name: string;
  quantity: number;
  unit?: string;
  minQuantity?: number;
  note?: string;
};

export type NewMeshTypeInput = {
  title: string;
  unitPrice: number;
  isActive?: boolean;
  isDefault?: boolean;
  note?: string;
};

export type NewUserInput = {
  username: string;
  name: string;
  pin: string;
  role?: string;
};

export type UpdateCustomerInput = Partial<NewCustomerInput> & { id: string };
export type UpdateInventoryInput = Partial<NewInventoryInput> & { id: string };
export type UpdateCollaboratorInput = Partial<NewCollaboratorInput> & { id: string };
export type UpdateMeshTypeInput = Partial<NewMeshTypeInput> & { id: string };
export type UpdateUserInput = Partial<Omit<NewUserInput, 'pin'>> & { id: string; pin?: string };
export type UpdateOrderInput = Partial<NewOrderInput> & { id: string };
export type UpdateInvoiceInput = Partial<NewInvoiceInput> & { id: string };
