import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type {
  Activity,
  AppSnapshot,
  Collaborator,
  CollaboratorPayment,
  Customer,
  DashboardStats,
  InventoryItem,
  Invoice,
  InvoiceStatus,
  LocalUser,
  MeshType,
  NewCollaboratorPaymentInput,
  NewCollaboratorInput,
  NewCustomerInput,
  NewInventoryInput,
  NewInvoiceInput,
  NewMeshTypeInput,
  NewOrderInput,
  NewUserInput,
  NotificationItem,
  Order,
  OrderLineItem,
  OrderStatus,
  ReportSummary,
  WorkType,
  UpdateCollaboratorInput,
  UpdateInvoiceInput,
  UpdateMeshTypeInput,
  UpdateOrderInput,
  UpdateUserInput
} from './types';

const DB_NAME = 'best_mobile';
const STORAGE_KEY = 'best-mobile-local-backend-v2';
const LEGACY_STORAGE_KEY = 'best-mobile-local-backend-v1';
const SESSION_KEY = 'best-mobile-session';
const SESSION_ROLE_KEY = 'best-mobile-session-role';
const ASSISTANT_TABS_KEY = 'best-mobile-assistant-tabs';
const BACKUP_INTERVAL_KEY = 'best-mobile-backup-interval-minutes';
const DEFAULT_ASSISTANT_TABS = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers', 'mesh', 'warehouse', 'notifications'];

type PersistedData = Omit<AppSnapshot, 'users'> & {
  users: Array<LocalUser & { pin: string }>;
};

const now = () => new Date().toISOString();
const addIsoDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizeNumber = (value: number) => (Number.isFinite(value) ? value : 0);
const jalaliDateCode = (dateIso = now()) =>
  new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(dateIso))
    .replace(/[^0-9]/g, '');
const generateInvoiceNumber = (dateIso = now()) => {
  const shortDate = jalaliDateCode(dateIso).slice(-4);
  const randomPart = id().replace(/-/g, '').slice(0, 5).toUpperCase();
  return `IN-${shortDate}-${randomPart}`;
};
const fallbackInvoiceNumber = (invoiceId: string, createdAt?: string) => `IN-${jalaliDateCode(createdAt).slice(-4)}-${invoiceId.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
const invoiceStatus = (amount: number, paid: number): InvoiceStatus => {
  if (paid <= 0) return 'unpaid';
  if (paid >= amount) return 'paid';
  return 'partial';
};
const calculateLineTotal = (width: number, height: number, quantity: number, unitPrice: number) => {
  const areaMeters = (width * height) / 10000;
  return areaMeters > 1 ? areaMeters * quantity * unitPrice : quantity * unitPrice;
};

const parseLineItems = (value: unknown): OrderLineItem[] => {
  if (Array.isArray(value)) return value as OrderLineItem[];
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as OrderLineItem[]) : [];
  } catch {
    return [];
  }
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const makeLineItems = (input: NewOrderInput): OrderLineItem[] => {
  const source = input.lineItems?.length
    ? input.lineItems
    : [{ meshTypeId: '', meshTitle: input.title, width: 1, height: 1, quantity: 1, unitPrice: 0, description: '' }];

  return source.map((item) => {
    const width = normalizeNumber(Number(item.width));
    const height = normalizeNumber(Number(item.height));
    const quantity = normalizeNumber(Number(item.quantity));
    const unitPrice = normalizeNumber(Number(item.unitPrice));
    return {
      id: id(),
      meshTypeId: item.meshTypeId,
      meshTitle: item.meshTitle,
      width,
      height,
      quantity,
      unitPrice,
      total: calculateLineTotal(width, height, quantity, unitPrice),
      description: item.description ?? ''
    };
  });
};

const emptyData = (): PersistedData => ({
  users: [{ id: id(), username: 'admin', pin: '1234', name: 'مدیر', role: 'manager' }],
  customers: [
    {
      id: id(),
      name: 'مشتری نمونه',
      phone: '09120000000',
      address: 'تهران',
      note: 'برای تست اولیه',
      createdAt: now()
    }
  ],
  orders: [],
  invoices: [],
  collaboratorPayments: [],
  collaborators: [
    { id: id(), name: 'همکار نمونه', phone: '09121111111', role: 'نصاب', note: '', createdAt: now() }
  ],
  meshTypes: [
    { id: id(), title: 'پلیسه معمولی', unitPrice: 450000, isActive: 1, isDefault: 1, note: '' },
    { id: id(), title: 'مگنتی', unitPrice: 380000, isActive: 1, isDefault: 0, note: '' }
  ],
  inventory: [
    { id: id(), name: 'توری پلیسه', quantity: 12, unit: 'عدد', minQuantity: 4, note: '' },
    { id: id(), name: 'ریل آلومینیوم', quantity: 28, unit: 'شاخه', minQuantity: 8, note: '' }
  ],
  notifications: [
    { id: id(), title: 'نسخه موبایل آماده است', body: 'داده‌ها در SQLite داخل گوشی ذخیره می‌شوند.', seen: 0, createdAt: now() }
  ],
  activities: []
});

abstract class BaseBackend {
  protected deferMirrorSync = false;

  abstract initialize(): Promise<void>;
  abstract login(username: string, pin: string): Promise<boolean>;
  abstract snapshot(): Promise<AppSnapshot>;
  abstract addCustomer(input: NewCustomerInput): Promise<Customer>;
  abstract updateCustomer(input: { id: string; name?: string; phone?: string; address?: string; note?: string; referredByCollaboratorId?: string }): Promise<void>;
  abstract deleteCustomer(id: string): Promise<void>;
  abstract addCollaborator(input: NewCollaboratorInput): Promise<Collaborator>;
  abstract updateCollaborator(input: UpdateCollaboratorInput): Promise<void>;
  abstract deleteCollaborator(id: string): Promise<void>;
  abstract addOrder(input: NewOrderInput): Promise<void>;
  abstract updateOrder(input: UpdateOrderInput): Promise<void>;
  abstract setOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  abstract deleteOrder(id: string): Promise<void>;
  abstract addInvoice(input: NewInvoiceInput): Promise<void>;
  abstract updateInvoice(input: UpdateInvoiceInput): Promise<void>;
  abstract addInvoicePayment(invoiceId: string, amount: number): Promise<void>;
  abstract addCollaboratorPayment(input: NewCollaboratorPaymentInput): Promise<CollaboratorPayment>;
  abstract deleteInvoice(id: string): Promise<void>;
  abstract addInventoryItem(input: NewInventoryInput): Promise<void>;
  abstract updateInventoryItem(input: { id: string; name?: string; quantity?: number; unit?: string; minQuantity?: number; note?: string }): Promise<void>;
  abstract adjustInventory(itemId: string, delta: number): Promise<void>;
  abstract deleteInventoryItem(id: string): Promise<void>;
  abstract addMeshType(input: NewMeshTypeInput): Promise<void>;
  abstract updateMeshType(input: UpdateMeshTypeInput): Promise<void>;
  abstract deleteMeshType(id: string): Promise<void>;
  abstract addUser(input: NewUserInput): Promise<void>;
  abstract updateUser(input: UpdateUserInput): Promise<void>;
  abstract deleteUser(id: string): Promise<void>;
  abstract markNotificationsSeen(): Promise<void>;
  abstract importSnapshot(snapshot: AppSnapshot): Promise<void>;
  abstract recordBackup(filename: string): Promise<void>;

  isLoggedIn() {
    return globalThis.localStorage?.getItem(SESSION_KEY) === 'active';
  }

  logout() {
    globalThis.localStorage?.removeItem(SESSION_KEY);
    globalThis.localStorage?.removeItem(SESSION_ROLE_KEY);
  }

  getSessionRole() {
    return globalThis.localStorage?.getItem(SESSION_ROLE_KEY) ?? 'assistant';
  }

  protected setSession(role = 'assistant') {
    globalThis.localStorage?.setItem(SESSION_KEY, 'active');
    globalThis.localStorage?.setItem(SESSION_ROLE_KEY, role);
  }

  getAssistantTabs() {
    const stored = globalThis.localStorage?.getItem(ASSISTANT_TABS_KEY);
    if (!stored) return [...DEFAULT_ASSISTANT_TABS];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [...DEFAULT_ASSISTANT_TABS];
    } catch {
      return [...DEFAULT_ASSISTANT_TABS];
    }
  }

  async setAssistantTabs(tabs: string[]) {
    const safeTabs = Array.from(new Set(tabs.filter(Boolean)));
    if (!safeTabs.includes('dashboard')) safeTabs.unshift('dashboard');
    globalThis.localStorage?.setItem(ASSISTANT_TABS_KEY, JSON.stringify(safeTabs));
  }

  getBackupInterval() {
    const stored = Number(globalThis.localStorage?.getItem(BACKUP_INTERVAL_KEY) ?? 1440);
    return Number.isFinite(stored) && stored > 0 ? Math.round(stored) : 1440;
  }

  async setBackupInterval(minutes: number) {
    const safeMinutes = Math.max(1, Math.round(normalizeNumber(minutes)));
    globalThis.localStorage?.setItem(BACKUP_INTERVAL_KEY, String(safeMinutes));
  }

  protected statsFromSnapshot(data: AppSnapshot): DashboardStats {
    const today = new Date().toISOString().slice(0, 10);
    const directPayments = data.collaboratorPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const invoiceRemaining = data.invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
    return {
      customers: data.customers.length,
      activeOrders: data.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
      unpaidTotal: Math.max(invoiceRemaining - directPayments, 0),
      lowStock: data.inventory.filter((item) => item.quantity <= item.minQuantity).length,
      todayOrders: data.orders.filter((order) => order.createdAt.slice(0, 10) === today).length
    };
  }

  async stats() {
    return this.statsFromSnapshot(await this.snapshot());
  }

  async exportJson() {
    return JSON.stringify(await this.snapshot(), null, 2);
  }

  async report(): Promise<ReportSummary> {
    const data = await this.snapshot();
    const totalSales = data.invoices.reduce((sum, item) => sum + item.amount, 0);
    const received = data.invoices.reduce((sum, item) => sum + item.paid, 0) + data.collaboratorPayments.reduce((sum, item) => sum + item.amount, 0);
    return {
      totalSales,
      received,
      remaining: Math.max(totalSales - received, 0),
      paidInvoices: data.invoices.filter((item) => item.status === 'paid').length,
      unpaidInvoices: data.invoices.filter((item) => item.status !== 'paid').length,
      cancelledOrders: data.orders.filter((item) => item.status === 'cancelled').length,
      deliveredOrders: data.orders.filter((item) => item.status === 'delivered').length,
      inventoryValue: data.inventory.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  protected async ensureDemoData() {
    this.deferMirrorSync = true;
    try {
    const initial = await this.snapshot();
    const customers = [
      ['مهدی احمدی', '09121234567', 'تهران، سعادت‌آباد', 'واحد جنوبی، تماس قبل از ارسال'],
      ['سارا رضایی', '09123456780', 'کرج، مهرشهر', 'پنجره پذیرایی اولویت دارد'],
      ['علی محمدی', '09124567890', 'تهران، نارمک', 'هماهنگی با نگهبانی'],
      ['نگار کریمی', '09125678901', 'تهران، پونک', 'توری ضدحساسیت'],
      ['شرکت آریا سازه', '02144000000', 'تهران، شهرک غرب', 'پرداخت شرکتی'],
      ['حسین نادری', '09126789012', 'پردیس، فاز ۸', 'تحویل عصر'],
      ['زهرا موسوی', '09127890123', 'تهران، جنت‌آباد', 'بالکن و اتاق خواب'],
      ['امیر کاظمی', '09128901234', 'تهران، ونک', 'نیاز به نصب فوری']
    ];
    for (const [name, phone, address, note] of customers) {
      if (!initial.customers.some((item) => item.name === name)) await this.addCustomer({ name, phone, address, note });
    }

    const collaborators = [
      ['رضا نصیری', '09121112233', 'نصاب', 'محدوده غرب تهران'],
      ['مجید صالحی', '09122223344', 'اندازه‌گیر', 'محدوده شرق تهران'],
      ['فرهاد یوسفی', '09123334455', 'نصاب', 'تجربه پروژه‌های بزرگ'],
      ['الهام مرادی', '09124445566', 'پشتیبانی', 'هماهنگی تحویل']
    ];
    for (const [name, phone, role, note] of collaborators) {
      if (!initial.collaborators.some((item) => item.name === name)) await this.addCollaborator({ name, phone, role, note });
    }

    const meshTypes = [
      ['پلیسه معمولی', 450000, true, true, 'پرکاربرد برای پنجره'],
      ['مگنتی', 380000, true, false, 'مناسب پنجره‌های کوچک'],
      ['ریلی آلومینیومی', 620000, true, false, 'برای بالکن و درب تراس'],
      ['ثابت اقتصادی', 300000, true, false, 'گزینه اقتصادی'],
      ['ضد گرد و غبار', 720000, true, false, 'پارچه تراکم بالا']
    ];
    for (const [title, unitPrice, isActive, isDefault, note] of meshTypes) {
      if (!initial.meshTypes.some((item) => item.title === title)) await this.addMeshType({ title: String(title), unitPrice: Number(unitPrice), isActive: Boolean(isActive), isDefault: Boolean(isDefault), note: String(note) });
    }

    const inventory = [
      ['توری پلیسه', 48, 'عدد', 10, 'رنگ طوسی و سفید'],
      ['ریل آلومینیوم سفید', 76, 'شاخه', 12, 'شش متری'],
      ['ریل آلومینیوم شامپاینی', 31, 'شاخه', 8, 'موجودی متوسط'],
      ['نخ پلیسه', 18, 'قرقره', 6, 'کیفیت درجه یک'],
      ['مگنت نواری', 9, 'رول', 10, 'نیاز به خرید'],
      ['دستگیره توری', 64, 'عدد', 15, 'سفید و مشکی'],
      ['پیچ نصب', 220, 'عدد', 40, 'ریز و درشت'],
      ['چسب دوطرفه صنعتی', 7, 'رول', 5, 'برای نصب سریع']
    ];
    for (const [name, quantity, unit, minQuantity, note] of inventory) {
      if (!initial.inventory.some((item) => item.name === name)) await this.addInventoryItem({ name: String(name), quantity: Number(quantity), unit: String(unit), minQuantity: Number(minQuantity), note: String(note) });
    }

    const data = await this.snapshot();
    if (data.orders.length >= 10) return;
    const orderDrafts = [
      ['توری پنجره پذیرایی', 0, 0, 'new_construction', 3, 0, 'دو پنجره بزرگ'],
      ['توری اتاق خواب شمالی', 1, 1, 'repair', 5, 50000, 'تعویض پارچه'],
      ['پروژه شرکت آریا', 4, 2, 'new_construction', 7, 250000, 'تحویل مرحله‌ای'],
      ['بالکن واحد ۱۲', 2, 0, 'new_construction', 2, 0, 'ریل مقاوم'],
      ['پنجره آشپزخانه', 3, 1, 'repair', 1, 0, 'اندازه‌گیری مجدد'],
      ['توری ضد گرد و غبار', 6, 2, 'new_construction', 8, 100000, 'پارچه تراکم بالا'],
      ['درب تراس ریلی', 7, 0, 'new_construction', 10, 150000, 'هماهنگی عصر'],
      ['توری ثابت اقتصادی', 5, 1, 'new_construction', 4, 0, 'بودجه محدود'],
      ['سرویس کامل واحد ونک', 7, 2, 'new_construction', 6, 200000, 'سه پنجره و یک بالکن'],
      ['بازسازی توری قدیمی', 1, 0, 'repair', 9, 0, 'تعمیر قاب']
    ] as const;
    const statuses: OrderStatus[] = ['received', 'in_progress', 'ready', 'delivered', 'cancelled'];
    for (const [title, customerIndex, collaboratorIndex, workType, days, discount, note] of orderDrafts) {
      if ((await this.snapshot()).orders.some((item) => item.title === title)) continue;
      const snapshot = await this.snapshot();
      const customer = snapshot.customers[Number(customerIndex) % snapshot.customers.length];
      const collaborator = snapshot.collaborators[Number(collaboratorIndex) % Math.max(snapshot.collaborators.length, 1)];
      const mesh = snapshot.meshTypes[Number(customerIndex) % snapshot.meshTypes.length];
      if (!customer || !mesh) continue;
      await this.addOrder({
        customerId: customer.id,
        collaboratorId: collaborator?.id ?? '',
        title: String(title),
        workType: workType as WorkType,
        dueDate: addIsoDays(Number(days)),
        discount: Number(discount),
        note: String(note),
        lineItems: [
          { meshTypeId: mesh.id, meshTitle: mesh.title, width: 1.2 + (Number(customerIndex) % 3) * 0.25, height: 1.4, quantity: 2 + (Number(customerIndex) % 2), unitPrice: mesh.unitPrice, description: 'آیتم اصلی' },
          { meshTypeId: mesh.id, meshTitle: mesh.title, width: 0.9, height: 1.1, quantity: 1, unitPrice: mesh.unitPrice, description: 'آیتم تکمیلی' }
        ]
      });
      const created = (await this.snapshot()).orders.find((item) => item.title === title);
      if (created) await this.setOrderStatus(created.id, statuses[Number(customerIndex) % statuses.length]);
    }
    } finally {
      this.deferMirrorSync = false;
    }
  }
}

class BrowserBackend extends BaseBackend {
  private data: PersistedData = emptyData();

  async initialize() {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
    this.data = this.normalize(stored ? (JSON.parse(stored) as Partial<PersistedData>) : emptyData());
    await this.persist();
    await this.ensureDemoData();
  }

  async login(username: string, pin: string) {
    const user = this.data.users.find((item) => item.username === username.trim() && item.pin === pin.trim());
    if (user) this.setSession(user.role);
    return Boolean(user);
  }

  async snapshot(): Promise<AppSnapshot> {
    const { customers, orders, invoices, collaboratorPayments, inventory, collaborators, meshTypes, users, notifications, activities } = this.data;
    return {
      customers,
      orders,
      invoices,
      collaboratorPayments,
      inventory,
      collaborators,
      meshTypes,
      users: users.map(({ pin: _pin, ...user }) => user),
      notifications,
      activities
    };
  }

  async addCustomer(input: NewCustomerInput) {
    const customer = { id: id(), name: input.name.trim(), phone: input.phone?.trim() ?? '', address: input.address?.trim() ?? '', note: input.note?.trim() ?? '', referredByCollaboratorId: input.referredByCollaboratorId ?? '', createdAt: now() };
    this.data.customers.unshift(customer);
    this.log('customer', 'مشتری ثبت شد', input.name);
    await this.persist();
    return customer;
  }

  async updateCustomer(input: { id: string; name?: string; phone?: string; address?: string; note?: string; referredByCollaboratorId?: string }) {
    this.data.customers = this.data.customers.map((item) => (item.id === input.id ? { ...item, ...input } : item));
    this.log('customer', 'مشتری ویرایش شد', input.name ?? input.id);
    await this.persist();
  }

  async deleteCustomer(customerId: string) {
    if (this.data.orders.some((order) => order.customerId === customerId)) throw new Error('این مشتری سفارش دارد');
    this.data.customers = this.data.customers.filter((item) => item.id !== customerId);
    this.log('customer', 'مشتری حذف شد', customerId);
    await this.persist();
  }

  async addCollaborator(input: NewCollaboratorInput) {
    const collaborator = { id: id(), name: input.name.trim(), phone: input.phone?.trim() ?? '', role: input.role?.trim() || 'همکار', note: input.note?.trim() ?? '', createdAt: now() };
    this.data.collaborators.unshift(collaborator);
    this.log('collaborator', 'همکار ثبت شد', input.name);
    await this.persist();
    return collaborator;
  }

  async updateCollaborator(input: UpdateCollaboratorInput) {
    this.data.collaborators = this.data.collaborators.map((item) => (item.id === input.id ? { ...item, ...input } : item));
    this.data.orders = this.data.orders.map((order) => order.collaboratorId === input.id ? { ...order, collaboratorName: input.name ?? order.collaboratorName, collaboratorPhone: input.phone ?? order.collaboratorPhone } : order);
    this.log('collaborator', 'همکار ویرایش شد', input.name ?? input.id);
    await this.persist();
  }

  async deleteCollaborator(collaboratorId: string) {
    this.data.collaborators = this.data.collaborators.filter((item) => item.id !== collaboratorId);
    this.data.orders = this.data.orders.map((order) => order.collaboratorId === collaboratorId ? { ...order, collaboratorId: '', collaboratorName: '', collaboratorPhone: '' } : order);
    this.log('collaborator', 'همکار حذف شد', collaboratorId);
    await this.persist();
  }

  async addOrder(input: NewOrderInput) {
    const customer = this.data.customers.find((item) => item.id === input.customerId);
    if (!customer) throw new Error('مشتری انتخاب نشده است');
    const collaborator = this.data.collaborators.find((item) => item.id === input.collaboratorId);
    if (!collaborator) throw new Error('همکار انتخاب نشده است');
    const lineItems = makeLineItems(input);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const discount = normalizeNumber(input.discount ?? 0);
    const total = input.totalPrice === undefined ? Math.max(subtotal - discount, 0) : Math.max(normalizeNumber(input.totalPrice), 0);
    const order: Order = {
      id: id(),
      customerId: customer.id,
      customerName: customer.name,
      collaboratorId: collaborator.id,
      collaboratorName: collaborator.name,
      collaboratorPhone: collaborator.phone,
      title: input.title.trim(),
      status: 'received',
      workType: input.workType ?? 'new_construction',
      quantity: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      unitPrice: lineItems[0]?.unitPrice ?? 0,
      discount,
      total,
      lineItems,
      dueDate: input.dueDate ?? '',
      note: input.note?.trim() ?? '',
      createdAt: now()
    };
    this.data.orders.unshift(order);
    if (input.createInitialInvoice) {
      const invoiceId = id();
      const invoiceCreatedAt = now();
      this.data.invoices.unshift({ id: invoiceId, invoiceNumber: generateInvoiceNumber(invoiceCreatedAt), orderId: order.id, orderIds: [order.id], orderTitle: order.title, customerName: order.customerName, payerId: order.collaboratorId, payerName: order.collaboratorName, title: `فاکتور ${order.title}`, amount: total, paid: 0, discount: order.discount, status: total > 0 ? 'unpaid' : 'paid', dueDate: order.dueDate, note: '', createdAt: invoiceCreatedAt });
    }
    this.log('order', 'سفارش ثبت شد', `${order.title} برای ${order.customerName}`);
    await this.persist();
  }

  async updateOrder(input: UpdateOrderInput) {
    this.data.orders = this.data.orders.map((order) => {
      if (order.id !== input.id) return order;
      const customer = input.customerId ? this.data.customers.find((item) => item.id === input.customerId) : undefined;
      const collaborator = input.collaboratorId ? this.data.collaborators.find((item) => item.id === input.collaboratorId) : undefined;
      const lineItems = input.lineItems ? makeLineItems({ ...order, ...input, title: input.title ?? order.title, customerId: input.customerId ?? order.customerId, lineItems: input.lineItems }) : order.lineItems;
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const discount = normalizeNumber(input.discount ?? order.discount ?? 0);
      const total = input.totalPrice === undefined ? Math.max(subtotal - discount, 0) : Math.max(normalizeNumber(input.totalPrice), 0);
      return {
        ...order,
        customerId: customer?.id ?? input.customerId ?? order.customerId,
        customerName: customer?.name ?? order.customerName,
        collaboratorId: input.collaboratorId === '' ? '' : collaborator?.id ?? order.collaboratorId,
        collaboratorName: input.collaboratorId === '' ? '' : collaborator?.name ?? order.collaboratorName,
        collaboratorPhone: input.collaboratorId === '' ? '' : collaborator?.phone ?? order.collaboratorPhone,
        title: input.title?.trim() ?? order.title,
        workType: input.workType ?? order.workType,
        discount,
        total,
        lineItems,
        quantity: lineItems.reduce((sum, item) => sum + item.quantity, 0),
        unitPrice: lineItems[0]?.unitPrice ?? 0,
        dueDate: input.dueDate ?? order.dueDate,
        note: input.note?.trim() ?? order.note
      };
    });
    const updated = this.data.orders.find((item) => item.id === input.id);
    if (updated) {
      this.data.invoices = this.data.invoices.map((invoice) =>
        invoice.orderId === updated.id
          ? { ...invoice, orderTitle: updated.title, customerName: updated.customerName, amount: invoice.amount === invoice.paid || invoice.paid === 0 ? updated.total : invoice.amount, status: invoiceStatus(invoice.amount === invoice.paid || invoice.paid === 0 ? updated.total : invoice.amount, invoice.paid) }
          : invoice
      );
    }
    this.log('order', 'سفارش ویرایش شد', input.title ?? input.id);
    await this.persist();
  }

  async setOrderStatus(orderId: string, status: OrderStatus) {
    this.data.orders = this.data.orders.map((order) => (order.id === orderId ? { ...order, status } : order));
    this.log('order', 'وضعیت سفارش تغییر کرد', status);
    await this.persist();
  }

  async deleteOrder(orderId: string) {
    this.data.orders = this.data.orders.filter((item) => item.id !== orderId);
    this.data.invoices = this.data.invoices.filter((item) => !(item.orderIds?.length ? item.orderIds.includes(orderId) : item.orderId === orderId));
    this.log('order', 'سفارش حذف شد', orderId);
    await this.persist();
  }

  async addInvoice(input: NewInvoiceInput) {
    const orderIds = Array.from(new Set((input.orderIds?.length ? input.orderIds : input.orderId ? [input.orderId] : []).filter(Boolean)));
    const orders = this.data.orders.filter((item) => orderIds.includes(item.id));
    if (!orders.length) throw new Error('سفارش انتخاب نشده است');
    const amount = normalizeNumber(input.amount || orders.reduce((sum, item) => sum + item.total, 0));
    const paid = Math.min(amount, normalizeNumber(input.paid ?? 0));
    const payer = input.payerId ? this.data.collaborators.find((item) => item.id === input.payerId) : this.data.collaborators.find((item) => item.id === orders[0]?.collaboratorId);
    const orderTitle = orders.map((item) => item.title).join('، ');
    const customerName = Array.from(new Set(orders.map((item) => item.customerName).filter(Boolean))).join('، ');
    const invoiceId = id();
    const invoiceCreatedAt = now();
    this.data.invoices.unshift({ id: invoiceId, invoiceNumber: generateInvoiceNumber(invoiceCreatedAt), orderId: orders[0].id, orderIds: orders.map((item) => item.id), orderTitle, customerName, payerId: payer?.id ?? '', payerName: payer?.name ?? '', title: input.title?.trim() || `فاکتور ${orderTitle}`, amount, paid, discount: normalizeNumber(input.discount ?? 0), status: invoiceStatus(amount, paid), dueDate: input.dueDate ?? orders[0]?.dueDate ?? '', note: input.note?.trim() ?? '', createdAt: invoiceCreatedAt });
    this.log('invoice', 'فاکتور ثبت شد', orderTitle);
    await this.persist();
  }

  async updateInvoice(input: UpdateInvoiceInput) {
    this.data.invoices = this.data.invoices.map((invoice) => {
      if (invoice.id !== input.id) return invoice;
      const orderIds = input.orderIds?.length ? input.orderIds : input.orderId ? [input.orderId] : invoice.orderIds;
      const orders = orderIds?.length ? this.data.orders.filter((item) => orderIds.includes(item.id)) : [];
      const payer = input.payerId ? this.data.collaborators.find((item) => item.id === input.payerId) : undefined;
      const amount = normalizeNumber(input.amount ?? invoice.amount);
      const paid = Math.min(amount, normalizeNumber(input.paid ?? invoice.paid));
      return {
        ...invoice,
        orderId: orders[0]?.id ?? invoice.orderId,
        orderIds: orders.length ? orders.map((item) => item.id) : invoice.orderIds,
        orderTitle: orders.length ? orders.map((item) => item.title).join('، ') : invoice.orderTitle,
        customerName: orders.length ? Array.from(new Set(orders.map((item) => item.customerName).filter(Boolean))).join('، ') : invoice.customerName,
        payerId: payer?.id ?? input.payerId ?? invoice.payerId,
        payerName: payer?.name ?? invoice.payerName,
        title: input.title?.trim() ?? invoice.title,
        amount,
        paid,
        discount: normalizeNumber(input.discount ?? invoice.discount ?? 0),
        status: invoiceStatus(amount, paid),
        dueDate: input.dueDate ?? invoice.dueDate,
        note: input.note?.trim() ?? invoice.note
      };
    });
    this.log('invoice', 'فاکتور ویرایش شد', input.title ?? input.id);
    await this.persist();
  }

  async addInvoicePayment(invoiceId: string, amount: number) {
    this.data.invoices = this.data.invoices.map((invoice) => {
      if (invoice.id !== invoiceId) return invoice;
      const paid = Math.min(invoice.amount, invoice.paid + normalizeNumber(amount));
      return { ...invoice, paid, status: invoiceStatus(invoice.amount, paid) };
    });
    this.log('invoice', 'پرداخت ثبت شد', amount.toLocaleString('fa-IR'));
    await this.persist();
  }

  async addCollaboratorPayment(input: NewCollaboratorPaymentInput) {
    const collaborator = this.data.collaborators.find((item) => item.id === input.collaboratorId);
    if (!collaborator) throw new Error('همکار انتخاب نشده است');
    const payment = {
      id: id(),
      collaboratorId: collaborator.id,
      collaboratorName: collaborator.name,
      amount: normalizeNumber(input.amount),
      paidAt: input.paidAt || now().slice(0, 10),
      note: input.note?.trim() ?? '',
      createdAt: now()
    };
    if (payment.amount <= 0) throw new Error('مبلغ پرداخت باید بزرگ‌تر از صفر باشد');
    this.data.collaboratorPayments.unshift(payment);
    this.log('collaborator', 'پرداخت کلی همکار ثبت شد', `${collaborator.name} - ${payment.amount.toLocaleString('fa-IR')}`);
    await this.persist();
    return payment;
  }

  async deleteInvoice(invoiceId: string) {
    this.data.invoices = this.data.invoices.filter((item) => item.id !== invoiceId);
    this.log('invoice', 'فاکتور حذف شد', invoiceId);
    await this.persist();
  }

  async addInventoryItem(input: NewInventoryInput) {
    this.data.inventory.unshift({ id: id(), name: input.name.trim(), quantity: normalizeNumber(input.quantity), unit: input.unit?.trim() || 'عدد', minQuantity: normalizeNumber(input.minQuantity ?? 0), note: input.note?.trim() ?? '' });
    this.log('inventory', 'کالا ثبت شد', input.name);
    await this.persist();
  }

  async updateInventoryItem(input: { id: string; name?: string; quantity?: number; unit?: string; minQuantity?: number; note?: string }) {
    this.data.inventory = this.data.inventory.map((item) => (item.id === input.id ? { ...item, ...input } : item));
    this.log('inventory', 'کالا ویرایش شد', input.name ?? input.id);
    await this.persist();
  }

  async adjustInventory(itemId: string, delta: number) {
    this.data.inventory = this.data.inventory.map((item) => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item);
    this.log('inventory', 'موجودی تغییر کرد', `${delta > 0 ? '+' : ''}${delta}`);
    await this.persist();
  }

  async deleteInventoryItem(itemId: string) {
    this.data.inventory = this.data.inventory.filter((item) => item.id !== itemId);
    this.log('inventory', 'کالا حذف شد', itemId);
    await this.persist();
  }

  async addMeshType(input: NewMeshTypeInput) {
    if (input.isDefault) this.data.meshTypes = this.data.meshTypes.map((item) => ({ ...item, isDefault: 0 }));
    this.data.meshTypes.unshift({ id: id(), title: input.title.trim(), unitPrice: normalizeNumber(input.unitPrice), isActive: input.isActive === false ? 0 : 1, isDefault: input.isDefault ? 1 : 0, note: input.note?.trim() ?? '' });
    this.log('mesh', 'نوع توری ثبت شد', input.title);
    await this.persist();
  }

  async updateMeshType(input: UpdateMeshTypeInput) {
    if (input.isDefault) this.data.meshTypes = this.data.meshTypes.map((item) => ({ ...item, isDefault: 0 }));
    this.data.meshTypes = this.data.meshTypes.map((item) =>
      item.id === input.id
        ? {
            ...item,
            title: input.title ?? item.title,
            unitPrice: input.unitPrice === undefined ? item.unitPrice : normalizeNumber(input.unitPrice),
            isActive: input.isDefault ? 1 : typeof input.isActive === 'boolean' ? (input.isActive ? 1 : 0) : item.isActive,
            isDefault: typeof input.isDefault === 'boolean' ? (input.isDefault ? 1 : 0) : item.isDefault,
            note: input.note ?? item.note
          }
        : item
    );
    this.log('mesh', 'نوع توری ویرایش شد', input.title ?? input.id);
    await this.persist();
  }

  async deleteMeshType(meshTypeId: string) {
    this.data.meshTypes = this.data.meshTypes.filter((item) => item.id !== meshTypeId);
    this.log('mesh', 'نوع توری حذف شد', meshTypeId);
    await this.persist();
  }

  async addUser(input: NewUserInput) {
    if (this.data.users.some((user) => user.username === input.username.trim())) throw new Error('این نام کاربری قبلا ثبت شده است');
    this.data.users.unshift({ id: id(), username: input.username.trim(), pin: input.pin.trim(), name: input.name.trim(), role: input.role?.trim() || 'assistant' });
    this.log('user', 'کاربر ثبت شد', input.username);
    await this.persist();
  }

  async updateUser(input: UpdateUserInput) {
    this.data.users = this.data.users.map((item) => (item.id === input.id ? { ...item, ...input, pin: input.pin?.trim() || item.pin } : item));
    this.log('user', 'کاربر ویرایش شد', input.username ?? input.id);
    await this.persist();
  }

  async deleteUser(userId: string) {
    if (this.data.users.length <= 1) throw new Error('حداقل یک کاربر باید باقی بماند');
    this.data.users = this.data.users.filter((item) => item.id !== userId);
    this.log('user', 'کاربر حذف شد', userId);
    await this.persist();
  }

  async markNotificationsSeen() {
    this.data.notifications = this.data.notifications.map((item) => ({ ...item, seen: 1 }));
    await this.persist();
  }

  async importSnapshot(snapshot: AppSnapshot) {
    const currentUsers = this.data.users;
    this.data = this.normalize({ ...emptyData(), ...snapshot, users: currentUsers });
    this.log('backup', 'بکاپ بازیابی شد', 'داده‌ها از فایل JSON جایگزین شدند');
    await this.persist();
  }

  async recordBackup(filename: string) {
    this.log('backup', 'بکاپ اجرا شد', filename);
    await this.persist();
  }

  private log(type: string, title: string, body: string) {
    this.data.activities.unshift({ id: id(), type, title, body, createdAt: now() });
    this.data.activities = this.data.activities.slice(0, 100);
  }

  private async persist() {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  private normalize(input: Partial<PersistedData>): PersistedData {
    const base = emptyData();
    const customers = input.customers ?? base.customers;
    const collaborators = input.collaborators ?? base.collaborators;
    const orders = (input.orders ?? base.orders).map((order) => normalizeOrder(order as Partial<Order>, customers, collaborators));
    return {
      ...base,
      ...input,
      customers,
      collaborators,
      users: (input.users?.length ? input.users : base.users).map((user) => ({ id: user.id ?? id(), username: user.username, pin: user.pin, name: user.name, role: user.role ?? 'manager' })),
      orders,
      invoices: (input.invoices ?? base.invoices).map((invoice) => normalizeInvoice(invoice as Partial<Invoice>, orders)),
      collaboratorPayments: (input.collaboratorPayments ?? base.collaboratorPayments).map((payment) => ({
        id: payment.id ?? id(),
        collaboratorId: payment.collaboratorId,
        collaboratorName: payment.collaboratorName ?? collaborators.find((item) => item.id === payment.collaboratorId)?.name ?? '',
        amount: normalizeNumber(payment.amount ?? 0),
        paidAt: payment.paidAt ?? payment.createdAt?.slice(0, 10) ?? now().slice(0, 10),
        note: payment.note ?? '',
        createdAt: payment.createdAt ?? now()
      })),
      inventory: input.inventory ?? base.inventory,
      meshTypes: (input.meshTypes ?? base.meshTypes).map((mesh) => ({
        ...mesh,
        isActive: Number(mesh.isActive ?? 1),
        isDefault: Number(mesh.isDefault ?? 0)
      })),
      notifications: input.notifications ?? base.notifications,
      activities: input.activities ?? base.activities
    };
  }
}

class SqliteBackend extends BaseBackend {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private mirrorSyncQueued = false;

  async initialize() {
    const existing = await this.sqlite.isConnection(DB_NAME, false);
    this.db = existing.result
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await this.db.open();
    await this.db.execute(postgresCompatibleSchemaSql);
    await this.db.execute(schemaSql);
    await this.migrate();
    await this.seed();
    await this.ensureDemoData();
    await this.syncPostgresMirror();
  }

  async login(username: string, pin: string) {
    const rows = await this.all<{ id: string; role: string }>('SELECT id, role FROM users WHERE username = ? AND pin = ? LIMIT 1', [username.trim(), pin.trim()]);
    if (rows.length) this.setSession(rows[0]?.role ?? 'assistant');
    return rows.length > 0;
  }

  async snapshot(): Promise<AppSnapshot> {
    const [customers, orders, invoices, collaboratorPayments, inventory, collaborators, meshTypes, users, notifications, activities] = await Promise.all([
      this.all<Customer>('SELECT id, name, phone, address, note, referred_by_collaborator_id as referredByCollaboratorId, created_at as createdAt FROM customers ORDER BY created_at DESC'),
      this.all<Order>(
        `SELECT orders.id, customer_id as customerId, customers.name as customerName, collaborator_id as collaboratorId, collaborator_name as collaboratorName,
          title, status, work_type as workType, quantity, unit_price as unitPrice, discount, total, line_items as lineItems, due_date as dueDate,
          orders.note, orders.created_at as createdAt
         FROM orders JOIN customers ON customers.id = orders.customer_id ORDER BY orders.created_at DESC`
      ),
      this.all<Invoice>('SELECT id, invoice_number as invoiceNumber, order_id as orderId, order_ids as orderIds, order_title as orderTitle, customer_name as customerName, payer_id as payerId, payer_name as payerName, title, amount, paid, discount, status, due_date as dueDate, note, created_at as createdAt FROM invoices ORDER BY created_at DESC'),
      this.all<CollaboratorPayment>('SELECT collaborator_payments.id, collaborator_id as collaboratorId, collaborators.name as collaboratorName, amount, paid_at as paidAt, collaborator_payments.note, collaborator_payments.created_at as createdAt FROM collaborator_payments JOIN collaborators ON collaborators.id = collaborator_payments.collaborator_id ORDER BY paid_at DESC, collaborator_payments.created_at DESC'),
      this.all<InventoryItem>('SELECT id, name, quantity, unit, min_quantity as minQuantity, note FROM inventory ORDER BY name'),
      this.all<Collaborator>('SELECT id, name, phone, role, note, created_at as createdAt FROM collaborators ORDER BY created_at DESC'),
      this.all<MeshType>('SELECT id, title, unit_price as unitPrice, is_active as isActive, is_default as isDefault, note FROM mesh_types ORDER BY is_default DESC, title'),
      this.all<LocalUser>('SELECT id, username, name, role FROM users ORDER BY username'),
      this.all<NotificationItem>('SELECT id, title, body, seen, created_at as createdAt FROM notifications ORDER BY created_at DESC LIMIT 100'),
      this.all<Activity>('SELECT id, type, title, body, created_at as createdAt FROM activities ORDER BY created_at DESC LIMIT 100')
    ]);
    const collaboratorById = new Map(collaborators.map((item) => [item.id, item]));
    const normalizedOrders = orders.map((order) => ({ ...order, collaboratorPhone: collaboratorById.get(order.collaboratorId)?.phone ?? order.collaboratorPhone ?? '', lineItems: parseLineItems(order.lineItems) }));
    return { customers, orders: normalizedOrders, invoices: invoices.map((invoice) => normalizeInvoice(invoice, normalizedOrders)), collaboratorPayments, inventory, collaborators, meshTypes, users, notifications, activities };
  }

  async addCustomer(input: NewCustomerInput) {
    const customer = { id: id(), name: input.name.trim(), phone: input.phone?.trim() ?? '', address: input.address?.trim() ?? '', note: input.note?.trim() ?? '', referredByCollaboratorId: input.referredByCollaboratorId ?? '', createdAt: now() };
    await this.run('INSERT INTO customers (id, name, phone, address, note, referred_by_collaborator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [customer.id, customer.name, customer.phone, customer.address, customer.note, customer.referredByCollaboratorId, customer.createdAt]);
    await this.log('customer', 'مشتری ثبت شد', input.name);
    return customer;
  }

  async updateCustomer(input: { id: string; name?: string; phone?: string; address?: string; note?: string; referredByCollaboratorId?: string }) {
    await this.run('UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), note = COALESCE(?, note), referred_by_collaborator_id = COALESCE(?, referred_by_collaborator_id) WHERE id = ?', [input.name ?? null, input.phone ?? null, input.address ?? null, input.note ?? null, input.referredByCollaboratorId ?? null, input.id]);
    if (input.name) await this.run('UPDATE orders SET customer_name = ? WHERE customer_id = ?', [input.name, input.id]);
    await this.log('customer', 'مشتری ویرایش شد', input.name ?? input.id);
  }

  async deleteCustomer(customerId: string) {
    const linked = await this.all<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?', [customerId]);
    if (linked[0]?.count) throw new Error('این مشتری سفارش دارد');
    await this.run('DELETE FROM customers WHERE id = ?', [customerId]);
    await this.log('customer', 'مشتری حذف شد', customerId);
  }

  async addCollaborator(input: NewCollaboratorInput) {
    const collaborator = { id: id(), name: input.name.trim(), phone: input.phone?.trim() ?? '', role: input.role?.trim() || 'همکار', note: input.note?.trim() ?? '', createdAt: now() };
    await this.run('INSERT INTO collaborators (id, name, phone, role, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [collaborator.id, collaborator.name, collaborator.phone, collaborator.role, collaborator.note, collaborator.createdAt]);
    await this.log('collaborator', 'همکار ثبت شد', input.name);
    return collaborator;
  }

  async updateCollaborator(input: UpdateCollaboratorInput) {
    await this.run('UPDATE collaborators SET name = COALESCE(?, name), phone = COALESCE(?, phone), role = COALESCE(?, role), note = COALESCE(?, note) WHERE id = ?', [input.name ?? null, input.phone ?? null, input.role ?? null, input.note ?? null, input.id]);
    if (input.name) await this.run('UPDATE orders SET collaborator_name = ? WHERE collaborator_id = ?', [input.name, input.id]);
    await this.log('collaborator', 'همکار ویرایش شد', input.name ?? input.id);
  }

  async deleteCollaborator(collaboratorId: string) {
    await this.run("UPDATE orders SET collaborator_id = '', collaborator_name = '' WHERE collaborator_id = ?", [collaboratorId]);
    await this.run('DELETE FROM collaborators WHERE id = ?', [collaboratorId]);
    await this.log('collaborator', 'همکار حذف شد', collaboratorId);
  }

  async addOrder(input: NewOrderInput) {
    const [customer] = await this.all<Customer>('SELECT id, name, phone, address, note, referred_by_collaborator_id as referredByCollaboratorId, created_at as createdAt FROM customers WHERE id = ?', [input.customerId]);
    if (!customer) throw new Error('مشتری انتخاب نشده است');
    const [collaborator] = input.collaboratorId ? await this.all<Collaborator>('SELECT id, name, phone, role, note, created_at as createdAt FROM collaborators WHERE id = ?', [input.collaboratorId]) : [];
    if (!collaborator) throw new Error('همکار انتخاب نشده است');
    const orderId = id();
    const lineItems = makeLineItems(input);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const discount = normalizeNumber(input.discount ?? 0);
    const total = input.totalPrice === undefined ? Math.max(subtotal - discount, 0) : Math.max(normalizeNumber(input.totalPrice), 0);
    await this.run(
      `INSERT INTO orders (id, customer_id, customer_name, collaborator_id, collaborator_name, title, status, work_type, quantity, unit_price, discount, total, line_items, due_date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, customer.id, customer.name, collaborator.id, collaborator.name, input.title.trim(), 'received', input.workType ?? 'new_construction', lineItems.reduce((sum, item) => sum + item.quantity, 0), lineItems[0]?.unitPrice ?? 0, discount, total, JSON.stringify(lineItems), input.dueDate ?? '', input.note?.trim() ?? '', now()]
    );
    if (input.createInitialInvoice) {
      const invoiceId = id();
      const invoiceCreatedAt = now();
      await this.run('INSERT INTO invoices (id, invoice_number, order_id, order_ids, order_title, customer_name, payer_id, payer_name, title, amount, paid, discount, status, due_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, generateInvoiceNumber(invoiceCreatedAt), orderId, JSON.stringify([orderId]), input.title.trim(), customer.name, collaborator.id, collaborator.name, `فاکتور ${input.title.trim()}`, total, 0, discount, total > 0 ? 'unpaid' : 'paid', input.dueDate ?? '', '', invoiceCreatedAt]);
    }
    await this.log('order', 'سفارش ثبت شد', `${input.title} برای ${customer.name}`);
  }

  async updateOrder(input: UpdateOrderInput) {
    const current = (await this.all<Order>('SELECT * FROM orders WHERE id = ?', [input.id]))[0];
    if (!current) return;
    const [customer] = input.customerId ? await this.all<Customer>('SELECT id, name FROM customers WHERE id = ?', [input.customerId]) : [];
    const [collaborator] = input.collaboratorId ? await this.all<Collaborator>('SELECT id, name FROM collaborators WHERE id = ?', [input.collaboratorId]) : [];
    const currentCollaboratorId = (current as unknown as { collaborator_id?: string; collaboratorId?: string }).collaborator_id ?? (current as unknown as { collaboratorId?: string }).collaboratorId ?? '';
    const lineItems = input.lineItems ? makeLineItems({ ...input, title: input.title ?? current.title, customerId: input.customerId ?? current.customerId, collaboratorId: input.collaboratorId ?? currentCollaboratorId }) : parseLineItems((current as unknown as { line_items?: string; lineItems?: string }).line_items ?? (current as unknown as { lineItems?: string }).lineItems);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const discount = normalizeNumber(input.discount ?? Number((current as unknown as { discount?: number }).discount ?? 0));
    const total = input.totalPrice === undefined ? Math.max(subtotal - discount, 0) : Math.max(normalizeNumber(input.totalPrice), 0);
    await this.run(
      `UPDATE orders SET customer_id = COALESCE(?, customer_id), customer_name = COALESCE(?, customer_name), collaborator_id = ?, collaborator_name = ?,
       title = COALESCE(?, title), work_type = COALESCE(?, work_type), quantity = ?, unit_price = ?, discount = ?, total = ?, line_items = ?, due_date = COALESCE(?, due_date), note = COALESCE(?, note) WHERE id = ?`,
      [customer?.id ?? null, customer?.name ?? null, input.collaboratorId === '' ? '' : collaborator?.id ?? (current as unknown as { collaborator_id?: string }).collaborator_id ?? '', input.collaboratorId === '' ? '' : collaborator?.name ?? (current as unknown as { collaborator_name?: string }).collaborator_name ?? '', input.title?.trim() ?? null, input.workType ?? null, lineItems.reduce((sum, item) => sum + item.quantity, 0), lineItems[0]?.unitPrice ?? 0, discount, total, JSON.stringify(lineItems), input.dueDate ?? null, input.note?.trim() ?? null, input.id]
    );
    await this.log('order', 'سفارش ویرایش شد', input.title ?? input.id);
  }

  async setOrderStatus(orderId: string, status: OrderStatus) {
    await this.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    await this.log('order', 'وضعیت سفارش تغییر کرد', status);
  }

  async deleteOrder(orderId: string) {
    const invoices = await this.all<Invoice>('SELECT id, order_id as orderId, order_ids as orderIds FROM invoices');
    for (const invoice of invoices.map((item) => normalizeInvoice(item, []))) {
      if (invoice.orderIds.includes(orderId)) await this.run('DELETE FROM invoices WHERE id = ?', [invoice.id]);
    }
    await this.run('DELETE FROM orders WHERE id = ?', [orderId]);
    await this.log('order', 'سفارش حذف شد', orderId);
  }

  async addInvoice(input: NewInvoiceInput) {
    const orderIds = Array.from(new Set((input.orderIds?.length ? input.orderIds : input.orderId ? [input.orderId] : []).filter(Boolean)));
    const orders = orderIds.length ? await this.all<Order>(`SELECT id, title, customer_name as customerName, collaborator_id as collaboratorId, collaborator_name as collaboratorName, total, due_date as dueDate FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds) : [];
    if (!orders.length) throw new Error('سفارش انتخاب نشده است');
    const amount = normalizeNumber(input.amount || orders.reduce((sum, item) => sum + Number(item.total ?? 0), 0));
    const paid = Math.min(amount, normalizeNumber(input.paid ?? 0));
    const [payer] = input.payerId ? await this.all<Collaborator>('SELECT id, name FROM collaborators WHERE id = ?', [input.payerId]) : await this.all<Collaborator>('SELECT id, name FROM collaborators WHERE id = ?', [orders[0]?.collaboratorId]);
    const orderTitle = orders.map((item) => item.title).join('، ');
    const customerName = Array.from(new Set(orders.map((item) => item.customerName).filter(Boolean))).join('، ');
    const invoiceId = id();
    const invoiceCreatedAt = now();
    await this.run('INSERT INTO invoices (id, invoice_number, order_id, order_ids, order_title, customer_name, payer_id, payer_name, title, amount, paid, discount, status, due_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, generateInvoiceNumber(invoiceCreatedAt), orders[0].id, JSON.stringify(orders.map((item) => item.id)), orderTitle, customerName, payer?.id ?? '', payer?.name ?? '', input.title?.trim() || `فاکتور ${orderTitle}`, amount, paid, normalizeNumber(input.discount ?? 0), invoiceStatus(amount, paid), input.dueDate ?? orders[0]?.dueDate ?? '', input.note?.trim() ?? '', invoiceCreatedAt]);
    await this.log('invoice', 'فاکتور ثبت شد', orderTitle);
  }

  async updateInvoice(input: UpdateInvoiceInput) {
    const [invoice] = await this.all<Invoice>('SELECT id, amount, paid FROM invoices WHERE id = ?', [input.id]);
    if (!invoice) return;
    const orderIds = input.orderIds?.length ? input.orderIds : input.orderId ? [input.orderId] : [];
    const orders = orderIds.length ? await this.all<Order>(`SELECT id, title, customer_name as customerName FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds) : [];
    const [payer] = input.payerId ? await this.all<Collaborator>('SELECT id, name FROM collaborators WHERE id = ?', [input.payerId]) : [];
    const amount = normalizeNumber(input.amount ?? invoice.amount);
    const paid = Math.min(amount, normalizeNumber(input.paid ?? invoice.paid));
    await this.run('UPDATE invoices SET order_id = COALESCE(?, order_id), order_ids = COALESCE(?, order_ids), order_title = COALESCE(?, order_title), customer_name = COALESCE(?, customer_name), payer_id = COALESCE(?, payer_id), payer_name = COALESCE(?, payer_name), title = COALESCE(?, title), amount = ?, paid = ?, discount = COALESCE(?, discount), status = ?, due_date = COALESCE(?, due_date), note = COALESCE(?, note) WHERE id = ?', [orders[0]?.id ?? null, orders.length ? JSON.stringify(orders.map((item) => item.id)) : null, orders.length ? orders.map((item) => item.title).join('، ') : null, orders.length ? Array.from(new Set(orders.map((item) => item.customerName).filter(Boolean))).join('، ') : null, payer?.id ?? input.payerId ?? null, payer?.name ?? null, input.title?.trim() ?? null, amount, paid, typeof input.discount === 'number' ? normalizeNumber(input.discount) : null, invoiceStatus(amount, paid), input.dueDate ?? null, input.note?.trim() ?? null, input.id]);
    await this.log('invoice', 'فاکتور ویرایش شد', input.title ?? input.id);
  }

  async addInvoicePayment(invoiceId: string, amount: number) {
    const [invoice] = await this.all<Invoice>('SELECT id, amount, paid FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) return;
    const paid = Math.min(invoice.amount, invoice.paid + normalizeNumber(amount));
    await this.run('UPDATE invoices SET paid = ?, status = ? WHERE id = ?', [paid, invoiceStatus(invoice.amount, paid), invoiceId]);
    await this.log('invoice', 'پرداخت ثبت شد', amount.toLocaleString('fa-IR'));
  }

  async addCollaboratorPayment(input: NewCollaboratorPaymentInput) {
    const [collaborator] = await this.all<Collaborator>('SELECT id, name FROM collaborators WHERE id = ?', [input.collaboratorId]);
    if (!collaborator) throw new Error('همکار انتخاب نشده است');
    const amount = normalizeNumber(input.amount);
    if (amount <= 0) throw new Error('مبلغ پرداخت باید بزرگ‌تر از صفر باشد');
    const payment: CollaboratorPayment = { id: id(), collaboratorId: collaborator.id, collaboratorName: collaborator.name, amount, paidAt: input.paidAt || now().slice(0, 10), note: input.note?.trim() ?? '', createdAt: now() };
    await this.run('INSERT INTO collaborator_payments (id, collaborator_id, amount, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [payment.id, payment.collaboratorId, payment.amount, payment.paidAt, payment.note, payment.createdAt]);
    await this.log('collaborator', 'پرداخت کلی همکار ثبت شد', `${collaborator.name} - ${amount.toLocaleString('fa-IR')}`);
    return payment;
  }

  async deleteInvoice(invoiceId: string) {
    await this.run('DELETE FROM invoices WHERE id = ?', [invoiceId]);
    await this.log('invoice', 'فاکتور حذف شد', invoiceId);
  }

  async addInventoryItem(input: NewInventoryInput) {
    await this.run('INSERT INTO inventory (id, name, quantity, unit, min_quantity, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), input.name.trim(), normalizeNumber(input.quantity), input.unit?.trim() || 'عدد', normalizeNumber(input.minQuantity ?? 0), input.note?.trim() ?? '']);
    await this.log('inventory', 'کالا ثبت شد', input.name);
  }

  async updateInventoryItem(input: { id: string; name?: string; quantity?: number; unit?: string; minQuantity?: number; note?: string }) {
    await this.run('UPDATE inventory SET name = COALESCE(?, name), quantity = COALESCE(?, quantity), unit = COALESCE(?, unit), min_quantity = COALESCE(?, min_quantity), note = COALESCE(?, note) WHERE id = ?', [input.name ?? null, input.quantity ?? null, input.unit ?? null, input.minQuantity ?? null, input.note ?? null, input.id]);
    await this.log('inventory', 'کالا ویرایش شد', input.name ?? input.id);
  }

  async adjustInventory(itemId: string, delta: number) {
    await this.run('UPDATE inventory SET quantity = MAX(quantity + ?, 0) WHERE id = ?', [delta, itemId]);
    await this.log('inventory', 'موجودی تغییر کرد', `${delta > 0 ? '+' : ''}${delta}`);
  }

  async deleteInventoryItem(itemId: string) {
    await this.run('DELETE FROM inventory WHERE id = ?', [itemId]);
    await this.log('inventory', 'کالا حذف شد', itemId);
  }

  async addMeshType(input: NewMeshTypeInput) {
    if (input.isDefault) await this.run('UPDATE mesh_types SET is_default = 0');
    await this.run('INSERT INTO mesh_types (id, title, unit_price, is_active, is_default, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), input.title.trim(), normalizeNumber(input.unitPrice), input.isActive === false ? 0 : 1, input.isDefault ? 1 : 0, input.note?.trim() ?? '']);
    await this.log('mesh', 'نوع توری ثبت شد', input.title);
  }

  async updateMeshType(input: UpdateMeshTypeInput) {
    if (input.isDefault) await this.run('UPDATE mesh_types SET is_default = 0');
    await this.run('UPDATE mesh_types SET title = COALESCE(?, title), unit_price = COALESCE(?, unit_price), is_active = COALESCE(?, is_active), is_default = COALESCE(?, is_default), note = COALESCE(?, note) WHERE id = ?', [input.title ?? null, input.unitPrice ?? null, input.isDefault ? 1 : typeof input.isActive === 'boolean' ? (input.isActive ? 1 : 0) : null, typeof input.isDefault === 'boolean' ? (input.isDefault ? 1 : 0) : null, input.note ?? null, input.id]);
    await this.log('mesh', 'نوع توری ویرایش شد', input.title ?? input.id);
  }

  async deleteMeshType(meshTypeId: string) {
    await this.run('DELETE FROM mesh_types WHERE id = ?', [meshTypeId]);
    await this.log('mesh', 'نوع توری حذف شد', meshTypeId);
  }

  async addUser(input: NewUserInput) {
    await this.run('INSERT INTO users (id, username, pin, name, role) VALUES (?, ?, ?, ?, ?)', [id(), input.username.trim(), input.pin.trim(), input.name.trim(), input.role?.trim() || 'assistant']);
    await this.log('user', 'کاربر ثبت شد', input.username);
  }

  async updateUser(input: UpdateUserInput) {
    await this.run('UPDATE users SET username = COALESCE(?, username), name = COALESCE(?, name), pin = COALESCE(?, pin), role = COALESCE(?, role) WHERE id = ?', [input.username ?? null, input.name ?? null, input.pin?.trim() || null, input.role ?? null, input.id]);
    await this.log('user', 'کاربر ویرایش شد', input.username ?? input.id);
  }

  async deleteUser(userId: string) {
    const count = await this.all<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if ((count[0]?.count ?? 0) <= 1) throw new Error('حداقل یک کاربر باید باقی بماند');
    await this.run('DELETE FROM users WHERE id = ?', [userId]);
    await this.log('user', 'کاربر حذف شد', userId);
  }

  async markNotificationsSeen() {
    await this.run('UPDATE notifications SET seen = 1');
  }

  async importSnapshot(snapshot: AppSnapshot) {
    for (const table of ['activities', 'notifications', 'collaborator_payments', 'invoices', 'orders', 'inventory', 'mesh_types', 'collaborators', 'customers']) await this.run(`DELETE FROM ${table}`);
    for (const item of snapshot.customers) await this.run('INSERT INTO customers (id, name, phone, address, note, referred_by_collaborator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.id, item.name, item.phone, item.address, item.note, item.referredByCollaboratorId ?? '', item.createdAt]);
    for (const item of snapshot.collaborators) await this.run('INSERT INTO collaborators (id, name, phone, role, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.name, item.phone, item.role, item.note, item.createdAt]);
    for (const item of snapshot.orders) await this.run('INSERT INTO orders (id, customer_id, customer_name, collaborator_id, collaborator_name, title, status, work_type, quantity, unit_price, discount, total, line_items, due_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [item.id, item.customerId, item.customerName, item.collaboratorId, item.collaboratorName, item.title, item.status, item.workType, item.quantity, item.unitPrice, item.discount, item.total, JSON.stringify(item.lineItems ?? []), item.dueDate, item.note, item.createdAt]);
    for (const item of snapshot.invoices.map((invoice) => normalizeInvoice(invoice, snapshot.orders))) await this.run('INSERT INTO invoices (id, invoice_number, order_id, order_ids, order_title, customer_name, payer_id, payer_name, title, amount, paid, discount, status, due_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [item.id, item.invoiceNumber ?? fallbackInvoiceNumber(item.id, item.createdAt), item.orderId, JSON.stringify(item.orderIds ?? [item.orderId]), item.orderTitle, item.customerName, item.payerId, item.payerName, item.title, item.amount, item.paid, item.discount, item.status, item.dueDate, item.note, item.createdAt]);
    for (const item of snapshot.collaboratorPayments ?? []) await this.run('INSERT INTO collaborator_payments (id, collaborator_id, amount, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.collaboratorId, item.amount, item.paidAt, item.note, item.createdAt]);
    for (const item of snapshot.inventory) await this.run('INSERT INTO inventory (id, name, quantity, unit, min_quantity, note) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.name, item.quantity, item.unit, item.minQuantity, item.note]);
    for (const item of snapshot.meshTypes) await this.run('INSERT INTO mesh_types (id, title, unit_price, is_active, is_default, note) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.title, item.unitPrice, item.isActive, item.isDefault, item.note]);
    for (const item of snapshot.notifications) await this.run('INSERT INTO notifications (id, title, body, seen, created_at) VALUES (?, ?, ?, ?, ?)', [item.id, item.title, item.body, item.seen, item.createdAt]);
    for (const item of snapshot.activities) await this.run('INSERT INTO activities (id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?)', [item.id, item.type, item.title, item.body, item.createdAt]);
    await this.log('backup', 'بکاپ بازیابی شد', 'داده‌ها از JSON وارد شدند');
  }

  async recordBackup(filename: string) {
    await this.log('backup', 'بکاپ اجرا شد', filename);
  }

  private async seed() {
    const users = await this.all<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (users[0]?.count) return;
    await this.run('INSERT INTO users (id, username, pin, name, role) VALUES (?, ?, ?, ?, ?)', [id(), 'admin', '1234', 'مدیر', 'manager']);
    const customerId = id();
    await this.run('INSERT INTO customers (id, name, phone, address, note, referred_by_collaborator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [customerId, 'مشتری نمونه', '09120000000', 'تهران', 'برای تست اولیه', '', now()]);
    await this.run('INSERT INTO collaborators (id, name, phone, role, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'همکار نمونه', '09121111111', 'نصاب', '', now()]);
    await this.run('INSERT INTO inventory (id, name, quantity, unit, min_quantity, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'توری پلیسه', 12, 'عدد', 4, '']);
    await this.run('INSERT INTO inventory (id, name, quantity, unit, min_quantity, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'ریل آلومینیوم', 28, 'شاخه', 8, '']);
    await this.run('INSERT INTO mesh_types (id, title, unit_price, is_active, is_default, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'پلیسه معمولی', 450000, 1, 1, '']);
    await this.run('INSERT INTO mesh_types (id, title, unit_price, is_active, is_default, note) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'مگنتی', 380000, 1, 0, '']);
    await this.run('INSERT INTO notifications (id, title, body, seen, created_at) VALUES (?, ?, ?, ?, ?)', [id(), 'نسخه موبایل آماده است', 'داده‌ها در SQLite داخل گوشی ذخیره می‌شوند.', 0, now()]);
  }

  private async migrate() {
    await this.ensureColumn('users', 'role', "TEXT NOT NULL DEFAULT 'manager'");
    await this.ensureColumn('orders', 'customer_name', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('customers', 'referred_by_collaborator_id', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('orders', 'collaborator_id', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('orders', 'collaborator_name', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('orders', 'work_type', "TEXT NOT NULL DEFAULT 'new_construction'");
    await this.ensureColumn('orders', 'discount', 'REAL NOT NULL DEFAULT 0');
    await this.ensureColumn('orders', 'line_items', "TEXT NOT NULL DEFAULT '[]'");
    await this.ensureColumn('invoices', 'order_title', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'order_ids', "TEXT NOT NULL DEFAULT '[]'");
    await this.ensureColumn('invoices', 'payer_id', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'payer_name', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'discount', 'REAL NOT NULL DEFAULT 0');
    await this.ensureColumn('invoices', 'title', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'due_date', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'note', "TEXT NOT NULL DEFAULT ''");
    await this.ensureColumn('invoices', 'invoice_number', "TEXT NOT NULL DEFAULT ''");
    await this.run("UPDATE orders SET customer_name = (SELECT name FROM customers WHERE customers.id = orders.customer_id) WHERE customer_name = ''");
    await this.run("UPDATE invoices SET order_title = (SELECT title FROM orders WHERE orders.id = invoices.order_id) WHERE order_title = ''");
    await this.run(`UPDATE invoices SET order_ids = '["' || order_id || '"]' WHERE order_ids = '[]' OR order_ids = ''`);
    await this.run("UPDATE invoices SET payer_id = COALESCE((SELECT collaborator_id FROM orders WHERE orders.id = invoices.order_id), '') WHERE payer_id = ''");
    await this.run("UPDATE invoices SET payer_name = COALESCE((SELECT collaborator_name FROM orders WHERE orders.id = invoices.order_id), '') WHERE payer_name = ''");
    await this.run("UPDATE invoices SET title = 'فاکتور ' || order_title WHERE title = ''");
    const invoicesWithoutNumber = await this.all<{ id: string; created_at: string }>("SELECT id, created_at FROM invoices WHERE invoice_number = ''");
    for (const invoice of invoicesWithoutNumber) {
      await this.run('UPDATE invoices SET invoice_number = ? WHERE id = ?', [fallbackInvoiceNumber(invoice.id, invoice.created_at), invoice.id]);
    }
    await this.run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', ['schema_version', '6']);
  }

  private async ensureColumn(table: string, column: string, definition: string) {
    const columns = await this.all<{ name: string }>(`PRAGMA table_info(${table})`);
    if (columns.some((item) => item.name === column)) return;
    await this.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private async log(type: string, title: string, body: string) {
    await this.run('INSERT INTO activities (id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?)', [id(), type, title, body, now()]);
    if (this.deferMirrorSync) return;
    this.queuePostgresMirrorSync();
  }

  private queuePostgresMirrorSync() {
    if (this.mirrorSyncQueued) return;
    this.mirrorSyncQueued = true;
    globalThis.setTimeout(() => {
      void this.syncPostgresMirror()
        .catch((error) => console.warn('Postgres mirror sync failed', error))
        .finally(() => {
          this.mirrorSyncQueued = false;
        });
    }, 300);
  }

  private async all<T>(statement: string, values: unknown[] = []) {
    const result = await this.requireDb().query(statement, values);
    return (result.values ?? []) as T[];
  }

  private async run(statement: string, values: unknown[] = []) {
    await this.requireDb().run(statement, values);
  }

  private requireDb() {
    if (!this.db) throw new Error('Database is not initialized');
    return this.db;
  }

  private async syncPostgresMirror() {
    const db = this.requireDb();
    const current = now();
    const adminId = 'local-admin-user';
    const managerRoleId = 'local-role-manager';
    const assistantRoleId = 'local-role-assistant';

    const users = await this.all<Array<{ id: string; username: string; pin: string; name: string; role: string }>[number]>('SELECT id, username, pin, name, role FROM users ORDER BY username');
    const customers = await this.all<Customer>('SELECT id, name, phone, address, note, referred_by_collaborator_id as referredByCollaboratorId, created_at as createdAt FROM customers');
    const collaborators = await this.all<Collaborator>('SELECT id, name, phone, role, note, created_at as createdAt FROM collaborators');
    const meshTypes = await this.all<MeshType>('SELECT id, title, unit_price as unitPrice, is_active as isActive, is_default as isDefault, note FROM mesh_types');
    const orders = await this.all<Order>(
      `SELECT id, customer_id as customerId, customer_name as customerName, collaborator_id as collaboratorId, collaborator_name as collaboratorName,
        title, status, work_type as workType, quantity, unit_price as unitPrice, discount, total, line_items as lineItems, due_date as dueDate,
        note, created_at as createdAt FROM orders`
    );
    const rawInvoices = await this.all<Invoice>('SELECT id, invoice_number as invoiceNumber, order_id as orderId, order_ids as orderIds, order_title as orderTitle, customer_name as customerName, payer_id as payerId, payer_name as payerName, title, amount, paid, discount, status, due_date as dueDate, note, created_at as createdAt FROM invoices');
    const invoices = rawInvoices.map((invoice) => normalizeInvoice(invoice, orders));
    const collaboratorPayments = await this.all<CollaboratorPayment>('SELECT collaborator_payments.id, collaborator_id as collaboratorId, collaborators.name as collaboratorName, amount, paid_at as paidAt, collaborator_payments.note, collaborator_payments.created_at as createdAt FROM collaborator_payments JOIN collaborators ON collaborators.id = collaborator_payments.collaborator_id');
    const inventory = await this.all<InventoryItem>('SELECT id, name, quantity FROM inventory');
    const activities = await this.all<Activity>('SELECT id, type, title, body, created_at as createdAt FROM activities');

    for (const table of ['OperationLog', 'InventoryLog', 'InventoryItem', 'InvoicePayment', 'InvoiceOrder', 'Invoice', 'OrderLineItem', 'Order', 'CollaboratorPayment', 'MeshType', 'Customer', 'Collaborator', 'Session', 'LoginAttempt', 'UserRole', 'RolePermission', 'Permission', 'Role', 'User', 'BackupLog', 'AppSetting']) {
      await db.run(`DELETE FROM "${table}"`);
    }

    await db.run('INSERT INTO "Role" (id, key, name, description, isSystem, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [managerRoleId, 'manager', 'مدیر', 'نقش مدیر سیستم', 1, current, current]);
    await db.run('INSERT INTO "Role" (id, key, name, description, isSystem, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [assistantRoleId, 'assistant', 'دستیار', 'نقش دستیار سیستم', 1, current, current]);

    const mirrorUsers = users.length ? users : [{ id: adminId, username: 'admin', pin: '1234', name: 'مدیر', role: 'manager' }];
    for (const user of mirrorUsers) {
      const parts = splitDisplayName(user.name);
      await db.run(
        'INSERT INTO "User" (id, firstName, lastName, username, passwordHash, status, locale, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user.id, parts.firstName, parts.lastName, user.username, `local-pin:${user.pin}`, 'ACTIVE', 'fa', current, current, null]
      );
      await db.run('INSERT INTO "UserRole" (id, userId, roleId, createdAt) VALUES (?, ?, ?, ?)', [`ur-${user.id}`, user.id, user.role === 'manager' ? managerRoleId : assistantRoleId, current]);
    }
    const createdById = mirrorUsers[0]?.id ?? adminId;

    for (const collaborator of collaborators) {
      const parts = splitDisplayName(collaborator.name);
      await db.run(
        'INSERT INTO "Collaborator" (id, firstName, lastName, phone, address, description, createdById, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [collaborator.id, parts.firstName, parts.lastName, collaborator.phone || null, null, [collaborator.role, collaborator.note].filter(Boolean).join(' - ') || null, createdById, collaborator.createdAt, current, null]
      );
    }

    for (const payment of collaboratorPayments) {
      await db.run(
        'INSERT INTO "CollaboratorPayment" (id, collaboratorId, amount, paidAt, note, createdById, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [payment.id, payment.collaboratorId, payment.amount, payment.paidAt || payment.createdAt, payment.note || null, createdById, payment.createdAt]
      );
    }

    for (const customer of customers) {
      const parts = splitDisplayName(customer.name);
      await db.run(
        'INSERT INTO "Customer" (id, firstName, lastName, phone, address, description, createdById, referredByCollaboratorId, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [customer.id, parts.firstName, parts.lastName, customer.phone || null, customer.address || null, customer.note || null, createdById, customer.referredByCollaboratorId || null, customer.createdAt, current, null]
      );
    }

    for (const meshType of meshTypes) {
      await db.run(
        'INSERT INTO "MeshType" (id, title, description, isActive, unitPrice, isDefault, createdById, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [meshType.id, meshType.title, meshType.note || null, Number(meshType.isActive) ? 1 : 0, Number(meshType.unitPrice ?? 0), Number(meshType.isDefault) ? 1 : 0, createdById, current, current, null]
      );
    }

    for (const order of orders) {
      const lineItems = parseLineItems(order.lineItems);
      await db.run(
        `INSERT INTO "Order" (id, orderNumber, title, orderDateJalali, collaboratorId, customerId, createdById, workType, width, height, quantity, unitPrice, totalPrice, discountAmount, description, stage, stageNote, expectedCompletionDate, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          `M-${order.id.slice(0, 8)}`,
          order.title || null,
          order.dueDate || order.createdAt.slice(0, 10),
          order.collaboratorId || null,
          order.customerId || null,
          createdById,
          toPrismaWorkType(order.workType),
          lineItems[0]?.width ?? null,
          lineItems[0]?.height ?? null,
          order.quantity ?? null,
          order.unitPrice ?? null,
          order.total ?? 0,
          order.discount ?? 0,
          order.note || null,
          toPrismaOrderStage(order.status),
          null,
          order.dueDate || null,
          order.createdAt,
          current,
          null
        ]
      );

      for (const item of lineItems) {
        const meshTypeId = meshTypes.some((meshType) => meshType.id === item.meshTypeId) ? item.meshTypeId : meshTypes[0]?.id;
        if (!meshTypeId) continue;
        await db.run(
          'INSERT INTO "OrderLineItem" (id, orderId, meshTypeId, width, height, quantity, unitPrice, lineTotal, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, order.id, meshTypeId, item.width, item.height, item.quantity, item.unitPrice, item.total, item.description || null, order.createdAt, current]
        );
      }
    }

    for (const invoice of invoices) {
      await db.run(
        `INSERT INTO "Invoice" (id, invoiceNumber, title, createdById, amount, discountAmount, paidAmount, status, payerType, payerId, dueDate, paidAt, description, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoice.id, invoice.invoiceNumber ?? fallbackInvoiceNumber(invoice.id, invoice.createdAt), invoice.title || null, createdById, invoice.amount, invoice.discount ?? 0, invoice.paid, toPrismaInvoiceStatus(invoice.status), 'COLLABORATOR', invoice.payerId || null, invoice.dueDate || null, invoice.status === 'paid' ? current : null, invoice.note || null, invoice.createdAt, current, null]
      );
      const invoiceOrderIds = invoice.orderIds?.length ? invoice.orderIds : invoice.orderId ? [invoice.orderId] : [];
      for (const orderId of invoiceOrderIds) {
        if (!orders.some((order) => order.id === orderId)) continue;
        await db.run('INSERT OR IGNORE INTO "InvoiceOrder" (id, invoiceId, orderId, createdAt) VALUES (?, ?, ?, ?)', [`io-${invoice.id}-${orderId}`, invoice.id, orderId, invoice.createdAt]);
      }
      if (invoice.paid > 0) {
        await db.run('INSERT INTO "InvoicePayment" (id, invoiceId, amount, paidAt, note, createdById, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [`pay-${invoice.id}`, invoice.id, invoice.paid, current, 'پرداخت ثبت شده در موبایل', createdById, current]);
      }
    }

    for (const item of inventory) {
      await db.run('INSERT INTO "InventoryItem" (id, name, quantity, createdById, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.id, item.name, Math.trunc(Number(item.quantity ?? 0)), createdById, current, current, null]);
    }

    for (const activity of activities) {
      await db.run(
        'INSERT INTO "OperationLog" (id, actorId, entityType, entityId, action, description, payload, orderId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [activity.id, createdById, activity.type || 'mobile', activity.id, activity.title, activity.body || null, null, null, activity.createdAt]
      );
    }

    await db.run('INSERT INTO "AppSetting" (key, value, updatedAt) VALUES (?, ?, ?)', ['mobile_schema_mode', 'postgres-compatible', current]);
  }
}

function normalizeOrder(order: Partial<Order>, customers: Customer[], collaborators: Collaborator[]): Order {
  const customer = customers.find((item) => item.id === order.customerId);
  const collaborator = collaborators.find((item) => item.id === order.collaboratorId);
  const lineItems = parseLineItems(order.lineItems);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const discount = normalizeNumber(order.discount ?? 0);
    return {
    id: order.id ?? id(),
    customerId: order.customerId ?? customer?.id ?? '',
    customerName: order.customerName ?? customer?.name ?? '',
    collaboratorId: order.collaboratorId ?? collaborator?.id ?? '',
      collaboratorName: order.collaboratorName ?? collaborator?.name ?? '',
      collaboratorPhone: order.collaboratorPhone ?? collaborator?.phone ?? '',
    title: order.title ?? 'سفارش',
    status: order.status ?? 'received',
    workType: order.workType ?? 'new_construction',
    quantity: order.quantity ?? lineItems.reduce((sum, item) => sum + item.quantity, 0),
    unitPrice: order.unitPrice ?? lineItems[0]?.unitPrice ?? 0,
    discount,
    total: order.total ?? Math.max(subtotal - discount, 0),
    lineItems,
    dueDate: order.dueDate ?? '',
    note: order.note ?? '',
    createdAt: order.createdAt ?? now()
  };
}

function normalizeInvoice(invoice: Partial<Invoice>, orders: Order[]): Invoice {
  const parsedOrderIds = Array.isArray(invoice.orderIds)
    ? invoice.orderIds
    : parseStringArray(invoice.orderIds);
  let orderIds = parsedOrderIds.filter(Boolean);
  if (!orderIds.length && invoice.orderId) orderIds = [invoice.orderId];
  const linkedOrders = orderIds.length ? orders.filter((item) => orderIds.includes(item.id)) : [];
  const order = linkedOrders[0] ?? orders.find((item) => item.id === invoice.orderId);
  const safeOrderIds = linkedOrders.length ? linkedOrders.map((item) => item.id) : orderIds;
  const fallbackAmount = linkedOrders.reduce((sum, item) => sum + item.total, 0) || order?.total || 0;
  const amount = normalizeNumber(invoice.amount ?? fallbackAmount);
  const paid = normalizeNumber(invoice.paid ?? 0);
  const orderTitle = invoice.orderTitle ?? (linkedOrders.length ? linkedOrders.map((item) => item.title).join('، ') : order?.title ?? '');
  const customerName = invoice.customerName ?? (linkedOrders.length ? Array.from(new Set(linkedOrders.map((item) => item.customerName).filter(Boolean))).join('، ') : order?.customerName ?? '');
  const payerId = invoice.payerId ?? linkedOrders.find((item) => item.collaboratorId)?.collaboratorId ?? order?.collaboratorId ?? '';
  const payerName = invoice.payerName ?? linkedOrders.find((item) => item.collaboratorName)?.collaboratorName ?? order?.collaboratorName ?? '';
  return {
    id: invoice.id ?? id(),
    invoiceNumber: invoice.invoiceNumber ?? fallbackInvoiceNumber(invoice.id ?? id(), invoice.createdAt),
    orderId: invoice.orderId ?? order?.id ?? safeOrderIds[0] ?? '',
    orderIds: safeOrderIds,
    orderTitle,
    customerName,
    payerId,
    payerName,
    title: invoice.title ?? `فاکتور ${orderTitle}`.trim(),
    amount,
    paid,
    discount: normalizeNumber(invoice.discount ?? 0),
    status: invoice.status ?? invoiceStatus(amount, paid),
    dueDate: invoice.dueDate ?? order?.dueDate ?? '',
    note: invoice.note ?? '',
    createdAt: invoice.createdAt ?? now()
  };
}

function splitDisplayName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'نامشخص', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toPrismaWorkType(value?: WorkType) {
  return value === 'repair' ? 'REPAIR' : 'NEW_CONSTRUCTION';
}

function toPrismaOrderStage(value?: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    received: 'RECEIVED',
    in_progress: 'IN_PROGRESS',
    ready: 'READY_IN_WAREHOUSE',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED'
  };
  return value ? map[value] : 'RECEIVED';
}

function toPrismaInvoiceStatus(value?: InvoiceStatus) {
  const map: Record<InvoiceStatus, string> = {
    unpaid: 'UNPAID',
    partial: 'PARTIAL',
    paid: 'PAID'
  };
  return value ? map[value] : 'UNPAID';
}

const postgresCompatibleSchemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  locale TEXT NOT NULL DEFAULT 'fa',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS "User_firstName_idx" ON "User"(firstName);
CREATE INDEX IF NOT EXISTS "User_lastName_idx" ON "User"(lastName);
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"(status);
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"(deletedAt);

CREATE TABLE IF NOT EXISTS "Role" (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  isSystem INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Role_isSystem_idx" ON "Role"(isSystem);

CREATE TABLE IF NOT EXISTS "Permission" (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  apiName TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(resource, apiName)
);
CREATE INDEX IF NOT EXISTS "Permission_resource_idx" ON "Permission"(resource);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  id TEXT PRIMARY KEY,
  roleId TEXT NOT NULL,
  permissionId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(roleId, permissionId),
  FOREIGN KEY(roleId) REFERENCES "Role"(id) ON DELETE CASCADE,
  FOREIGN KEY(permissionId) REFERENCES "Permission"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "RolePermission_roleId_idx" ON "RolePermission"(roleId);
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"(permissionId);

CREATE TABLE IF NOT EXISTS "UserRole" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  roleId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(userId, roleId),
  FOREIGN KEY(userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY(roleId) REFERENCES "Role"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "UserRole_userId_idx" ON "UserRole"(userId);
CREATE INDEX IF NOT EXISTS "UserRole_roleId_idx" ON "UserRole"(roleId);

CREATE TABLE IF NOT EXISTS "Session" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  refreshTokenHash TEXT NOT NULL,
  previousRefreshTokenHash TEXT,
  previousRefreshValidUntil TEXT,
  deviceType TEXT,
  deviceModel TEXT,
  os TEXT,
  browser TEXT,
  timezone TEXT,
  country TEXT,
  language TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  lastActivityAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  isRevoked INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(userId) REFERENCES "User"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"(userId);
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"(expiresAt);
CREATE INDEX IF NOT EXISTS "Session_isRevoked_idx" ON "Session"(isRevoked);
CREATE INDEX IF NOT EXISTS "Session_previousRefreshValidUntil_idx" ON "Session"(previousRefreshValidUntil);

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  failedCount INTEGER NOT NULL DEFAULT 0,
  lockedUntil TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Collaborator" (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  description TEXT,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "Collaborator_firstName_idx" ON "Collaborator"(firstName);
CREATE INDEX IF NOT EXISTS "Collaborator_lastName_idx" ON "Collaborator"(lastName);
CREATE INDEX IF NOT EXISTS "Collaborator_phone_idx" ON "Collaborator"(phone);
CREATE INDEX IF NOT EXISTS "Collaborator_deletedAt_idx" ON "Collaborator"(deletedAt);

CREATE TABLE IF NOT EXISTS "Customer" (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  description TEXT,
  createdById TEXT NOT NULL,
  referredByCollaboratorId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(createdById) REFERENCES "User"(id),
  FOREIGN KEY(referredByCollaboratorId) REFERENCES "Collaborator"(id)
);
CREATE INDEX IF NOT EXISTS "Customer_firstName_idx" ON "Customer"(firstName);
CREATE INDEX IF NOT EXISTS "Customer_lastName_idx" ON "Customer"(lastName);
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"(phone);
CREATE INDEX IF NOT EXISTS "Customer_referredByCollaboratorId_idx" ON "Customer"(referredByCollaboratorId);
CREATE INDEX IF NOT EXISTS "Customer_deletedAt_idx" ON "Customer"(deletedAt);

CREATE TABLE IF NOT EXISTS "MeshType" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  unitPrice REAL NOT NULL DEFAULT 0,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "MeshType_isActive_idx" ON "MeshType"(isActive);
CREATE INDEX IF NOT EXISTS "MeshType_isDefault_idx" ON "MeshType"(isDefault);
CREATE INDEX IF NOT EXISTS "MeshType_deletedAt_idx" ON "MeshType"(deletedAt);

CREATE TABLE IF NOT EXISTS "Order" (
  id TEXT PRIMARY KEY,
  orderNumber TEXT NOT NULL UNIQUE,
  title TEXT,
  orderDateJalali TEXT NOT NULL,
  collaboratorId TEXT,
  customerId TEXT,
  createdById TEXT NOT NULL,
  workType TEXT NOT NULL,
  width REAL,
  height REAL,
  quantity REAL,
  unitPrice REAL,
  totalPrice REAL NOT NULL DEFAULT 0,
  discountAmount REAL NOT NULL DEFAULT 0,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'RECEIVED',
  stageNote TEXT,
  expectedCompletionDate TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(collaboratorId) REFERENCES "Collaborator"(id),
  FOREIGN KEY(customerId) REFERENCES "Customer"(id),
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "Order_orderDateJalali_idx" ON "Order"(orderDateJalali);
CREATE INDEX IF NOT EXISTS "Order_collaboratorId_idx" ON "Order"(collaboratorId);
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"(customerId);
CREATE INDEX IF NOT EXISTS "Order_stage_idx" ON "Order"(stage);
CREATE INDEX IF NOT EXISTS "Order_workType_idx" ON "Order"(workType);
CREATE INDEX IF NOT EXISTS "Order_deletedAt_idx" ON "Order"(deletedAt);

CREATE TABLE IF NOT EXISTS "OrderLineItem" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  meshTypeId TEXT NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  quantity REAL NOT NULL,
  unitPrice REAL NOT NULL,
  lineTotal REAL NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY(orderId) REFERENCES "Order"(id) ON DELETE CASCADE,
  FOREIGN KEY(meshTypeId) REFERENCES "MeshType"(id)
);
CREATE INDEX IF NOT EXISTS "OrderLineItem_orderId_idx" ON "OrderLineItem"(orderId);
CREATE INDEX IF NOT EXISTS "OrderLineItem_meshTypeId_idx" ON "OrderLineItem"(meshTypeId);

CREATE TABLE IF NOT EXISTS "Invoice" (
  id TEXT PRIMARY KEY,
  invoiceNumber TEXT NOT NULL UNIQUE,
  title TEXT,
  createdById TEXT NOT NULL,
  amount REAL NOT NULL,
  discountAmount REAL NOT NULL DEFAULT 0,
  paidAmount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNPAID',
  payerType TEXT NOT NULL DEFAULT 'CUSTOMER',
  payerId TEXT,
  dueDate TEXT,
  paidAt TEXT,
  description TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"(status);
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx" ON "Invoice"(dueDate);
CREATE INDEX IF NOT EXISTS "Invoice_payerType_payerId_idx" ON "Invoice"(payerType, payerId);
CREATE INDEX IF NOT EXISTS "Invoice_deletedAt_idx" ON "Invoice"(deletedAt);

CREATE TABLE IF NOT EXISTS "InvoiceOrder" (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL,
  orderId TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  UNIQUE(invoiceId, orderId),
  FOREIGN KEY(invoiceId) REFERENCES "Invoice"(id) ON DELETE CASCADE,
  FOREIGN KEY(orderId) REFERENCES "Order"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "InvoiceOrder_invoiceId_idx" ON "InvoiceOrder"(invoiceId);
CREATE INDEX IF NOT EXISTS "InvoiceOrder_orderId_idx" ON "InvoiceOrder"(orderId);

CREATE TABLE IF NOT EXISTS "InvoicePayment" (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL,
  amount REAL NOT NULL,
  paidAt TEXT NOT NULL,
  note TEXT,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(invoiceId) REFERENCES "Invoice"(id) ON DELETE CASCADE,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "InvoicePayment_invoiceId_idx" ON "InvoicePayment"(invoiceId);
CREATE INDEX IF NOT EXISTS "InvoicePayment_paidAt_idx" ON "InvoicePayment"(paidAt);
CREATE INDEX IF NOT EXISTS "InvoicePayment_createdById_idx" ON "InvoicePayment"(createdById);

CREATE TABLE IF NOT EXISTS "CollaboratorPayment" (
  id TEXT PRIMARY KEY,
  collaboratorId TEXT NOT NULL,
  amount REAL NOT NULL,
  paidAt TEXT NOT NULL,
  note TEXT,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(collaboratorId) REFERENCES "Collaborator"(id) ON DELETE CASCADE,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "CollaboratorPayment_collaboratorId_idx" ON "CollaboratorPayment"(collaboratorId);
CREATE INDEX IF NOT EXISTS "CollaboratorPayment_paidAt_idx" ON "CollaboratorPayment"(paidAt);
CREATE INDEX IF NOT EXISTS "CollaboratorPayment_createdById_idx" ON "CollaboratorPayment"(createdById);

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  createdById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY(createdById) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "InventoryItem_name_idx" ON "InventoryItem"(name);
CREATE INDEX IF NOT EXISTS "InventoryItem_deletedAt_idx" ON "InventoryItem"(deletedAt);

CREATE TABLE IF NOT EXISTS "InventoryLog" (
  id TEXT PRIMARY KEY,
  itemId TEXT NOT NULL,
  actorId TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  beforeQty INTEGER NOT NULL,
  afterQty INTEGER NOT NULL,
  note TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(itemId) REFERENCES "InventoryItem"(id) ON DELETE CASCADE,
  FOREIGN KEY(actorId) REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS "InventoryLog_itemId_idx" ON "InventoryLog"(itemId);
CREATE INDEX IF NOT EXISTS "InventoryLog_actorId_idx" ON "InventoryLog"(actorId);
CREATE INDEX IF NOT EXISTS "InventoryLog_type_idx" ON "InventoryLog"(type);
CREATE INDEX IF NOT EXISTS "InventoryLog_createdAt_idx" ON "InventoryLog"(createdAt);

CREATE TABLE IF NOT EXISTS "OperationLog" (
  id TEXT PRIMARY KEY,
  actorId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  payload TEXT,
  orderId TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(actorId) REFERENCES "User"(id),
  FOREIGN KEY(orderId) REFERENCES "Order"(id)
);
CREATE INDEX IF NOT EXISTS "OperationLog_entityType_idx" ON "OperationLog"(entityType);
CREATE INDEX IF NOT EXISTS "OperationLog_entityId_idx" ON "OperationLog"(entityId);
CREATE INDEX IF NOT EXISTS "OperationLog_orderId_idx" ON "OperationLog"(orderId);
CREATE INDEX IF NOT EXISTS "OperationLog_createdAt_idx" ON "OperationLog"(createdAt);

CREATE TABLE IF NOT EXISTS "BackupLog" (
  id TEXT PRIMARY KEY,
  backupDir TEXT NOT NULL,
  sqlFilePath TEXT NOT NULL,
  excelDirectory TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "BackupLog_createdAt_idx" ON "BackupLog"(createdAt);

CREATE TABLE IF NOT EXISTS "AppSetting" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager'
);
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  referred_by_collaborator_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  collaborator_id TEXT NOT NULL DEFAULT '',
  collaborator_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'new_construction',
  quantity REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  line_items TEXT NOT NULL DEFAULT '[]',
  due_date TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL DEFAULT '',
  order_id TEXT NOT NULL,
  order_ids TEXT NOT NULL DEFAULT '[]',
  order_title TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  payer_id TEXT NOT NULL DEFAULT '',
  payer_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  due_date TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS collaborator_payments (
  id TEXT PRIMARY KEY,
  collaborator_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(collaborator_id) REFERENCES collaborators(id)
);
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'عدد',
  min_quantity REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS mesh_types (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  unit_price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_collaborator_payments_collaborator ON collaborator_payments(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_notifications_seen ON notifications(seen);
`;

export const backend: BaseBackend = Capacitor.isNativePlatform() ? new SqliteBackend() : new BrowserBackend();
