import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  Download,
  Factory,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  PackagePlus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserRoundPlus,
  Users2,
  Warehouse,
  X
} from 'lucide-react';
import { backend } from '../data/backend';
import type { AppSnapshot, DashboardStats, Invoice, InvoiceStatus, Order, OrderLineItem, OrderStatus, WorkType } from '../data/types';
import torbestLogoUrl from '../assets/torbest-logo.png';
import vazirmatnArabic400Url from '@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2?url';
import vazirmatnArabic600Url from '@fontsource/vazirmatn/files/vazirmatn-arabic-600-normal.woff2?url';
import vazirmatnArabic700Url from '@fontsource/vazirmatn/files/vazirmatn-arabic-700-normal.woff2?url';
import vazirmatnArabic900Url from '@fontsource/vazirmatn/files/vazirmatn-arabic-900-normal.woff2?url';

declare global {
  interface Window {
    BestAndroid?: {
      saveTextFile: (filename: string, content: string, mimeType: string) => string;
      savePdfFile?: (filename: string, title: string, linesJson: string) => string;
      saveLabelPdfFile?: (filename: string, labelsJson: string, openAfterSave: boolean) => string;
      saveHtmlPdfFile?: (filename: string, html: string, widthMm: number, heightMm: number, openAfterSave: boolean) => string;
    };
  }
}

type Tab = 'dashboard' | 'orders' | 'invoices' | 'collaborators' | 'customers' | 'mesh' | 'warehouse' | 'users' | 'backups' | 'notifications' | 'activity' | 'reports';
type OrderIntent = { key: number; customerId?: string; collaboratorId?: string };
type InvoiceIntent = { key: number; orderIds?: string[]; payerId?: string };

const emptySnapshot: AppSnapshot = {
  customers: [],
  orders: [],
  invoices: [],
  collaboratorPayments: [],
  inventory: [],
  collaborators: [],
  meshTypes: [],
  users: [],
  notifications: [],
  activities: []
};

const tabs: Array<{ key: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'orders', label: 'سفارشات', icon: ClipboardList },
  { key: 'invoices', label: 'فاکتورها', icon: ReceiptText },
  { key: 'collaborators', label: 'همکاران', icon: Users2 },
  { key: 'customers', label: 'مشتریان', icon: User },
  { key: 'mesh', label: 'نوع توری', icon: Grid2X2 },
  { key: 'warehouse', label: 'انبارداری', icon: Warehouse },
  { key: 'users', label: 'کاربران', icon: ShieldCheck },
  { key: 'backups', label: 'بکاپ', icon: Database },
  { key: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
  { key: 'notifications', label: 'اعلان‌ها', icon: Bell },
  { key: 'activity', label: 'عملیات', icon: Activity }
];

const unavailableTabs: Array<{ key: 'production' | 'settings'; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'production', label: '\u062a\u0648\u0644\u06cc\u062f', icon: Factory },
  { key: 'settings', label: '\u062a\u0646\u0638\u06cc\u0645\u0627\u062a', icon: Settings }
];

const quickTabs: Tab[] = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers'];
const defaultAssistantTabs: Tab[] = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers', 'mesh', 'warehouse', 'notifications'];

const statusLabels: Record<OrderStatus, string> = {
  received: 'دریافت شده',
  in_progress: 'در حال انجام',
  ready: 'آماده انبار',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده'
};

const workTypeLabels: Record<WorkType, string> = {
  new_construction: 'ساخت جدید',
  repair: 'تعمیر'
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  unpaid: 'پرداخت نشده',
  partial: 'بخشی',
  paid: 'تسویه'
};

const permissionLabels = [
  { key: 'dashboard', label: 'داشبورد', assistant: true },
  { key: 'orders', label: 'سفارشات', assistant: true },
  { key: 'invoices', label: 'فاکتورها', assistant: true },
  { key: 'collaborators', label: 'همکاران', assistant: true },
  { key: 'customers', label: 'مشتریان', assistant: true },
  { key: 'mesh', label: 'نوع توری', assistant: true },
  { key: 'warehouse', label: 'انبارداری', assistant: true },
  { key: 'notifications', label: 'اعلان‌ها', assistant: true },
  { key: 'reports', label: 'گزارش‌ها', assistant: false },
  { key: 'users', label: 'کاربران', assistant: false },
  { key: 'backups', label: 'بکاپ', assistant: false },
  { key: 'activity', label: 'گزارش عملیات', assistant: false }
];

const money = (value: number) => `${Math.round(value || 0).toLocaleString('fa-IR')} تومان`;
const numberText = (value: number) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 2 });
const dimensionText = (value: number) => {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isFinite(rounded) ? String(rounded) : '0';
};
const sizeText = (width: number, height: number) => `${dimensionText(width)} × ${dimensionText(height)} سانتی‌متر`;
const dateText = (iso?: string) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(date);
};
const todayInput = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const date = iso ? new Date(`${iso}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const moneyNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 0) : 0;
};
const calculateLineTotal = (width: number, height: number, quantity: number, unitPrice: number) => {
  const areaMeters = (width * height) / 10000;
  return areaMeters > 1 ? areaMeters * quantity * unitPrice : quantity * unitPrice;
};
const toNumber = (value: string) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeAmountInput = (value: number) => {
  const rounded = Math.max(Math.round(value * 100) / 100, 0);
  return Number.isFinite(rounded) ? String(rounded) : '0';
};
const normalizeTabs = (values: string[]): Tab[] => {
  const validTabs = new Set(tabs.map((item) => item.key));
  const normalized = values.filter((value): value is Tab => validTabs.has(value as Tab));
  return normalized.length ? normalized : [...defaultAssistantTabs];
};

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<AppSnapshot>(emptySnapshot);
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('assistant');
  const [assistantTabs, setAssistantTabs] = useState<Tab[]>(defaultAssistantTabs);
  const [backupInterval, setBackupInterval] = useState(1440);
  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const [invoiceIntent, setInvoiceIntent] = useState<InvoiceIntent | null>(null);

  async function reload() {
    setData(await backend.snapshot());
  }

  async function run(action: () => Promise<void>, done = 'ثبت شد') {
    try {
      await action();
      await reload();
      setMessage(done);
      setTimeout(() => setMessage(''), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خطا در عملیات');
    }
  }

  useEffect(() => {
    void (async () => {
      await backend.initialize();
      setAuthed(backend.isLoggedIn());
      setRole(backend.getSessionRole());
      setAssistantTabs(normalizeTabs(backend.getAssistantTabs()));
      setBackupInterval(backend.getBackupInterval());
      await reload();
      setReady(true);
    })();
  }, []);

  const stats = useMemo<DashboardStats>(
    () => {
      const invoiceRemaining = data.invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
      const directPayments = data.collaboratorPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      return {
        customers: data.customers.length,
        activeOrders: data.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
        unpaidTotal: Math.max(invoiceRemaining - directPayments, 0),
        lowStock: data.inventory.filter((item) => item.quantity <= item.minQuantity).length,
        todayOrders: data.orders.filter((order) => order.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
      };
    },
    [data]
  );

  const availableTabs = useMemo(() => tabs.filter((item) => role === 'manager' || assistantTabs.includes(item.key)), [assistantTabs, role]);
  const activeTabLabel = availableTabs.find((item) => item.key === tab)?.label ?? '';

  useEffect(() => {
    if (availableTabs.some((item) => item.key === tab)) return;
    setTab('dashboard');
  }, [availableTabs, tab]);

  useEffect(() => {
    if (!authed || role !== 'manager' || backupInterval <= 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        const snapshot = await backend.snapshot();
        const filename = `best-mobile-auto-backup-${new Date().toISOString().slice(0, 10)}.json`;
        downloadText(filename, JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
        await backend.recordBackup(filename);
        await reload();
        setMessage('بکاپ خودکار انجام شد');
        setTimeout(() => setMessage(''), 2200);
      })();
    }, backupInterval * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [authed, backupInterval, role]);

  function closeMenu() {
    document.querySelector('details.menu-details')?.removeAttribute('open');
  }

  function goTo(nextTab: Tab) {
    setTab(nextTab);
    closeMenu();
  }

  function showUnavailableTab(label: string) {
    setMessage(`\u0628\u062e\u0634 ${label} \u062f\u0631 \u0646\u0633\u062e\u0647 \u0641\u0639\u0644\u06cc \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a`);
    setTimeout(() => setMessage(''), 2200);
  }

  function openOrderIntent(intent: Omit<OrderIntent, 'key'>) {
    setOrderIntent({ ...intent, key: Date.now() });
    setTab('orders');
    closeMenu();
  }

  function openInvoiceIntent(intent: Omit<InvoiceIntent, 'key'>) {
    setInvoiceIntent({ ...intent, key: Date.now() });
    setTab('invoices');
    closeMenu();
  }

  async function saveAssistantTabs(nextTabs: Tab[]) {
    const normalized = normalizeTabs(nextTabs);
    await backend.setAssistantTabs(normalized);
    setAssistantTabs(normalized);
    setMessage('دسترسی نقش ذخیره شد');
    setTimeout(() => setMessage(''), 2200);
  }

  async function saveBackupInterval(nextInterval: number) {
    await backend.setBackupInterval(nextInterval);
    const savedInterval = backend.getBackupInterval();
    setBackupInterval(savedInterval);
    setMessage('تنظیمات بکاپ ذخیره شد');
    setTimeout(() => setMessage(''), 2200);
  }

  if (!ready) return <Splash title="BEST Mobile" subtitle="آماده‌سازی دیتابیس لوکال" />;
  if (!authed) return <Login onDone={() => { setRole(backend.getSessionRole()); setAuthed(true); }} message={message} setMessage={setMessage} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">به نام خدا | آفلاین و لوکال</p>
          <h1>پنل مدیریت توربست</h1>
          <span className="active-section">{activeTabLabel}</span>
        </div>
        <details className="menu-details">
          <summary className="icon-button" aria-label="منو">
            <Menu size={22} />
          </summary>
          <div className="menu-layer" role="dialog" aria-modal="true" aria-label="منوی کامل">
            <button className="menu-scrim" type="button" aria-label="بستن منو" onClick={closeMenu} />
            <aside className="drawer">
              <div className="drawer-head">
                <div>
                  <strong>BEST Mobile</strong>
                  <span>منوی کامل پنل</span>
                </div>
                <button className="icon-button" type="button" aria-label="بستن" onClick={closeMenu}>
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-grid">
                {availableTabs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => goTo(item.key)}>
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {unavailableTabs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" className="disabled-nav" aria-disabled="true" onClick={() => showUnavailableTab(item.label)}>
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <button className="drawer-logout" type="button" onClick={() => { backend.logout(); setAuthed(false); closeMenu(); }}>
                <LogOut size={19} />
                خروج از حساب
              </button>
            </aside>
          </div>
        </details>
      </header>

      <aside className="tablet-sidebar" aria-label="پنل تبلت">
        <div className="tablet-brand">
          <strong>BEST Mobile</strong>
          <span>پنل کامل مدیریت</span>
        </div>
        <nav className="tablet-nav">
          {availableTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => goTo(item.key)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
          {unavailableTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className="disabled-nav" aria-disabled="true" onClick={() => showUnavailableTab(item.label)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="drawer-logout" type="button" onClick={() => { backend.logout(); setAuthed(false); }}>
          <LogOut size={19} />
          خروج از حساب
        </button>
      </aside>

      <main className="content">
        {message && <div className="toast">{message}</div>}
        {tab === 'dashboard' && <Dashboard data={data} stats={stats} />}
        {tab === 'orders' && <Orders data={data} run={run} intent={orderIntent} onIntentConsumed={() => setOrderIntent(null)} />}
        {tab === 'invoices' && <Invoices data={data} run={run} intent={invoiceIntent} onIntentConsumed={() => setInvoiceIntent(null)} />}
        {tab === 'collaborators' && <Collaborators data={data} run={run} />}
        {tab === 'customers' && <Customers data={data} run={run} onCreateOrder={openOrderIntent} onCreateInvoice={openInvoiceIntent} />}
        {tab === 'mesh' && <MeshTypes data={data} run={run} />}
        {tab === 'warehouse' && <Inventory data={data} run={run} />}
        {tab === 'users' && role === 'manager' && <UsersPage data={data} run={run} assistantTabs={assistantTabs} onSaveAssistantTabs={saveAssistantTabs} />}
        {tab === 'backups' && role === 'manager' && <Backup data={data} run={run} reload={reload} backupInterval={backupInterval} onSaveBackupInterval={saveBackupInterval} />}
        {tab === 'notifications' && <Notifications data={data} run={run} />}
        {tab === 'activity' && <ActivityLog data={data} />}
        {tab === 'reports' && <Reports data={data} />}
      </main>

      <nav className="bottom-nav" aria-label="منوی سریع">
        {availableTabs.filter((item) => quickTabs.includes(item.key)).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => goTo(item.key)}>
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Picker({ label, value, options, onChange, placeholder = 'انتخاب کنید' }: { label: string; value: string; options: Array<{ value: string; label: string; helper?: string }>; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value);
  return (
    <div className="picker-field">
      <span>{label}</span>
      <button className="picker-trigger" type="button" onClick={() => setOpen(true)} disabled={options.length === 0}>
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="picker-layer" role="dialog" aria-modal="true" aria-label={label}>
          <button className="picker-scrim" type="button" aria-label="بستن" onClick={() => setOpen(false)} />
          <div className="picker-sheet">
            <div className="picker-head">
              <strong>{label}</strong>
              <button className="icon-button" type="button" aria-label="بستن" onClick={() => setOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="picker-options">
              {options.map((item) => (
                <button key={item.value} type="button" className={item.value === value ? 'active' : ''} onClick={() => { onChange(item.value); setOpen(false); }}>
                  <span>{item.label}{item.helper && <small>{item.helper}</small>}</span>
                  {item.value === value && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersianDatePicker({ label, value, onChange, placeholder = 'انتخاب تاریخ' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const base = value || todayInput();
  const options = Array.from({ length: 46 }, (_, index) => addDays(base, index - 7));
  return (
    <div className="picker-field">
      <span>{label}</span>
      <button className="picker-trigger" type="button" onClick={() => setOpen(true)}>
        <span>{value ? dateText(value) : placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="picker-layer" role="dialog" aria-modal="true" aria-label={label}>
          <button className="picker-scrim" type="button" aria-label="بستن" onClick={() => setOpen(false)} />
          <div className="picker-sheet date-sheet">
            <div className="picker-head">
              <strong>{label}</strong>
              <button className="icon-button" type="button" aria-label="بستن" onClick={() => setOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="date-options">
              {options.map((iso) => (
                <button key={iso} type="button" className={iso === value ? 'active' : ''} onClick={() => { onChange(iso); setOpen(false); }}>
                  <span>{dateText(iso)}</span>
                  <small dir="ltr">{iso}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-scrim" type="button" aria-label="بستن" onClick={onClose} />
      <section className="modal-panel">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" type="button" aria-label="بستن" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function PageActions({ title, actionLabel, onAction, children }: { title: string; actionLabel?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <section className="page-actions">
      <h2>{title}</h2>
      <div>
        {children}
        {actionLabel && onAction && <button className="primary" type="button" onClick={onAction}><PackagePlus size={18} />{actionLabel}</button>}
      </div>
    </section>
  );
}

function Splash({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="splash"><div className="brand-mark">B</div><h1>{title}</h1><p>{subtitle}</p></div>;
}

function Login({ onDone, message, setMessage }: { onDone: () => void; message: string; setMessage: (value: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await backend.login(username, pin);
    if (ok) onDone();
    else setMessage('نام کاربری یا رمز درست نیست');
  }
  return (
    <main className="login-screen">
      <div className="brand-mark">B</div>
      <h1>ورود به BEST</h1>
      <form className="panel" onSubmit={submit}>
        <label>نام کاربری<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>رمز محلی<input value={pin} type="password" inputMode="numeric" onChange={(event) => setPin(event.target.value)} /></label>
        <button className="primary" type="submit">ورود</button>
      </form>
      {message && <p className="form-error">{message}</p>}
    </main>
  );
}

function Dashboard({ data, stats }: { data: AppSnapshot; stats: DashboardStats }) {
  const totalMeshes = data.orders.reduce((sum, order) => sum + order.lineItems.reduce((lineSum, item) => lineSum + item.quantity, 0), 0);
  const totalSales = data.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const received = data.invoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const latestOrders = [...data.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const latestInvoices = [...data.invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  return (
    <section className="stack">
      <div className="metrics dashboard-metrics">
        <Metric label="کل تعداد توری‌ها" value={totalMeshes.toLocaleString('fa-IR')} />
        <Metric label="سفارشات امروز" value={stats.todayOrders.toLocaleString('fa-IR')} />
        <Metric label="در حال انجام" value={stats.activeOrders.toLocaleString('fa-IR')} />
        <Metric label="کل فروش" value={money(totalSales)} />
        <Metric label="دریافت شده" value={money(received)} />
        <Metric label="باقی مانده" value={money(stats.unpaidTotal)} />
        <Metric label="فاکتور پرداخت نشده" value={data.invoices.filter((item) => item.status !== 'paid').length.toLocaleString('fa-IR')} />
      </div>
      <List title="آخرین سفارش‌ها">
        {latestOrders.map((order) => <article className="row detail-row" key={order.id}><div><h3>{order.title}</h3><p>{order.customerName} / {dateText(order.createdAt)}</p><p>{money(order.total)}</p></div><span className={`pill ${order.status}`}>{statusLabels[order.status]}</span></article>)}
        {latestOrders.length === 0 && <Empty text="هنوز سفارشی ثبت نشده است" />}
      </List>
      <List title="آخرین فاکتورها">
        {latestInvoices.map((invoice) => <article className="row detail-row" key={invoice.id}><div><h3>{invoice.title || invoice.orderTitle}</h3><p>{invoice.customerName} / {dateText(invoice.createdAt)}</p><p>{money(invoice.paid)} / {money(invoice.amount)}</p></div><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span></article>)}
        {latestInvoices.length === 0 && <Empty text="هنوز فاکتوری ثبت نشده است" />}
      </List>
    </section>
  );
}

function Customers({
  data,
  run,
  onCreateOrder,
  onCreateInvoice
}: {
  data: AppSnapshot;
  run: (action: () => Promise<void>, done?: string) => Promise<void>;
  onCreateOrder: (intent: Omit<OrderIntent, 'key'>) => void;
  onCreateInvoice: (intent: Omit<InvoiceIntent, 'key'>) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [referredByCollaboratorId, setReferredByCollaboratorId] = useState('');
  const [query, setQuery] = useState('');
  const [referralFilter, setReferralFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [detailOrderStatus, setDetailOrderStatus] = useState('all');
  const [detailInvoiceStatus, setDetailInvoiceStatus] = useState('all');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const filtered = data.customers.filter((item) => {
    const matchesText = (item.name + ' ' + item.phone + ' ' + item.address).toLowerCase().includes(query.trim().toLowerCase());
    const hasReferrer = Boolean(item.referredByCollaboratorId);
    const matchesReferral = referralFilter === 'all' || (referralFilter === 'with_referrer' ? hasReferrer : !hasReferrer);
    return matchesText && matchesReferral;
  });
  const reset = () => { setEditingId(''); setName(''); setPhone(''); setAddress(''); setNote(''); setReferredByCollaboratorId(''); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['customers'][number]) => { setEditingId(item.id); setName(item.name); setPhone(item.phone); setAddress(item.address); setNote(item.note); setReferredByCollaboratorId(item.referredByCollaboratorId ?? ''); setFormOpen(true); };
  const close = () => { reset(); setFormOpen(false); };
  const selected = data.customers.find((item) => item.id === selectedId);
  if (selected) {
    const orders = data.orders.filter((order) => order.customerId === selected.id);
    const orderIds = new Set(orders.map((order) => order.id));
    const invoices = data.invoices.filter((invoice) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).some((orderId) => orderIds.has(orderId)));
    const collaborators = data.collaborators.filter((collaborator) => orders.some((order) => order.collaboratorId === collaborator.id) || selected.referredByCollaboratorId === collaborator.id);
    const filteredOrders = orders.filter((order) => detailOrderStatus === 'all' || order.status === detailOrderStatus);
    const filteredInvoices = invoices.filter((invoice) => detailInvoiceStatus === 'all' || invoice.status === detailInvoiceStatus);
    const remaining = invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
    const invoicedOrderIds = new Set(data.invoices.flatMap((invoice) => invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]));
    const freeInvoiceOrders = orders.filter((order) => order.status !== 'cancelled' && !invoicedOrderIds.has(order.id));
    const unpaidInvoices = invoices.filter((invoice) => Math.max(invoice.amount - invoice.paid, 0) > 0);
    const selectedPaymentInvoice = unpaidInvoices.find((invoice) => invoice.id === paymentInvoiceId);
    const openPayment = () => {
      const invoice = unpaidInvoices[0];
      setPaymentInvoiceId(invoice?.id ?? '');
      setPaymentAmount(invoice ? String(Math.max(invoice.amount - invoice.paid, 0)) : '');
      setPaymentOpen(true);
    };
    return (
      <section className="stack">
        <section className="panel section-heading"><div><h2>{selected.name}</h2><p className="muted">{selected.phone || 'بدون موبایل'} {selected.address ? ` / ${selected.address}` : ''}</p></div><button className="secondary" type="button" onClick={() => setSelectedId('')}>بازگشت</button></section>
        <div className="metrics"><Metric label="سفارش‌ها" value={orders.length.toLocaleString('fa-IR')} /><Metric label="فاکتورها" value={invoices.length.toLocaleString('fa-IR')} /><Metric label="همکاران" value={collaborators.length.toLocaleString('fa-IR')} /><Metric label="مانده" value={money(remaining)} /></div>
        <section className="panel">
          <h2>عملیات سریع</h2>
          <div className="quick-action-grid">
            <button className="secondary" type="button" onClick={() => onCreateOrder({ customerId: selected.id, collaboratorId: selected.referredByCollaboratorId || collaborators[0]?.id })}><PackagePlus size={17} />ساخت سفارش</button>
            <button className="secondary" type="button" disabled={freeInvoiceOrders.length === 0} onClick={() => onCreateInvoice({ orderIds: freeInvoiceOrders.slice(0, 1).map((order) => order.id), payerId: freeInvoiceOrders[0]?.collaboratorId })}><ReceiptText size={17} />ساخت فاکتور</button>
            <button className="secondary" type="button" disabled={unpaidInvoices.length === 0} onClick={openPayment}><CheckCircle2 size={17} />ثبت پرداخت فاکتور</button>
            <button className="secondary" type="button" onClick={() => openEdit(selected)}><UserRoundPlus size={17} />ویرایش مشتری</button>
          </div>
        </section>
        <Modal title="ثبت پرداخت فاکتور مشتری" open={paymentOpen} onClose={() => setPaymentOpen(false)}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!paymentInvoiceId) throw new Error('فاکتور را انتخاب کنید'); await backend.addInvoicePayment(paymentInvoiceId, Number(paymentAmount)); setPaymentOpen(false); setPaymentInvoiceId(''); setPaymentAmount(''); }, 'پرداخت فاکتور ثبت شد'); }}>
            <FlowSection title="پرداخت">
              <Picker label="فاکتور" value={paymentInvoiceId} onChange={(value) => { const invoice = unpaidInvoices.find((item) => item.id === value); setPaymentInvoiceId(value); setPaymentAmount(invoice ? String(Math.max(invoice.amount - invoice.paid, 0)) : ''); }} placeholder="فاکتور را انتخاب کنید" options={unpaidInvoices.map((invoice) => ({ value: invoice.id, label: invoice.title || invoice.orderTitle, helper: `مانده ${money(Math.max(invoice.amount - invoice.paid, 0))}` }))} />
              {selectedPaymentInvoice && <p className="muted">مبلغ فاکتور: {money(selectedPaymentInvoice.amount)} / پرداخت شده: {money(selectedPaymentInvoice.paid)}</p>}
              <label>مبلغ پرداخت<input value={paymentAmount} inputMode="numeric" onChange={(event) => setPaymentAmount(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><CheckCircle2 size={18} />ثبت پرداخت</button><button className="secondary" type="button" onClick={() => setPaymentOpen(false)}>انصراف</button></div>
          </form>
        </Modal>
        <div className="filter-grid"><Picker label="فیلتر سفارش‌ها" value={detailOrderStatus} onChange={setDetailOrderStatus} options={[{ value: 'all', label: 'همه سفارش‌ها' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /><Picker label="فیلتر فاکتورها" value={detailInvoiceStatus} onChange={setDetailInvoiceStatus} options={[{ value: 'all', label: 'همه فاکتورها' }, ...Object.entries(invoiceStatusLabels).map(([value, label]) => ({ value, label }))]} /><button className="secondary full-button" type="button" onClick={() => { setDetailOrderStatus('all'); setDetailInvoiceStatus('all'); }}>پاک کردن فیلترها</button></div>
        <List title="سفارش‌های مشتری">
          {filteredOrders.map((order) => <OrderCard key={order.id} order={order} onEdit={() => openEdit(selected)} run={run} compact />)}
          {filteredOrders.length === 0 && <Empty text="سفارشی برای این مشتری پیدا نشد" />}
        </List>
        <List title="فاکتورهای مشتری">
          {filteredInvoices.map((invoice) => <article className="card-row" key={invoice.id}><div><h3>{invoice.title || invoice.orderTitle}</h3><p>{invoice.orderTitle}</p><p>پرداخت: {money(invoice.paid)} / {money(invoice.amount)}</p><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span></div><div className="side-actions"><button className="secondary mini" type="button" onClick={() => downloadInvoicePdf(invoice, orders.filter((order) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).includes(order.id)), data)}><Download size={16} />PDF</button></div></article>)}
          {filteredInvoices.length === 0 && <Empty text="فاکتوری برای این مشتری پیدا نشد" />}
        </List>
        <List title="همکاران مرتبط">
          {collaborators.map((collaborator) => <article className="row detail-row" key={collaborator.id}><div><h3>{collaborator.name}</h3><p>{collaborator.role} {collaborator.phone ? ` / ${collaborator.phone}` : ''}</p></div><span>{dateText(collaborator.createdAt)}</span></article>)}
          {collaborators.length === 0 && <Empty text="همکار مرتبطی پیدا نشد" />}
        </List>
      </section>
    );
  }
  return (
    <section className="stack">
      <PageActions title="مشتریان" actionLabel="افزودن مشتری" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش مشتری' : 'افزودن مشتری'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام مشتری لازم است'); if (editingId) await backend.updateCustomer({ id: editingId, name, phone, address, note, referredByCollaboratorId }); else await backend.addCustomer({ name, phone, address, note, referredByCollaboratorId }); close(); }, editingId ? 'مشتری ویرایش شد' : 'مشتری ثبت شد'); }}>
          <FlowSection title="اطلاعات مشتری">
            <label>نام مشتری<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="form-grid"><label>موبایل<input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></label><label>آدرس<input value={address} onChange={(event) => setAddress(event.target.value)} /></label></div>
          </FlowSection>
          <FlowSection title="ارتباط و توضیحات">
            <Picker label="معرف / همکار" value={referredByCollaboratorId} onChange={setReferredByCollaboratorId} placeholder="بدون معرف" options={data.collaborators.map((item) => ({ value: item.id, label: item.name, helper: item.role }))} />
            <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </FlowSection>
          <div className="form-actions"><button className="primary" type="submit"><UserRoundPlus size={18} />{editingId ? 'ویرایش مشتری' : 'ثبت مشتری'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی مشتری" /><Picker label="فیلتر معرف" value={referralFilter} onChange={setReferralFilter} options={[{ value: 'all', label: 'همه مشتری‌ها' }, { value: 'with_referrer', label: 'دارای معرف' }, { value: 'without_referrer', label: 'بدون معرف' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setReferralFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست مشتریان">
        {filtered.map((item) => {
          const orders = data.orders.filter((order) => order.customerId === item.id);
          const invoices = data.invoices.filter((invoice) => orders.some((order) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).includes(order.id)));
          const remaining = invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
          return <article className="row detail-row clickable-row" key={item.id} role="button" tabIndex={0} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(item.id); }}><div><h3>{item.name}</h3><p>{item.phone || 'بدون موبایل'} {item.address ? ` / ${item.address}` : ''}</p><p>{orders.length.toLocaleString('fa-IR')} سفارش / مانده {money(remaining)}</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions" onClick={(event) => event.stopPropagation()}><span>{dateText(item.createdAt)}</span><button className="secondary mini" type="button" onClick={() => setSelectedId(item.id)}>جزئیات</button><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteCustomer(item.id), 'مشتری حذف شد')}><Trash2 size={16} /></button></div></article>;
        })}
        {filtered.length === 0 && <Empty text="مشتری پیدا نشد" />}
      </List>
    </section>
  );
}

function Collaborators({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const activeMeshTypes = data.meshTypes.filter((mesh) => mesh.isActive);
  const defaultMesh = activeMeshTypes.find((mesh) => mesh.isDefault) ?? activeMeshTypes[0] ?? data.meshTypes[0];
  const defaultActionLine = () => ({ meshTypeId: defaultMesh?.id ?? '', width: '', height: '', quantity: '1', unitPrice: String(defaultMesh?.unitPrice ?? 0), lineTotalOverride: '', lineTotalManual: false, description: '' });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('همکار');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [detailOrdersSearch, setDetailOrdersSearch] = useState('');
  const [detailOrdersStatus, setDetailOrdersStatus] = useState('all');
  const [detailInvoicesSearch, setDetailInvoicesSearch] = useState('');
  const [detailInvoicesStatus, setDetailInvoicesStatus] = useState('all');
  const [detailCustomersSearch, setDetailCustomersSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailAction, setDetailAction] = useState<'customer' | 'order' | 'invoice' | 'payment' | 'collaboratorPayment' | ''>('');
  const [actionCustomerName, setActionCustomerName] = useState('');
  const [actionCustomerPhone, setActionCustomerPhone] = useState('');
  const [actionCustomerAddress, setActionCustomerAddress] = useState('');
  const [actionCustomerNote, setActionCustomerNote] = useState('');
  const [actionOrderCustomerId, setActionOrderCustomerId] = useState(data.customers[0]?.id ?? '');
  const [actionOrderQuickCustomerName, setActionOrderQuickCustomerName] = useState('');
  const [actionOrderQuickCustomerPhone, setActionOrderQuickCustomerPhone] = useState('');
  const [actionOrderTitle, setActionOrderTitle] = useState('');
  const [actionOrderWorkType, setActionOrderWorkType] = useState<WorkType>('new_construction');
  const [actionOrderDueDate, setActionOrderDueDate] = useState(todayInput());
  const [actionOrderDiscount, setActionOrderDiscount] = useState('0');
  const [actionOrderFinalPrice, setActionOrderFinalPrice] = useState('');
  const [actionOrderFinalPriceOverridden, setActionOrderFinalPriceOverridden] = useState(false);
  const [actionOrderCreateInvoice, setActionOrderCreateInvoice] = useState(false);
  const [actionOrderNote, setActionOrderNote] = useState('');
  const [actionOrderItems, setActionOrderItems] = useState<LineDraft[]>([defaultActionLine()]);
  const [actionInvoiceOrderIds, setActionInvoiceOrderIds] = useState<string[]>([]);
  const [actionInvoiceTitle, setActionInvoiceTitle] = useState('');
  const [actionInvoiceAmount, setActionInvoiceAmount] = useState('0');
  const [actionInvoicePaid, setActionInvoicePaid] = useState('0');
  const [actionInvoiceDiscount, setActionInvoiceDiscount] = useState('0');
  const [actionInvoiceDueDate, setActionInvoiceDueDate] = useState(todayInput());
  const [actionInvoiceNote, setActionInvoiceNote] = useState('');
  const [actionPaymentInvoiceId, setActionPaymentInvoiceId] = useState('');
  const [actionPaymentAmount, setActionPaymentAmount] = useState('');
  const [directPaymentAmount, setDirectPaymentAmount] = useState('');
  const [directPaymentPaidAt, setDirectPaymentPaidAt] = useState(todayInput());
  const [directPaymentNote, setDirectPaymentNote] = useState('');
  const actionInvoiceOrders = data.orders.filter((order) => actionInvoiceOrderIds.includes(order.id));
  const actionInvoiceSelectedAmount = actionInvoiceOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const collaboratorStats = (id: string) => {
    const orders = data.orders.filter((order) => order.collaboratorId === id);
    const orderIdSet = new Set(orders.map((order) => order.id));
    const invoices = data.invoices.filter((invoice) => invoice.payerId === id || (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).some((orderId) => orderIdSet.has(orderId)));
    const directPayments = data.collaboratorPayments.filter((payment) => payment.collaboratorId === id);
    const invoiceRemaining = invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
    const remaining = Math.max(invoiceRemaining - directPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0), 0);
    const customers = data.customers.filter((customer) => customer.referredByCollaboratorId === id || orders.some((order) => order.customerId === customer.id));
    return { orders, invoices, customers, directPayments, remaining };
  };
  const filtered = data.collaborators.filter((item) => {
    const stats = collaboratorStats(item.id);
    const matchesText = (item.name + ' ' + item.phone + ' ' + item.role).toLowerCase().includes(query.trim().toLowerCase());
    const matchesOrders = ordersFilter === 'all' || (ordersFilter === 'has_orders' ? stats.orders.length > 0 : stats.orders.length === 0);
    const matchesBalance = balanceFilter === 'all' || (balanceFilter === 'debtor' ? stats.remaining > 0 : stats.remaining <= 0);
    return matchesText && matchesOrders && matchesBalance;
  });
  const reset = () => { setEditingId(''); setName(''); setPhone(''); setRole('همکار'); setNote(''); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['collaborators'][number]) => { setEditingId(item.id); setName(item.name); setPhone(item.phone); setRole(item.role); setNote(item.note); setFormOpen(true); };
  const close = () => { reset(); setFormOpen(false); };
  const closeDetailAction = () => setDetailAction('');
  const resetActionCustomer = () => { setActionCustomerName(''); setActionCustomerPhone(''); setActionCustomerAddress(''); setActionCustomerNote(''); };
  const resetActionOrder = () => {
    setActionOrderQuickCustomerName('');
    setActionOrderQuickCustomerPhone('');
    setActionOrderTitle('');
    setActionOrderWorkType('new_construction');
    setActionOrderDueDate(todayInput());
    setActionOrderDiscount('0');
    setActionOrderFinalPrice('');
    setActionOrderFinalPriceOverridden(false);
    setActionOrderCreateInvoice(false);
    setActionOrderNote('');
    setActionOrderItems([defaultActionLine()]);
  };
  const resetActionInvoice = () => { setActionInvoiceOrderIds([]); setActionInvoiceTitle(''); setActionInvoiceAmount('0'); setActionInvoicePaid('0'); setActionInvoiceDiscount('0'); setActionInvoiceDueDate(todayInput()); setActionInvoiceNote(''); };
  const resetActionPayment = () => { setActionPaymentInvoiceId(''); setActionPaymentAmount(''); };
  const resetDirectPayment = () => { setDirectPaymentAmount(''); setDirectPaymentPaidAt(todayInput()); setDirectPaymentNote(''); };
  const actionLinePricing = (item: LineDraft) => {
    const width = toNumber(item.width);
    const height = toNumber(item.height);
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const calculated = calculateLineTotal(width, height, quantity, unitPrice);
    const areaMeters = (width * height) / 10000;
    const factor = areaMeters > 1 ? areaMeters * quantity : quantity;
    const hasManualOverride = item.lineTotalManual && item.lineTotalOverride.trim() !== '';
    const effectiveTotal = hasManualOverride ? Math.max(toNumber(item.lineTotalOverride), 0) : calculated;
    const effectiveUnitPrice = factor > 0 ? effectiveTotal / factor : unitPrice;
    return { width, height, quantity, unitPrice, calculated, effectiveTotal, effectiveUnitPrice };
  };
  const actionOrderSubtotal = actionOrderItems.reduce((sum, item) => sum + actionLinePricing(item).effectiveTotal, 0);
  const actionOrderAdjustedTotal = Math.max(actionOrderSubtotal - Math.max(toNumber(actionOrderDiscount), 0), 0);
  const buildActionOrderLines = () => actionOrderItems.map((item) => {
    const mesh = data.meshTypes.find((meshType) => meshType.id === item.meshTypeId);
    const pricing = actionLinePricing(item);
    return { meshTypeId: item.meshTypeId, meshTitle: mesh?.title ?? 'آیتم', width: pricing.width, height: pricing.height, quantity: pricing.quantity, unitPrice: pricing.effectiveUnitPrice, description: item.description };
  }).filter((item) => item.meshTypeId && item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0);
  useEffect(() => { if (!actionOrderCustomerId && data.customers[0]) setActionOrderCustomerId(data.customers[0].id); }, [actionOrderCustomerId, data.customers]);
  useEffect(() => {
    if (detailAction !== 'order' || actionOrderFinalPriceOverridden) return;
    setActionOrderFinalPrice(actionOrderAdjustedTotal ? normalizeAmountInput(actionOrderAdjustedTotal) : '');
  }, [actionOrderAdjustedTotal, actionOrderFinalPriceOverridden, detailAction]);
  useEffect(() => {
    if (detailAction === 'invoice') setActionInvoiceAmount(String(actionInvoiceSelectedAmount || 0));
  }, [actionInvoiceSelectedAmount, detailAction]);
  const selected = data.collaborators.find((item) => item.id === selectedId);
  if (selected) {
    const stats = collaboratorStats(selected.id);
    const orderQuery = detailOrdersSearch.trim().toLowerCase();
    const invoiceQuery = detailInvoicesSearch.trim().toLowerCase();
    const customerQuery = detailCustomersSearch.trim().toLowerCase();
    const filteredOrders = stats.orders.filter((order) => {
      const matchesText = !orderQuery || `${order.title} ${order.customerName}`.toLowerCase().includes(orderQuery);
      const matchesStatus = detailOrdersStatus === 'all' || order.status === detailOrdersStatus;
      return matchesText && matchesStatus;
    });
    const filteredInvoices = stats.invoices.filter((invoice) => {
      const matchesText = !invoiceQuery || `${invoice.title} ${invoice.orderTitle} ${invoice.customerName}`.toLowerCase().includes(invoiceQuery);
      const matchesStatus = detailInvoicesStatus === 'all' || invoice.status === detailInvoicesStatus;
      return matchesText && matchesStatus;
    });
    const filteredCustomers = stats.customers.filter((customer) => !customerQuery || `${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(customerQuery));
    const invoicedOrderIds = new Set(data.invoices.flatMap((invoice) => invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]));
    const invoiceOrderOptions = stats.orders.filter((order) => order.status !== 'cancelled' && (!invoicedOrderIds.has(order.id) || actionInvoiceOrderIds.includes(order.id)));
    const unpaidInvoices = stats.invoices.filter((invoice) => Math.max(invoice.amount - invoice.paid, 0) > 0);
    const selectedPaymentInvoice = stats.invoices.find((invoice) => invoice.id === actionPaymentInvoiceId);
    const paymentHistory = [
      ...stats.directPayments.map((payment) => ({ id: payment.id, source: 'direct' as const, title: 'پرداخت کلی همکار', amount: payment.amount, paidAt: payment.paidAt, note: payment.note, payment })),
      ...stats.invoices.flatMap((invoice) => invoice.paid > 0 ? [{ id: `invoice-${invoice.id}`, source: 'invoice' as const, title: invoice.title || invoice.orderTitle, amount: invoice.paid, paidAt: invoice.createdAt.slice(0, 10), note: 'پرداخت فاکتور', invoice }] : [])
    ].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
    const openActionOrder = () => {
      resetActionOrder();
      setActionOrderCustomerId(stats.customers[0]?.id ?? data.customers[0]?.id ?? '');
      setDetailAction('order');
    };
    const openActionInvoice = () => {
      resetActionInvoice();
      const firstOrder = invoiceOrderOptions[0];
      if (firstOrder) {
        setActionInvoiceOrderIds([firstOrder.id]);
        setActionInvoiceAmount(String(firstOrder.total ?? 0));
        setActionInvoiceDueDate(firstOrder.dueDate || todayInput());
      }
      setDetailAction('invoice');
    };
    const openActionPayment = () => {
      resetActionPayment();
      const invoice = unpaidInvoices[0];
      if (invoice) {
        setActionPaymentInvoiceId(invoice.id);
        setActionPaymentAmount(String(Math.max(invoice.amount - invoice.paid, 0)));
      }
      setDetailAction('payment');
    };
    const openDirectPayment = () => {
      resetDirectPayment();
      setDirectPaymentAmount(stats.remaining > 0 ? String(stats.remaining) : '');
      setDetailAction('collaboratorPayment');
    };
    const toggleActionInvoiceOrder = (orderId: string) => setActionInvoiceOrderIds((prev) => prev.includes(orderId) ? prev.filter((item) => item !== orderId) : [...prev, orderId]);
    return (
      <section className="stack">
        <section className="panel section-heading"><div><h2>{selected.name}</h2><p className="muted">{selected.role} {selected.phone ? ` / ${selected.phone}` : ''}</p></div><button className="secondary" type="button" onClick={() => setSelectedId('')}>بازگشت</button></section>
        <div className="metrics"><Metric label="سفارش‌ها" value={stats.orders.length.toLocaleString('fa-IR')} /><Metric label="فاکتورها" value={stats.invoices.length.toLocaleString('fa-IR')} /><Metric label="مشتری‌ها" value={stats.customers.length.toLocaleString('fa-IR')} /><Metric label="مانده" value={money(stats.remaining)} /></div>
        <section className="panel">
          <h2>عملیات سریع</h2>
          <div className="quick-action-grid">
            <button className="secondary" type="button" onClick={() => { resetActionCustomer(); setDetailAction('customer'); }}><UserRoundPlus size={17} />ساخت مشتری</button>
            <button className="secondary" type="button" onClick={openActionOrder}><PackagePlus size={17} />ساخت سفارش</button>
            <button className="secondary" type="button" onClick={openActionInvoice} disabled={invoiceOrderOptions.length === 0}><ReceiptText size={17} />ساخت فاکتور</button>
            <button className="secondary" type="button" onClick={openActionPayment} disabled={unpaidInvoices.length === 0}><CheckCircle2 size={17} />ثبت پرداخت فاکتور</button>
            <button className="secondary" type="button" onClick={openDirectPayment} disabled={stats.remaining <= 0}><CheckCircle2 size={17} />پرداخت کلی همکار</button>
            <button className="secondary" type="button" onClick={() => document.getElementById('collaborator-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ReceiptText size={17} />مشاهده پرداخت‌ها</button>
          </div>
        </section>
        <Modal title="ساخت مشتری برای همکار" open={detailAction === 'customer'} onClose={closeDetailAction}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!actionCustomerName.trim()) throw new Error('نام مشتری لازم است'); await backend.addCustomer({ name: actionCustomerName, phone: actionCustomerPhone, address: actionCustomerAddress, note: actionCustomerNote, referredByCollaboratorId: selected.id }); resetActionCustomer(); closeDetailAction(); }, 'مشتری برای همکار ثبت شد'); }}>
            <FlowSection title="اطلاعات مشتری">
              <label>نام مشتری<input value={actionCustomerName} onChange={(event) => setActionCustomerName(event.target.value)} /></label>
              <div className="form-grid"><label>موبایل<input value={actionCustomerPhone} inputMode="tel" onChange={(event) => setActionCustomerPhone(event.target.value)} /></label><label>آدرس<input value={actionCustomerAddress} onChange={(event) => setActionCustomerAddress(event.target.value)} /></label></div>
              <label>توضیحات<textarea value={actionCustomerNote} onChange={(event) => setActionCustomerNote(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><UserRoundPlus size={18} />ثبت مشتری</button><button className="secondary" type="button" onClick={closeDetailAction}>انصراف</button></div>
          </form>
        </Modal>
        <Modal title="ساخت سفارش برای همکار" open={detailAction === 'order'} onClose={closeDetailAction}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { const lines = buildActionOrderLines(); if (!lines.length) throw new Error('حداقل یک آیتم معتبر لازم است'); let effectiveCustomerId = actionOrderCustomerId; let effectiveCustomerName = data.customers.find((customer) => customer.id === actionOrderCustomerId)?.name ?? ''; if (actionOrderQuickCustomerName.trim()) { const customer = await backend.addCustomer({ name: actionOrderQuickCustomerName, phone: actionOrderQuickCustomerPhone, referredByCollaboratorId: selected.id }); effectiveCustomerId = customer.id; effectiveCustomerName = customer.name; } if (!effectiveCustomerId) throw new Error('مشتری را انتخاب یا همان‌جا ثبت کنید'); const payloadTotal = actionOrderFinalPrice.trim() ? toNumber(actionOrderFinalPrice) : actionOrderAdjustedTotal; await backend.addOrder({ customerId: effectiveCustomerId, collaboratorId: selected.id, title: actionOrderTitle.trim() || `سفارش ${effectiveCustomerName || selected.name}`, workType: actionOrderWorkType, dueDate: actionOrderDueDate, discount: Math.max(toNumber(actionOrderDiscount), 0), totalPrice: Number.isFinite(payloadTotal) ? Math.max(payloadTotal, 0) : 0, createInitialInvoice: actionOrderCreateInvoice, note: actionOrderNote, lineItems: lines }); resetActionOrder(); closeDetailAction(); }, 'سفارش برای همکار ثبت شد'); }}>
            <FlowSection title="مشتری سفارش">
              <Picker label="انتخاب مشتری" value={actionOrderCustomerId} onChange={setActionOrderCustomerId} placeholder="مشتری را انتخاب کنید" options={data.customers.map((customer) => ({ value: customer.id, label: customer.name, helper: customer.phone }))} />
              <div className="quick-create"><label>ثبت سریع مشتری<input value={actionOrderQuickCustomerName} placeholder="نام مشتری جدید" onChange={(event) => setActionOrderQuickCustomerName(event.target.value)} /></label><label>موبایل<input value={actionOrderQuickCustomerPhone} inputMode="tel" onChange={(event) => setActionOrderQuickCustomerPhone(event.target.value)} /></label></div>
            </FlowSection>
            <FlowSection title="جزئیات سفارش">
              <label>عنوان سفارش<input value={actionOrderTitle} placeholder="مثلا نصب توری پذیرایی" onChange={(event) => setActionOrderTitle(event.target.value)} /></label>
              <div className="form-grid"><Picker label="نوع کار" value={actionOrderWorkType} onChange={(value) => setActionOrderWorkType(value as WorkType)} options={Object.entries(workTypeLabels).map(([value, label]) => ({ value, label }))} /><PersianDatePicker label="تاریخ تحویل" value={actionOrderDueDate} onChange={setActionOrderDueDate} /></div>
            </FlowSection>
            <FlowSection title={`آیتم‌ها (${actionOrderItems.length.toLocaleString('fa-IR')})`}>
              {actionOrderItems.map((item, index) => {
                const pricing = actionLinePricing(item);
                return <div className="line-item-editor" key={index}><div className="line-item-head"><strong>آیتم {index + 1}</strong><span>{money(pricing.effectiveTotal)}</span></div><Picker label="نوع توری" value={item.meshTypeId} placeholder="نوع توری را انتخاب کنید" options={(item.meshTypeId && !activeMeshTypes.some((mesh) => mesh.id === item.meshTypeId) ? [...activeMeshTypes, data.meshTypes.find((mesh) => mesh.id === item.meshTypeId)!].filter(Boolean) : activeMeshTypes).map((mesh) => ({ value: mesh.id, label: mesh.title, helper: money(mesh.unitPrice) }))} onChange={(nextValue) => { const mesh = data.meshTypes.find((meshType) => meshType.id === nextValue); setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, meshTypeId: nextValue, unitPrice: String(mesh?.unitPrice ?? row.unitPrice) } : row)); }} /><div className="form-grid four"><label>عرض<input aria-label="عرض" placeholder="cm" value={item.width} inputMode="decimal" onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, width: event.target.value } : row))} /></label><label>ارتفاع<input aria-label="ارتفاع" placeholder="cm" value={item.height} inputMode="decimal" onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, height: event.target.value } : row))} /></label><label>تعداد<input aria-label="تعداد" placeholder="عدد" value={item.quantity} inputMode="decimal" onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></label><label>قیمت<input aria-label="قیمت" placeholder="تومان" value={item.unitPrice} inputMode="numeric" onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} /></label></div><label>مبلغ نهایی ردیف<input aria-label="مبلغ نهایی ردیف" placeholder="اختیاری، تومان" value={item.lineTotalOverride} inputMode="numeric" onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, lineTotalOverride: event.target.value, lineTotalManual: true } : row))} /></label><p className="muted tiny-text">جمع محاسباتی ردیف: {money(pricing.calculated)}</p><input aria-label="توضیح آیتم" placeholder="توضیح آیتم" value={item.description} onChange={(event) => setActionOrderItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />{actionOrderItems.length > 1 && <button className="secondary danger-text" type="button" onClick={() => setActionOrderItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>حذف آیتم</button>}</div>;
              })}
              <button className="secondary full-button" type="button" onClick={() => setActionOrderItems((prev) => [...prev, defaultActionLine()])}>افزودن آیتم</button>
            </FlowSection>
            <FlowSection title="جمع و فاکتور">
              <div className="form-grid"><label>جمع ردیف‌ها<input value={money(actionOrderSubtotal)} readOnly /></label><label>تخفیف<input value={actionOrderDiscount} inputMode="numeric" onChange={(event) => setActionOrderDiscount(event.target.value)} /></label></div>
              <label>مبلغ نهایی کل<input value={actionOrderFinalPrice} inputMode="numeric" placeholder={money(actionOrderAdjustedTotal)} onChange={(event) => { setActionOrderFinalPrice(event.target.value); setActionOrderFinalPriceOverridden(true); }} /></label>
              <label className="check-row prominent-check"><input type="checkbox" checked={actionOrderCreateInvoice} onChange={(event) => setActionOrderCreateInvoice(event.target.checked)} /> ساخت فاکتور اولیه بعد از ثبت سفارش</label>
              <label>توضیحات<textarea value={actionOrderNote} onChange={(event) => setActionOrderNote(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><PackagePlus size={18} />ثبت سفارش</button><button className="secondary" type="button" onClick={closeDetailAction}>انصراف</button></div>
          </form>
        </Modal>
        <Modal title="ساخت فاکتور برای همکار" open={detailAction === 'invoice'} onClose={closeDetailAction}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!actionInvoiceOrderIds.length) throw new Error('حداقل یک سفارش انتخاب کنید'); await backend.addInvoice({ orderIds: actionInvoiceOrderIds, title: actionInvoiceTitle, amount: Number(actionInvoiceAmount), paid: Number(actionInvoicePaid), discount: Number(actionInvoiceDiscount), payerId: selected.id, dueDate: actionInvoiceDueDate, note: actionInvoiceNote }); resetActionInvoice(); closeDetailAction(); }, 'فاکتور برای همکار ثبت شد'); }}>
            <FlowSection title="سفارش‌های فاکتور">
              <div className="multi-select">
                <strong>{actionInvoiceOrderIds.length.toLocaleString('fa-IR')} سفارش انتخاب شده</strong>
                {actionInvoiceOrders.length > 0 && <p>{actionInvoiceOrders.map((order) => `${order.title} (${money(order.total)})`).join('، ')}</p>}
                <div>{invoiceOrderOptions.map((order) => <label className="check-row" key={order.id}><input type="checkbox" checked={actionInvoiceOrderIds.includes(order.id)} onChange={() => toggleActionInvoiceOrder(order.id)} />{order.title} - {order.customerName} - {money(order.total)}</label>)}{invoiceOrderOptions.length === 0 && <p className="empty">سفارش آزاد برای فاکتور وجود ندارد</p>}</div>
              </div>
            </FlowSection>
            <FlowSection title="مبلغ و پرداخت">
              <label>عنوان فاکتور<input value={actionInvoiceTitle} placeholder={actionInvoiceOrders.length ? `فاکتور ${actionInvoiceOrders.map((order) => order.title).join('، ')}` : ''} onChange={(event) => setActionInvoiceTitle(event.target.value)} /></label>
              <div className="form-grid"><label>مبلغ فاکتور<input value={actionInvoiceAmount} inputMode="numeric" onChange={(event) => setActionInvoiceAmount(event.target.value)} /></label><label>تخفیف<input value={actionInvoiceDiscount} inputMode="numeric" onChange={(event) => setActionInvoiceDiscount(event.target.value)} /></label></div>
              <label>پرداخت اولیه<input value={actionInvoicePaid} inputMode="numeric" onChange={(event) => setActionInvoicePaid(event.target.value)} /></label>
              <PersianDatePicker label="تاریخ سررسید" value={actionInvoiceDueDate} onChange={setActionInvoiceDueDate} />
              <label>توضیحات<textarea value={actionInvoiceNote} onChange={(event) => setActionInvoiceNote(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><ReceiptText size={18} />ثبت فاکتور</button><button className="secondary" type="button" onClick={closeDetailAction}>انصراف</button></div>
          </form>
        </Modal>
        <Modal title="ثبت پرداخت فاکتور همکار" open={detailAction === 'payment'} onClose={closeDetailAction}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!actionPaymentInvoiceId) throw new Error('فاکتور را انتخاب کنید'); await backend.addInvoicePayment(actionPaymentInvoiceId, Number(actionPaymentAmount)); resetActionPayment(); closeDetailAction(); }, 'پرداخت فاکتور ثبت شد'); }}>
            <FlowSection title="پرداخت">
              <Picker label="فاکتور" value={actionPaymentInvoiceId} onChange={(value) => { const invoice = stats.invoices.find((item) => item.id === value); setActionPaymentInvoiceId(value); setActionPaymentAmount(invoice ? String(Math.max(invoice.amount - invoice.paid, 0)) : ''); }} placeholder="فاکتور را انتخاب کنید" options={unpaidInvoices.map((invoice) => ({ value: invoice.id, label: invoice.title || invoice.orderTitle, helper: `مانده ${money(Math.max(invoice.amount - invoice.paid, 0))}` }))} />
              {selectedPaymentInvoice && <p className="muted">مبلغ فاکتور: {money(selectedPaymentInvoice.amount)} / پرداخت شده: {money(selectedPaymentInvoice.paid)}</p>}
              <label>مبلغ پرداخت<input value={actionPaymentAmount} inputMode="numeric" onChange={(event) => setActionPaymentAmount(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><CheckCircle2 size={18} />ثبت پرداخت</button><button className="secondary" type="button" onClick={closeDetailAction}>انصراف</button></div>
          </form>
        </Modal>
        <Modal title="ثبت پرداخت کلی همکار" open={detailAction === 'collaboratorPayment'} onClose={closeDetailAction}>
          <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { const payment = await backend.addCollaboratorPayment({ collaboratorId: selected.id, amount: Number(directPaymentAmount), paidAt: directPaymentPaidAt, note: directPaymentNote }); downloadCollaboratorPaymentPdf(payment, selected, stats.remaining); resetDirectPayment(); closeDetailAction(); }, 'پرداخت کلی همکار ثبت شد'); }}>
            <FlowSection title="پرداخت کلی">
              <p className="muted">این پرداخت به مانده کلی همکار اعمال می‌شود و به فاکتور خاصی وابسته نیست.</p>
              <label>مبلغ پرداخت<input value={directPaymentAmount} inputMode="numeric" onChange={(event) => setDirectPaymentAmount(event.target.value)} /></label>
              <PersianDatePicker label="تاریخ پرداخت" value={directPaymentPaidAt} onChange={setDirectPaymentPaidAt} />
              <label>توضیحات<textarea value={directPaymentNote} onChange={(event) => setDirectPaymentNote(event.target.value)} /></label>
            </FlowSection>
            <div className="form-actions"><button className="primary" type="submit"><CheckCircle2 size={18} />ثبت و دانلود رسید</button><button className="secondary" type="button" onClick={closeDetailAction}>انصراف</button></div>
          </form>
        </Modal>
        <List id="collaborator-payments" title="پرداخت‌های همکار">
          {paymentHistory.map((payment) => <article className="card-row" key={payment.id}><div><h3>{payment.title}</h3><p>{dateText(payment.paidAt)} / {money(payment.amount)}</p>{payment.note && <p>{payment.note}</p>}</div><div className="side-actions"><span className={`pill ${payment.source === 'direct' ? 'paid' : 'partial'}`}>{payment.source === 'direct' ? 'پرداخت کلی' : 'پرداخت فاکتور'}</span>{payment.source === 'direct' && <button className="secondary mini" type="button" onClick={() => downloadCollaboratorPaymentPdf(payment.payment, selected, stats.remaining)}><Download size={16} />رسید</button>}</div></article>)}
          {paymentHistory.length === 0 && <Empty text="پرداختی برای این همکار ثبت نشده است" />}
        </List>
        <div className="filter-grid"><SearchBox value={detailOrdersSearch} onChange={setDetailOrdersSearch} placeholder="جستجوی سفارش‌های همکار" /><Picker label="وضعیت سفارش‌ها" value={detailOrdersStatus} onChange={setDetailOrdersStatus} options={[{ value: 'all', label: 'همه سفارش‌ها' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /><button className="secondary full-button" type="button" onClick={() => { setDetailOrdersSearch(''); setDetailOrdersStatus('all'); }}>پاک کردن فیلترها</button></div>
        <List title="سفارش‌های همکار">
          {filteredOrders.map((order) => <article className="card-row order-card" key={order.id}><div><h3>{order.title}</h3><p>{order.customerName} / {workTypeLabels[order.workType]} / تحویل: {dateText(order.dueDate)}</p><strong>{money(order.total)}</strong><LineSummary items={order.lineItems} /></div><div className="side-actions"><span className={`pill ${order.status}`}>{statusLabels[order.status]}</span><button className="secondary mini label-download" type="button" onClick={() => downloadOrderLabelsPdf(order)}><Download size={16} />دانلود لیبل‌ها</button></div></article>)}
          {filteredOrders.length === 0 && <Empty text="سفارشی برای این همکار ثبت نشده است" />}
        </List>
        <div className="filter-grid"><SearchBox value={detailInvoicesSearch} onChange={setDetailInvoicesSearch} placeholder="جستجوی فاکتورهای همکار" /><Picker label="وضعیت فاکتورها" value={detailInvoicesStatus} onChange={setDetailInvoicesStatus} options={[{ value: 'all', label: 'همه فاکتورها' }, ...Object.entries(invoiceStatusLabels).map(([value, label]) => ({ value, label }))]} /><button className="secondary full-button" type="button" onClick={() => { setDetailInvoicesSearch(''); setDetailInvoicesStatus('all'); }}>پاک کردن فیلترها</button></div>
        <List title="فاکتورهای همکار">
          {filteredInvoices.map((invoice) => <article className="card-row" key={invoice.id}><div><h3>{invoice.title || invoice.orderTitle}</h3><p>{invoice.customerName} / {invoice.orderTitle}</p><p>پرداخت: {money(invoice.paid)} / {money(invoice.amount)}</p><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span></div><div className="side-actions"><button className="secondary mini" type="button" onClick={() => downloadInvoicePdf(invoice, data.orders.filter((order) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).includes(order.id)), data)}><Download size={16} />PDF</button></div></article>)}
          {filteredInvoices.length === 0 && <Empty text="فاکتوری برای این همکار ثبت نشده است" />}
        </List>
        <div className="filter-grid"><SearchBox value={detailCustomersSearch} onChange={setDetailCustomersSearch} placeholder="جستجوی مشتری‌های مرتبط" /><button className="secondary full-button" type="button" onClick={() => setDetailCustomersSearch('')}>پاک کردن فیلترها</button></div>
        <List title="مشتری‌های مرتبط">
          {filteredCustomers.map((customer) => <article className="row detail-row" key={customer.id}><div><h3>{customer.name}</h3><p>{customer.phone || 'بدون موبایل'} {customer.address ? ` / ${customer.address}` : ''}</p></div><span>{dateText(customer.createdAt)}</span></article>)}
          {filteredCustomers.length === 0 && <Empty text="مشتری مرتبطی پیدا نشد" />}
        </List>
      </section>
    );
  }
  return (
    <section className="stack">
      <PageActions title="همکاران" actionLabel="افزودن همکار" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش همکار' : 'افزودن همکار'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام همکار لازم است'); if (editingId) await backend.updateCollaborator({ id: editingId, name, phone, role, note }); else await backend.addCollaborator({ name, phone, role, note }); close(); }, editingId ? 'همکار ویرایش شد' : 'همکار ثبت شد'); }}>
          <FlowSection title="اطلاعات همکار">
            <label>نام همکار<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="form-grid"><label>موبایل<input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></label><label>نقش<input value={role} placeholder="مثلا نصاب یا تامین‌کننده" onChange={(event) => setRole(event.target.value)} /></label></div>
          </FlowSection>
          <FlowSection title="توضیحات">
            <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </FlowSection>
          <div className="form-actions"><button className="primary" type="submit"><UserRoundPlus size={18} />{editingId ? 'ویرایش همکار' : 'ثبت همکار'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی همکار" /><Picker label="فیلتر سفارش" value={ordersFilter} onChange={setOrdersFilter} options={[{ value: 'all', label: 'همه همکارها' }, { value: 'has_orders', label: 'دارای سفارش' }, { value: 'no_orders', label: 'بدون سفارش' }]} /><Picker label="فیلتر مانده" value={balanceFilter} onChange={setBalanceFilter} options={[{ value: 'all', label: 'همه مانده‌ها' }, { value: 'debtor', label: 'دارای مانده' }, { value: 'clear', label: 'تسویه شده' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setOrdersFilter('all'); setBalanceFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست همکاران">
        {filtered.map((item) => {
          const orders = data.orders.filter((order) => order.collaboratorId === item.id);
          const stats = collaboratorStats(item.id);
          return <article className="row detail-row clickable-row" key={item.id} role="button" tabIndex={0} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(item.id); }}><div><h3>{item.name}</h3><p>{item.role} {item.phone ? ` / ${item.phone}` : ''}</p><p>{orders.length.toLocaleString('fa-IR')} سفارش مرتبط / مانده {money(stats.remaining)}</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions" onClick={(event) => event.stopPropagation()}><span>{dateText(item.createdAt)}</span><button className="secondary mini" type="button" onClick={() => setSelectedId(item.id)}>جزئیات</button><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteCollaborator(item.id), 'همکار حذف شد')}><Trash2 size={16} /></button></div></article>;
        })}
        {filtered.length === 0 && <Empty text="همکاری پیدا نشد" />}
      </List>
    </section>
  );
}

function MeshTypes({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [unitPrice, setUnitPrice] = useState('0');
  const [note, setNote] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const reset = () => { setEditingId(''); setTitle(''); setUnitPrice('0'); setNote(''); setIsDefault(false); setIsActive(true); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['meshTypes'][number]) => { setEditingId(item.id); setTitle(item.title); setUnitPrice(String(item.unitPrice)); setNote(item.note); setIsDefault(Boolean(item.isDefault)); setIsActive(Boolean(item.isActive)); setFormOpen(true); };
  const close = () => { reset(); setFormOpen(false); };
  const filtered = data.meshTypes.filter((item) => {
    const matchesText = `${item.title} ${item.note}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? Boolean(item.isActive) : !item.isActive);
    return matchesText && matchesStatus;
  });
  return (
    <section className="stack">
      <PageActions title="نوع توری" actionLabel="افزودن نوع توری" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش نوع توری' : 'افزودن نوع توری'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!title.trim()) throw new Error('عنوان نوع توری لازم است'); if (editingId) await backend.updateMeshType({ id: editingId, title, unitPrice: Number(unitPrice), isActive, isDefault, note }); else await backend.addMeshType({ title, unitPrice: Number(unitPrice), isActive, isDefault, note }); close(); }, editingId ? 'نوع توری ویرایش شد' : 'نوع توری ثبت شد'); }}>
          <label>عنوان نوع توری<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>قیمت واحد<input value={unitPrice} inputMode="numeric" onChange={(event) => setUnitPrice(event.target.value)} /></label>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-grid">
            <label className="check-row"><input type="checkbox" checked={isDefault} onChange={(event) => { setIsDefault(event.target.checked); if (event.target.checked) setIsActive(true); }} />پیش‌فرض باشد</label>
            <label className="check-row"><input type="checkbox" checked={isActive} disabled={isDefault} onChange={(event) => setIsActive(event.target.checked)} />فعال باشد</label>
          </div>
          <div className="form-actions"><button className="primary" type="submit"><Grid2X2 size={18} />{editingId ? 'ویرایش نوع توری' : 'ثبت نوع توری'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی نوع توری" /><Picker label="فیلتر وضعیت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, { value: 'active', label: 'فعال' }, { value: 'inactive', label: 'غیرفعال' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setStatusFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست نوع توری">
        {filtered.map((item) => <article className="card-row" key={item.id}><div><h3>{item.title}</h3><p>{money(item.unitPrice)}</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions"><span className={`pill ${item.isDefault ? 'paid' : !item.isActive ? 'warning' : ''}`}>{item.isDefault ? 'پیش‌فرض' : item.isActive ? 'فعال' : 'غیرفعال'}</span>{!item.isDefault && <button className="secondary mini" type="button" onClick={() => void run(() => backend.updateMeshType({ id: item.id, isDefault: true, isActive: true }), 'نوع توری پیش‌فرض شد')}>پیش‌فرض</button>}{!item.isDefault && <button className="secondary mini" type="button" onClick={() => void run(() => backend.updateMeshType({ id: item.id, isActive: !item.isActive }), item.isActive ? 'نوع توری غیرفعال شد' : 'نوع توری فعال شد')}>{item.isActive ? 'غیرفعال' : 'فعال'}</button>}<button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteMeshType(item.id), 'نوع توری حذف شد')}><Trash2 size={16} /></button></div></article>)}
        {filtered.length === 0 && <Empty text="نوع توری پیدا نشد" />}
      </List>
    </section>
  );
}


type LineDraft = { meshTypeId: string; width: string; height: string; quantity: string; unitPrice: string; lineTotalOverride: string; lineTotalManual: boolean; description: string };

function Orders({
  data,
  run,
  intent,
  onIntentConsumed
}: {
  data: AppSnapshot;
  run: (action: () => Promise<void>, done?: string) => Promise<void>;
  intent: OrderIntent | null;
  onIntentConsumed: () => void;
}) {
  const activeMeshTypes = data.meshTypes.filter((mesh) => mesh.isActive);
  const defaultMesh = activeMeshTypes.find((mesh) => mesh.isDefault) ?? activeMeshTypes[0] ?? data.meshTypes[0];
  const defaultLine = () => ({ meshTypeId: defaultMesh?.id ?? '', width: '', height: '', quantity: '1', unitPrice: String(defaultMesh?.unitPrice ?? 0), lineTotalOverride: '', lineTotalManual: false, description: '' });
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? '');
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const [quickCollaboratorName, setQuickCollaboratorName] = useState('');
  const [quickCollaboratorPhone, setQuickCollaboratorPhone] = useState('');
  const [title, setTitle] = useState('');
  const [workType, setWorkType] = useState<WorkType>('new_construction');
  const [dueDate, setDueDate] = useState(todayInput());
  const [discount, setDiscount] = useState('0');
  const [finalPrice, setFinalPrice] = useState('');
  const [finalPriceOverridden, setFinalPriceOverridden] = useState(false);
  const [createInitialInvoice, setCreateInitialInvoice] = useState(false);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [collaboratorFilter, setCollaboratorFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [items, setItems] = useState<LineDraft[]>([defaultLine()]);
  const filtered = data.orders.filter((item) => {
    const matchesText = `${item.title} ${item.customerName} ${item.collaboratorName}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesWorkType = workTypeFilter === 'all' || item.workType === workTypeFilter;
    const matchesCollaborator = collaboratorFilter === 'all' || item.collaboratorId === collaboratorFilter;
    return matchesText && matchesStatus && matchesWorkType && matchesCollaborator;
  });

  useEffect(() => { if (!customerId && data.customers[0]) setCustomerId(data.customers[0].id); }, [customerId, data.customers]);
  useEffect(() => {
    if (!intent) return;
    reset();
    if (intent.customerId) setCustomerId(intent.customerId);
    if (intent.collaboratorId) setCollaboratorId(intent.collaboratorId);
    setFormOpen(true);
    onIntentConsumed();
  }, [intent?.key]);

  const reset = () => { setEditingId(''); setTitle(''); setQuickCustomerName(''); setQuickCustomerPhone(''); setCollaboratorId(''); setQuickCollaboratorName(''); setQuickCollaboratorPhone(''); setWorkType('new_construction'); setDueDate(todayInput()); setDiscount('0'); setFinalPrice(''); setFinalPriceOverridden(false); setCreateInitialInvoice(false); setNote(''); setItems([defaultLine()]); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const fillOrder = (order: Order) => {
    setEditingId(order.id);
    setCustomerId(order.customerId);
    setQuickCustomerName('');
    setQuickCustomerPhone('');
    setCollaboratorId(order.collaboratorId);
    setQuickCollaboratorName('');
    setQuickCollaboratorPhone('');
    setTitle(order.title);
    setWorkType(order.workType);
    setDueDate(order.dueDate || todayInput());
    setDiscount(String(order.discount ?? 0));
    setNote(order.note);
    const orderSubtotal = order.lineItems.reduce((sum, item) => sum + calculateLineTotal(Number(item.width), Number(item.height), Number(item.quantity), Number(item.unitPrice)), 0);
    const expectedTotal = Math.max(orderSubtotal - Number(order.discount ?? 0), 0);
    setFinalPrice(String(order.total ?? expectedTotal));
    setFinalPriceOverridden(Math.abs(Number(order.total ?? expectedTotal) - expectedTotal) > 0.01);
    setItems(order.lineItems.length ? order.lineItems.map((item) => ({ meshTypeId: item.meshTypeId, width: String(item.width), height: String(item.height), quantity: String(item.quantity), unitPrice: String(item.unitPrice), lineTotalOverride: '', lineTotalManual: false, description: item.description })) : [defaultLine()]);
    setFormOpen(true);
  };
  const linePricing = (item: LineDraft) => {
    const width = toNumber(item.width);
    const height = toNumber(item.height);
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const calculated = calculateLineTotal(width, height, quantity, unitPrice);
    const areaMeters = (width * height) / 10000;
    const factor = areaMeters > 1 ? areaMeters * quantity : quantity;
    const hasManualOverride = item.lineTotalManual && item.lineTotalOverride.trim() !== '';
    const effectiveTotal = hasManualOverride ? Math.max(toNumber(item.lineTotalOverride), 0) : calculated;
    const effectiveUnitPrice = factor > 0 ? effectiveTotal / factor : unitPrice;
    return { width, height, quantity, unitPrice, calculated, effectiveTotal, effectiveUnitPrice };
  };
  const buildLines = () => items.map((item) => {
    const mesh = data.meshTypes.find((meshType) => meshType.id === item.meshTypeId);
    const pricing = linePricing(item);
    return { meshTypeId: item.meshTypeId, meshTitle: mesh?.title ?? 'آیتم', width: pricing.width, height: pricing.height, quantity: pricing.quantity, unitPrice: pricing.effectiveUnitPrice, description: item.description };
  }).filter((item) => item.meshTypeId && item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0);
  const subtotal = items.reduce((sum, item) => sum + linePricing(item).effectiveTotal, 0);
  const adjustedTotal = Math.max(subtotal - Math.max(toNumber(discount), 0), 0);
  useEffect(() => {
    if (!formOpen || finalPriceOverridden) return;
    setFinalPrice(adjustedTotal ? normalizeAmountInput(adjustedTotal) : '');
  }, [adjustedTotal, finalPriceOverridden, formOpen]);
  const selectedOrder = data.orders.find((order) => order.id === selectedOrderId);
  if (selectedOrder) {
    const invoices = data.invoices.filter((invoice) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).includes(selectedOrder.id));
    return (
      <section className="stack">
        <section className="panel section-heading"><div><h2>{selectedOrder.title}</h2><p className="muted">{selectedOrder.customerName}{selectedOrder.collaboratorName ? ` / ${selectedOrder.collaboratorName}` : ''}</p></div><button className="secondary" type="button" onClick={() => setSelectedOrderId('')}>بازگشت</button></section>
        <div className="metrics"><Metric label="جمع سفارش" value={money(selectedOrder.total)} /><Metric label="آیتم‌ها" value={selectedOrder.lineItems.length.toLocaleString('fa-IR')} /><Metric label="وضعیت" value={statusLabels[selectedOrder.status]} /><Metric label="تحویل" value={dateText(selectedOrder.dueDate)} /></div>
        <section className="panel"><div className="side-actions inline-actions"><button className="secondary" type="button" onClick={() => downloadOrderLabelsPdf(selectedOrder)}><Download size={17} />دانلود همه لیبل‌ها</button><button className="secondary" type="button" disabled={invoices.length > 0} onClick={() => void run(() => backend.addInvoice({ orderIds: [selectedOrder.id], title: `فاکتور ${selectedOrder.title}`, amount: selectedOrder.total, paid: 0, discount: selectedOrder.discount, payerId: selectedOrder.collaboratorId, dueDate: selectedOrder.dueDate, note: '' }), 'فاکتور سفارش ثبت شد')}>افزودن فاکتور</button><button className="secondary" type="button" onClick={() => fillOrder(selectedOrder)}>ویرایش سفارش</button></div></section>
        <List title="آیتم‌های سفارش">
          {selectedOrder.lineItems.map((item, index) => <article className="line-detail" key={item.id}><div className="line-detail-head"><h3>{item.meshTitle}</h3><button className="secondary mini label-download" type="button" onClick={() => void downloadOrderLineLabelPdf(selectedOrder, item, index)}><Download size={16} />دانلود لیبل</button></div><p>ابعاد: {sizeText(item.width, item.height)} / تعداد: {numberText(item.quantity)} عدد</p><p>قیمت واحد: {money(item.unitPrice)} / جمع: {money(item.total)}</p>{item.description && <p>{item.description}</p>}</article>)}
        </List>
        <List title="فاکتورهای سفارش">
          {invoices.map((invoice) => <article className="card-row" key={invoice.id}><div><h3>{invoice.title || invoice.orderTitle}</h3><p>پرداخت: {money(invoice.paid)} / {money(invoice.amount)}</p><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span></div><div className="side-actions"><button className="secondary mini" type="button" onClick={() => downloadInvoicePdf(invoice, [selectedOrder], data)}><Download size={16} />PDF</button></div></article>)}
          {invoices.length === 0 && <Empty text="برای این سفارش هنوز فاکتور ثبت نشده است" />}
        </List>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageActions title="سفارشات" actionLabel="افزودن سفارش" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش سفارش' : 'افزودن سفارش'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { const lines = buildLines(); if (!lines.length) throw new Error('حداقل یک ردیف معتبر سفارش لازم است'); let effectiveCustomerId = customerId; let effectiveCollaboratorId = collaboratorId; let effectiveCustomerName = data.customers.find((item) => item.id === customerId)?.name ?? ''; if (quickCustomerName.trim()) { const created = await backend.addCustomer({ name: quickCustomerName, phone: quickCustomerPhone }); effectiveCustomerId = created.id; effectiveCustomerName = created.name; } if (quickCollaboratorName.trim()) { const created = await backend.addCollaborator({ name: quickCollaboratorName, phone: quickCollaboratorPhone }); effectiveCollaboratorId = created.id; } if (!effectiveCustomerId) throw new Error('مشتری را انتخاب یا همان‌جا ثبت کنید'); if (!effectiveCollaboratorId) throw new Error('همکار را انتخاب یا همان‌جا ثبت کنید'); const payloadTotal = finalPrice.trim() ? toNumber(finalPrice) : adjustedTotal; const payload = { customerId: effectiveCustomerId, collaboratorId: effectiveCollaboratorId, title: title.trim() || `سفارش ${effectiveCustomerName || todayInput()}`, workType, dueDate, discount: Math.max(toNumber(discount), 0), totalPrice: Number.isFinite(payloadTotal) ? Math.max(payloadTotal, 0) : 0, createInitialInvoice, note, lineItems: lines }; if (editingId) await backend.updateOrder({ id: editingId, ...payload }); else await backend.addOrder(payload); close(); }, editingId ? 'سفارش ویرایش شد' : 'سفارش ثبت شد'); }}>
          <FlowSection title="مشتری">
            <Picker label="انتخاب مشتری" value={customerId} onChange={setCustomerId} placeholder="مشتری را انتخاب کنید" options={data.customers.map((customer) => ({ value: customer.id, label: customer.name, helper: customer.phone }))} />
            <div className="quick-create"><label>ثبت سریع مشتری<input value={quickCustomerName} placeholder="نام مشتری جدید" onChange={(event) => setQuickCustomerName(event.target.value)} /></label><label>موبایل<input value={quickCustomerPhone} inputMode="tel" onChange={(event) => setQuickCustomerPhone(event.target.value)} /></label></div>
          </FlowSection>
          <FlowSection title="همکار">
            <Picker label="انتخاب همکار" value={collaboratorId} onChange={setCollaboratorId} placeholder="همکار را انتخاب کنید" options={data.collaborators.map((item) => ({ value: item.id, label: item.name, helper: item.role }))} />
            <div className="quick-create"><label>ثبت سریع همکار<input value={quickCollaboratorName} placeholder="نام همکار جدید" onChange={(event) => setQuickCollaboratorName(event.target.value)} /></label><label>موبایل<input value={quickCollaboratorPhone} inputMode="tel" onChange={(event) => setQuickCollaboratorPhone(event.target.value)} /></label></div>
          </FlowSection>
          <FlowSection title="جزئیات سفارش">
            <label>عنوان سفارش<input value={title} placeholder="مثلا نصب توری پذیرایی" onChange={(event) => setTitle(event.target.value)} /></label>
            <div className="form-grid">
              <Picker label="نوع کار" value={workType} onChange={(value) => setWorkType(value as WorkType)} options={Object.entries(workTypeLabels).map(([value, label]) => ({ value, label }))} />
              <PersianDatePicker label="تاریخ تحویل" value={dueDate} onChange={setDueDate} />
            </div>
          </FlowSection>
          <FlowSection title={`آیتم‌ها (${items.length.toLocaleString('fa-IR')})`}>
            {items.map((item, index) => {
              const pricing = linePricing(item);
              return <div className="line-item-editor" key={index}><div className="line-item-head"><strong>آیتم {index + 1}</strong><span>{money(pricing.effectiveTotal)}</span></div><Picker label="نوع توری" value={item.meshTypeId} placeholder="نوع توری را انتخاب کنید" options={(item.meshTypeId && !activeMeshTypes.some((mesh) => mesh.id === item.meshTypeId) ? [...activeMeshTypes, data.meshTypes.find((mesh) => mesh.id === item.meshTypeId)!].filter(Boolean) : activeMeshTypes).map((mesh) => ({ value: mesh.id, label: mesh.title, helper: money(mesh.unitPrice) }))} onChange={(nextValue) => { const mesh = data.meshTypes.find((meshType) => meshType.id === nextValue); setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, meshTypeId: nextValue, unitPrice: String(mesh?.unitPrice ?? row.unitPrice) } : row)); }} /><div className="form-grid four"><label>عرض<input aria-label="عرض" placeholder="cm" value={item.width} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, width: event.target.value } : row))} /></label><label>ارتفاع<input aria-label="ارتفاع" placeholder="cm" value={item.height} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, height: event.target.value } : row))} /></label><label>تعداد<input aria-label="تعداد" placeholder="عدد" value={item.quantity} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></label><label>قیمت<input aria-label="قیمت" placeholder="تومان" value={item.unitPrice} inputMode="numeric" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} /></label></div><label>مبلغ نهایی ردیف<input aria-label="مبلغ نهایی ردیف" placeholder="اختیاری، تومان" value={item.lineTotalOverride} inputMode="numeric" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, lineTotalOverride: event.target.value, lineTotalManual: true } : row))} onBlur={() => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index && !row.lineTotalOverride.trim() ? { ...row, lineTotalManual: false } : row))} /></label><p className="muted tiny-text">جمع محاسباتی ردیف: {money(pricing.calculated)}</p><input aria-label="توضیح آیتم" placeholder="توضیح آیتم" value={item.description} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />{items.length > 1 && <button className="secondary danger-text" type="button" onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>حذف آیتم</button>}</div>;
            })}
            <button className="secondary full-button" type="button" onClick={() => setItems((prev) => [...prev, defaultLine()])}>افزودن آیتم</button>
          </FlowSection>
          <FlowSection title="جمع و فاکتور">
            <div className="form-grid"><label>جمع ردیف‌ها<input value={money(subtotal)} readOnly /></label><label>تخفیف<input value={discount} inputMode="numeric" onChange={(event) => setDiscount(event.target.value)} /></label></div>
            <label>مبلغ نهایی کل<input value={finalPrice} inputMode="numeric" placeholder={money(adjustedTotal)} onChange={(event) => { setFinalPrice(event.target.value); setFinalPriceOverridden(true); }} /></label>
            {!editingId && <label className="check-row prominent-check"><input type="checkbox" checked={createInitialInvoice} onChange={(event) => setCreateInitialInvoice(event.target.checked)} /> ساخت فاکتور اولیه بعد از ثبت سفارش</label>}
            <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </FlowSection>
          <div className="form-actions"><button className="primary" type="submit"><PackagePlus size={18} />{editingId ? 'ویرایش سفارش' : 'ثبت سفارش'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی سفارش" /><Picker label="فیلتر وضعیت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /><Picker label="فیلتر نوع کار" value={workTypeFilter} onChange={setWorkTypeFilter} options={[{ value: 'all', label: 'همه نوع کارها' }, ...Object.entries(workTypeLabels).map(([value, label]) => ({ value, label }))]} /><Picker label="فیلتر همکار" value={collaboratorFilter} onChange={setCollaboratorFilter} options={[{ value: 'all', label: 'همه همکارها' }, ...data.collaborators.map((item) => ({ value: item.id, label: item.name, helper: item.role }))]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setWorkTypeFilter('all'); setCollaboratorFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست سفارش‌ها">
        {filtered.map((order) => <OrderCard key={order.id} order={order} onEdit={() => fillOrder(order)} onOpen={() => setSelectedOrderId(order.id)} run={run} />)}
        {filtered.length === 0 && <Empty text="سفارشی پیدا نشد" />}
      </List>
    </section>
  );
}

function OrderCard({ order, onEdit, onOpen, run, compact = false }: { order: Order; onEdit: () => void; onOpen?: () => void; run: (action: () => Promise<void>, done?: string) => Promise<void>; compact?: boolean }) {
  return (
    <article className={`card-row order-card ${onOpen ? 'clickable-row' : ''}`} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={onOpen} onKeyDown={(event) => { if (onOpen && (event.key === 'Enter' || event.key === ' ')) onOpen(); }}>
      <div>
        <h3>{order.title}</h3>
        <p>{order.customerName}{order.collaboratorName ? ` / ${order.collaboratorName}` : ''}</p>
        <p>{workTypeLabels[order.workType]} / {order.lineItems.length.toLocaleString('fa-IR')} آیتم / تحویل: {dateText(order.dueDate)}</p>
        <strong>{money(order.total)}</strong>
        <LineSummary items={order.lineItems} />
        {order.note && <p>{order.note}</p>}
      </div>
      <div className="side-actions" onClick={(event) => event.stopPropagation()}>
        {compact ? <span className={`pill ${order.status}`}>{statusLabels[order.status]}</span> : <Picker label="وضعیت سفارش" value={order.status} options={Object.entries(statusLabels).map(([key, label]) => ({ value: key, label }))} onChange={(nextValue) => void run(() => backend.setOrderStatus(order.id, nextValue as OrderStatus), 'وضعیت تغییر کرد')} />}
        <button className="secondary mini label-download" type="button" onClick={() => downloadOrderLabelsPdf(order)}><Download size={16} />دانلود لیبل‌ها</button>
        {onOpen && <button className="secondary mini" type="button" onClick={onOpen}>جزئیات</button>}
        {!compact && <button className="secondary mini" type="button" onClick={onEdit}>ویرایش</button>}
        {!compact && <button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteOrder(order.id), 'سفارش حذف شد')}><Trash2 size={16} /></button>}
      </div>
    </article>
  );
}

function LineSummary({ items }: { items: OrderLineItem[] }) {
  return (
    <div className="line-summary" role="table" aria-label="آیتم‌های سفارش">
      <div className="line-table-row line-table-head" role="row">
        <span role="columnheader">نام</span>
        <span role="columnheader">ابعاد</span>
        <span role="columnheader">تعداد</span>
      </div>
      {items.map((item) => (
        <div className="line-table-row" key={item.id} role="row">
          <strong role="cell">{item.meshTitle}</strong>
          <span role="cell" dir="ltr">{dimensionText(item.width)} × {dimensionText(item.height)}</span>
          <span role="cell">{item.quantity.toLocaleString('fa-IR')}</span>
        </div>
      ))}
    </div>
  );
}

function Invoices({
  data,
  run,
  intent,
  onIntentConsumed
}: {
  data: AppSnapshot;
  run: (action: () => Promise<void>, done?: string) => Promise<void>;
  intent: InvoiceIntent | null;
  onIntentConsumed: () => void;
}) {
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [payerId, setPayerId] = useState('');
  const [dueDate, setDueDate] = useState(todayInput());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [payments, setPayments] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const filtered = data.invoices.filter((item) => {
    const matchesText = `${item.title} ${item.customerName} ${item.orderTitle} ${item.payerName}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPayer = payerFilter === 'all' || item.payerId === payerFilter;
    return matchesText && matchesStatus && matchesPayer;
  });
  const reset = () => { setEditingId(''); setOrderIds([]); setTitle(''); setAmount('0'); setPaid('0'); setDiscount('0'); setPayerId(''); setDueDate(todayInput()); setNote(''); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const fillInvoice = (invoice: AppSnapshot['invoices'][number]) => { setEditingId(invoice.id); setOrderIds(invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]); setTitle(invoice.title); setAmount(String(invoice.amount)); setPaid(String(invoice.paid)); setDiscount(String(invoice.discount ?? 0)); setPayerId(invoice.payerId ?? ''); setDueDate(invoice.dueDate || todayInput()); setNote(invoice.note); setFormOpen(true); };
  const selectedOrders = orderIds.map((id) => data.orders.find((order) => order.id === id)).filter(Boolean) as Order[];
  const selectedAmount = selectedOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const selectedDiscount = selectedOrders.reduce((sum, order) => sum + Number(order.discount ?? 0), 0);
  const invoicedOrderIds = new Set(data.invoices.filter((invoice) => invoice.id !== editingId).flatMap((invoice) => invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]));
  const orderOptions = data.orders.filter((order) => order.status !== 'cancelled' && (!invoicedOrderIds.has(order.id) || orderIds.includes(order.id)));
  const payerOptions = Array.from(new Map(selectedOrders.filter((order) => order.collaboratorId).map((order) => [order.collaboratorId, { value: order.collaboratorId, label: order.collaboratorName, helper: 'همکار سفارش' }])).values());

  useEffect(() => {
    if (!intent) return;
    reset();
    setOrderIds(intent.orderIds ?? []);
    if (intent.payerId) setPayerId(intent.payerId);
    setFormOpen(true);
    onIntentConsumed();
  }, [intent?.key]);
  useEffect(() => { if (!editingId) setAmount(String(selectedAmount || 0)); }, [editingId, selectedAmount]);
  useEffect(() => { if (!editingId) setDiscount(String(selectedDiscount || 0)); }, [editingId, selectedDiscount]);
  useEffect(() => {
    if (!payerOptions.some((item) => item.value === payerId)) setPayerId(payerOptions[0]?.value ?? '');
  }, [payerId, payerOptions]);

  function toggleOrder(orderId: string) {
    setOrderIds((prev) => prev.includes(orderId) ? prev.filter((item) => item !== orderId) : [...prev, orderId]);
  }
  const selectedInvoice = data.invoices.find((invoice) => invoice.id === selectedInvoiceId);
  if (selectedInvoice) {
    const invoiceOrders = data.orders.filter((order) => (selectedInvoice.orderIds?.length ? selectedInvoice.orderIds : [selectedInvoice.orderId]).includes(order.id));
    const remain = Math.max(selectedInvoice.amount - selectedInvoice.paid, 0);
    return (
      <section className="stack">
        <section className="panel section-heading"><div><h2>{selectedInvoice.title || selectedInvoice.orderTitle}</h2><p className="muted">{selectedInvoice.customerName} / {selectedInvoice.payerName || '-'}</p></div><button className="secondary" type="button" onClick={() => setSelectedInvoiceId('')}>بازگشت</button></section>
        <div className="metrics"><Metric label="مبلغ" value={money(selectedInvoice.amount)} /><Metric label="پرداخت" value={money(selectedInvoice.paid)} /><Metric label="مانده" value={money(remain)} /><Metric label="وضعیت" value={invoiceStatusLabels[selectedInvoice.status]} /></div>
        <section className="panel"><div className="side-actions inline-actions"><button className="secondary" type="button" onClick={() => downloadInvoicePdf(selectedInvoice, invoiceOrders, data)}><Download size={17} />دانلود PDF فاکتور</button><button className="secondary" type="button" onClick={() => fillInvoice(selectedInvoice)}>ویرایش فاکتور</button></div><div className="payment-inline detail-payment"><input aria-label="مبلغ پرداخت" placeholder="مبلغ پرداخت" inputMode="numeric" value={payments[selectedInvoice.id] ?? ''} onChange={(event) => setPayments((prev) => ({ ...prev, [selectedInvoice.id]: event.target.value }))} /><button className="secondary" type="button" onClick={() => void run(() => backend.addInvoicePayment(selectedInvoice.id, Number(payments[selectedInvoice.id] ?? 0)), 'پرداخت ثبت شد')}>ثبت پرداخت</button></div></section>
        <List title="سفارش‌های فاکتور">
          {invoiceOrders.map((order) => <article className="card-row order-card" key={order.id}><div><h3>{order.title}</h3><p>{order.customerName}{order.collaboratorName ? ` / ${order.collaboratorName}` : ''}</p><strong>{money(order.total)}</strong><LineSummary items={order.lineItems} /></div><div className="side-actions"><span className={`pill ${order.status}`}>{statusLabels[order.status]}</span><button className="secondary mini label-download" type="button" onClick={() => downloadOrderLabelsPdf(order)}><Download size={16} />دانلود لیبل‌ها</button></div></article>)}
          {invoiceOrders.length === 0 && <Empty text="سفارش مرتبطی پیدا نشد" />}
        </List>
        {selectedInvoice.note && <section className="panel"><h2>توضیحات</h2><p>{selectedInvoice.note}</p></section>}
      </section>
    );
  }

  return (
    <section className="stack">
      <PageActions title="فاکتورها" actionLabel="افزودن فاکتور" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش فاکتور' : 'افزودن فاکتور'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!orderIds.length) throw new Error('حداقل یک سفارش انتخاب کنید'); if (!payerId) throw new Error('همکار بدهکار را انتخاب کنید'); const payload = { orderIds, title, amount: Number(amount), paid: Number(paid), discount: Number(discount), payerId, dueDate, note }; if (editingId) await backend.updateInvoice({ id: editingId, ...payload }); else await backend.addInvoice(payload); close(); }, editingId ? 'فاکتور ویرایش شد' : 'فاکتور ثبت شد'); }}>
          <FlowSection title="سفارش‌های فاکتور">
            <div className="multi-select">
              <strong>{orderIds.length.toLocaleString('fa-IR')} سفارش انتخاب شده</strong>
              {selectedOrders.length > 0 && <p>{selectedOrders.map((order) => `${order.title} (${money(order.total)})`).join('، ')}</p>}
              <div>
                {orderOptions.map((order) => <label className="check-row" key={order.id}><input type="checkbox" checked={orderIds.includes(order.id)} onChange={() => toggleOrder(order.id)} /> {order.title} - {order.customerName} - {money(order.total)}</label>)}
                {orderOptions.length === 0 && <p className="empty">سفارش آزاد برای فاکتور وجود ندارد</p>}
              </div>
            </div>
          </FlowSection>
          <FlowSection title="همکار بدهکار">
            <Picker label="همکار بدهکار" value={payerId} onChange={setPayerId} placeholder="بعد از انتخاب سفارش" options={payerOptions} />
            <label>عنوان فاکتور<input value={title} placeholder={selectedOrders.length ? `فاکتور ${selectedOrders.map((order) => order.title).join('، ')}` : ''} onChange={(event) => setTitle(event.target.value)} /></label>
          </FlowSection>
          <FlowSection title="مبلغ و پرداخت">
            <div className="form-grid"><label>مبلغ فاکتور<input value={amount} inputMode="numeric" onChange={(event) => setAmount(event.target.value)} /></label><label>تخفیف<input value={discount} inputMode="numeric" onChange={(event) => setDiscount(event.target.value)} /></label></div>
            <label>پرداخت اولیه<input value={paid} inputMode="numeric" onChange={(event) => setPaid(event.target.value)} /></label>
            <PersianDatePicker label="تاریخ سررسید" value={dueDate} onChange={setDueDate} />
          </FlowSection>
          <FlowSection title="یادداشت">
            <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </FlowSection>
          <div className="form-actions"><button className="primary" type="submit"><ReceiptText size={18} />{editingId ? 'ویرایش فاکتور' : 'ثبت فاکتور'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی فاکتور" /><Picker label="فیلتر پرداخت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه فاکتورها' }, ...Object.entries(invoiceStatusLabels).map(([value, label]) => ({ value, label }))]} /><Picker label="فیلتر همکار بدهکار" value={payerFilter} onChange={setPayerFilter} options={[{ value: 'all', label: 'همه همکارها' }, ...data.collaborators.map((item) => ({ value: item.id, label: item.name, helper: item.role }))]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setPayerFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست فاکتورها">
        {filtered.map((invoice) => {
          const remain = Math.max(invoice.amount - invoice.paid, 0);
          const invoiceOrders = data.orders.filter((order) => (invoice.orderIds?.length ? invoice.orderIds : [invoice.orderId]).includes(order.id));
          return <article className="card-row clickable-row" key={invoice.id} role="button" tabIndex={0} onClick={() => setSelectedInvoiceId(invoice.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedInvoiceId(invoice.id); }}><div><h3>{invoice.title || invoice.customerName}</h3><p>{invoice.customerName} / {invoice.orderTitle}</p><p>همکار بدهکار: {invoice.payerName || '-'}</p><p>پرداخت شده: {money(invoice.paid)} / {money(invoice.amount)}</p><p>تخفیف: {money(invoice.discount ?? 0)} / سررسید: {dateText(invoice.dueDate)}</p><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span>{invoice.note && <p>{invoice.note}</p>}</div><div className="side-actions" onClick={(event) => event.stopPropagation()}><button className="secondary" type="button" disabled={remain <= 0} onClick={() => void run(() => backend.addInvoicePayment(invoice.id, remain), 'پرداخت ثبت شد')}><CheckCircle2 size={17} />تسویه</button><div className="payment-inline"><input aria-label="مبلغ پرداخت" placeholder="مبلغ" inputMode="numeric" value={payments[invoice.id] ?? ''} onChange={(event) => setPayments((prev) => ({ ...prev, [invoice.id]: event.target.value }))} /><button className="secondary" type="button" onClick={() => void run(() => backend.addInvoicePayment(invoice.id, Number(payments[invoice.id] ?? 0)), 'پرداخت ثبت شد')}>ثبت</button></div><button className="secondary mini" type="button" onClick={() => downloadInvoicePdf(invoice, invoiceOrders, data)}><Download size={16} />PDF</button><button className="secondary mini" type="button" onClick={() => setSelectedInvoiceId(invoice.id)}>جزئیات</button><button className="secondary mini" type="button" onClick={() => fillInvoice(invoice)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteInvoice(invoice.id), 'فاکتور حذف شد')}><Trash2 size={16} /></button></div></article>;
        })}
        {filtered.length === 0 && <Empty text="فاکتوری پیدا نشد" />}
      </List>
    </section>
  );
}

function Inventory({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('عدد');
  const [minQuantity, setMinQuantity] = useState('0');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase');
  const [adjustAmount, setAdjustAmount] = useState('1');
  const [adjustNote, setAdjustNote] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const reset = () => { setEditingId(''); setName(''); setQuantity('0'); setUnit('عدد'); setMinQuantity('0'); setNote(''); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['inventory'][number]) => { setEditingId(item.id); setName(item.name); setQuantity(String(item.quantity)); setUnit(item.unit); setMinQuantity(String(item.minQuantity)); setNote(item.note); setFormOpen(true); };
  const filtered = data.inventory.filter((item) => {
    const matchesText = `${item.name} ${item.unit} ${item.note}`.toLowerCase().includes(query.trim().toLowerCase());
    const isLow = item.quantity <= item.minQuantity;
    const matchesStock = stockFilter === 'all' || (stockFilter === 'low' ? isLow : !isLow);
    return matchesText && matchesStock;
  });
  const totalQuantity = data.inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lowStock = data.inventory.filter((item) => item.quantity <= item.minQuantity).length;
  const adjustItem = data.inventory.find((item) => item.id === adjustItemId);
  const openAdjust = (item: AppSnapshot['inventory'][number]) => { setAdjustItemId(item.id); setAdjustType('increase'); setAdjustAmount('1'); setAdjustNote(''); };
  const closeAdjust = () => { setAdjustItemId(''); setAdjustAmount('1'); setAdjustNote(''); };
  return (
    <section className="stack">
      <PageActions title="انبار" actionLabel="افزودن کالا" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش کالا' : 'افزودن کالا'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام کالا لازم است'); if (editingId) await backend.updateInventoryItem({ id: editingId, name, quantity: Number(quantity), unit, minQuantity: Number(minQuantity), note }); else await backend.addInventoryItem({ name, quantity: Number(quantity), unit, minQuantity: Number(minQuantity), note }); close(); }, editingId ? 'کالا ویرایش شد' : 'کالا ثبت شد'); }}>
          <label>نام کالا<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="form-grid"><label>موجودی<input value={quantity} inputMode="numeric" onChange={(event) => setQuantity(event.target.value)} /></label><label>واحد<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>
          <label>حد هشدار<input value={minQuantity} inputMode="numeric" onChange={(event) => setMinQuantity(event.target.value)} /></label>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><PackagePlus size={18} />{editingId ? 'ویرایش کالا' : 'ثبت کالا'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <Modal title={`انبارگردانی ${adjustItem?.name ?? ''}`} open={Boolean(adjustItem)} onClose={closeAdjust}>
        {adjustItem && <form className="compact-form" onSubmit={(event) => { event.preventDefault(); const amount = Math.max(Number(adjustAmount || 0), 0); const delta = adjustType === 'increase' ? amount : -amount; void run(async () => { await backend.adjustInventory(adjustItem.id, delta); closeAdjust(); }, adjustNote.trim() ? `موجودی تغییر کرد - ${adjustNote.trim()}` : 'موجودی تغییر کرد'); }}>
          <p className="muted">موجودی فعلی: {adjustItem.quantity.toLocaleString('fa-IR')} {adjustItem.unit}</p>
          <div className="segmented"><button type="button" className={adjustType === 'increase' ? 'active' : ''} onClick={() => setAdjustType('increase')}>افزایش</button><button type="button" className={adjustType === 'decrease' ? 'active' : ''} onClick={() => setAdjustType('decrease')}>کاهش</button></div>
          <label>مقدار<input value={adjustAmount} inputMode="numeric" onChange={(event) => setAdjustAmount(event.target.value)} /></label>
          <label>توضیح تغییر<textarea value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit">ثبت تغییر</button><button className="secondary" type="button" onClick={closeAdjust}>انصراف</button></div>
        </form>}
      </Modal>
      <div className="metrics"><Metric label="کل اقلام" value={data.inventory.length.toLocaleString('fa-IR')} /><Metric label="کل موجودی" value={totalQuantity.toLocaleString('fa-IR')} /><Metric label="کم‌موجودی" value={lowStock.toLocaleString('fa-IR')} /></div>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی کالا" /><Picker label="فیلتر موجودی" value={stockFilter} onChange={setStockFilter} options={[{ value: 'all', label: 'همه کالاها' }, { value: 'low', label: 'کم‌موجودی' }, { value: 'normal', label: 'موجودی کافی' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setStockFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست انبار">
        {filtered.map((item) => <article className="card-row" key={item.id}><div><h3>{item.name}</h3><p>{item.quantity.toLocaleString('fa-IR')} {item.unit} / حد هشدار {item.minQuantity.toLocaleString('fa-IR')}</p>{item.quantity <= item.minQuantity && <span className="pill warning">کمبود</span>}{item.note && <p>{item.note}</p>}</div><div className="stepper"><button type="button" className="wide-step" onClick={() => openAdjust(item)}>انبارگردانی</button><button type="button" className="wide-step" onClick={() => openEdit(item)}>ویرایش</button><button type="button" onClick={() => void run(() => backend.adjustInventory(item.id, -1), 'موجودی کم شد')}><Minus size={18} /></button><button type="button" onClick={() => void run(() => backend.adjustInventory(item.id, 1), 'موجودی زیاد شد')}>+</button><button type="button" className="danger-mini" onClick={() => void run(() => backend.deleteInventoryItem(item.id), 'کالا حذف شد')}><Trash2 size={16} /></button></div></article>)}
        {filtered.length === 0 && <Empty text="کالایی پیدا نشد" />}
      </List>
    </section>
  );
}

function UsersPage({ data, run, assistantTabs, onSaveAssistantTabs }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void>; assistantTabs: Tab[]; onSaveAssistantTabs: (tabs: Tab[]) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('assistant');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [selectedRole, setSelectedRole] = useState('assistant');
  const [permissionDraft, setPermissionDraft] = useState<Tab[]>(assistantTabs);
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => setPermissionDraft(assistantTabs), [assistantTabs]);
  const reset = () => { setEditingId(''); setUsername(''); setName(''); setPin(''); setRole('assistant'); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['users'][number]) => { setEditingId(item.id); setUsername(item.username); setName(item.name); setPin(''); setRole(item.role); setFormOpen(true); };
  const filtered = data.users.filter((item) => {
    const matchesText = `${item.name} ${item.username}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || statusFilter === 'active';
    return matchesText && matchesRole && matchesStatus;
  });
  const selectedUser = data.users.find((item) => item.id === selectedId);
  return (
    <section className="stack">
      <PageActions title="کاربران" actionLabel="افزودن کاربر" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش کاربر' : 'افزودن کاربر'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!username.trim() || !name.trim() || (!pin.trim() && !editingId)) throw new Error('اطلاعات کاربر کامل نیست'); if (editingId) await backend.updateUser({ id: editingId, username, name, pin, role }); else await backend.addUser({ username, name, pin, role }); close(); }, editingId ? 'کاربر ویرایش شد' : 'کاربر ثبت شد'); }}>
          <div className="form-grid"><label>نام<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>نام کاربری<input value={username} dir="ltr" onChange={(event) => setUsername(event.target.value)} /></label></div>
          <div className="form-grid"><label>رمز محلی<input value={pin} inputMode="numeric" onChange={(event) => setPin(event.target.value)} /></label><Picker label="نقش" value={role} onChange={setRole} options={[{ value: 'assistant', label: 'دستیار' }, { value: 'manager', label: 'مدیر' }]} /></div>
          <div className="form-actions"><button className="primary" type="submit"><ShieldCheck size={18} />{editingId ? 'ویرایش کاربر' : 'ثبت کاربر'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <Modal title="جزئیات کاربر" open={Boolean(selectedUser)} onClose={() => setSelectedId('')}>
        {selectedUser && <div className="stack"><div className="metrics"><Metric label="نام" value={selectedUser.name} /><Metric label="نقش" value={selectedUser.role === 'manager' ? 'مدیر' : 'دستیار'} /></div><p dir="ltr">{selectedUser.username}</p><p className="muted">همه کاربران لوکال فعلا فعال هستند و حذف کاربر تنها وضعیت غیرفعال واقعی سایت را جایگزین می‌کند.</p></div>}
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی نام یا نام کاربری" /><Picker label="فیلتر نقش" value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'همه نقش‌ها' }, { value: 'manager', label: 'مدیر' }, { value: 'assistant', label: 'دستیار' }]} /><Picker label="فیلتر وضعیت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, { value: 'active', label: 'فعال' }, { value: 'disabled', label: 'غیرفعال' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setRoleFilter('all'); setStatusFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لیست کاربران">
        {filtered.map((item) => <article className="row clickable-row" key={item.id} role="button" tabIndex={0} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(item.id); }}><div><h3>{item.name}</h3><p dir="ltr">{item.username}</p><p className="muted">وضعیت: فعال</p></div><div className="row-actions" onClick={(event) => event.stopPropagation()}><span className="pill">{item.role === 'manager' ? 'مدیر' : 'دستیار'}</span><button className="secondary mini" type="button" onClick={() => setSelectedId(item.id)}>جزئیات</button><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteUser(item.id), 'کاربر حذف شد')}><Trash2 size={16} /></button></div></article>)}
        {filtered.length === 0 && <Empty text="کاربری پیدا نشد" />}
      </List>
      <section className="panel"><h2>دسترسی نقش‌ها</h2><Picker label="نقش" value={selectedRole} onChange={setSelectedRole} options={[{ value: 'assistant', label: 'دستیار' }, { value: 'manager', label: 'مدیر' }]} /><div className="permission-grid">{permissionLabels.map((item) => { const key = item.key as Tab; const checked = selectedRole === 'manager' || permissionDraft.includes(key); return <label className="check-row" key={item.key}><input type="checkbox" checked={checked} disabled={selectedRole === 'manager' || key === 'dashboard'} onChange={(event) => { setPermissionDraft((prev) => event.target.checked ? normalizeTabs([...prev, key]) : normalizeTabs(prev.filter((tabKey) => tabKey !== key))); }} />{item.label}</label>; })}</div><button className="secondary" type="button" disabled={selectedRole === 'manager'} onClick={() => void onSaveAssistantTabs(permissionDraft)}>ذخیره دسترسی‌ها</button></section>
    </section>
  );
}


function Notifications({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [dismissed, setDismissed] = useState<string[]>([]);
  const generated = dueNotifications(data);
  const allNotifications = [
    ...generated.map((item) => ({ ...item, seen: 0, generated: true })),
    ...data.notifications.map((item) => ({ ...item, level: item.seen ? 'info' : 'warning', generated: false }))
  ].filter((item) => !dismissed.includes(item.id));
  const filtered = allNotifications.filter((item) => {
    const matchesText = `${item.title} ${item.body}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesLevel = levelFilter === 'all' || item.level === levelFilter;
    return matchesText && matchesLevel;
  });
  const unseen = allNotifications.filter((item) => !item.seen).length;
  return (
    <section className="stack">
      <section className="panel section-heading"><div><h2>اعلان‌ها</h2><p className="muted">{unseen.toLocaleString('fa-IR')} اعلان خوانده نشده</p></div><button className="secondary" type="button" onClick={() => void run(() => backend.markNotificationsSeen(), 'اعلان‌ها خوانده شد')}>تایید همه</button></section>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجو در اعلان‌ها" /><Picker label="سطح اعلان" value={levelFilter} onChange={setLevelFilter} options={[{ value: 'all', label: 'همه اعلان‌ها' }, { value: 'critical', label: 'بحرانی' }, { value: 'warning', label: 'هشدار' }, { value: 'info', label: 'اطلاع‌رسانی' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setLevelFilter('all'); }}>پاک کردن فیلترها</button></div>
      <div className="list">
        {filtered.map((item) => <article className="row notification-row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p><p className="muted">{item.level === 'critical' ? 'بحرانی' : item.level === 'warning' ? 'هشدار' : 'اطلاع‌رسانی'}</p></div><div className="row-actions">{!item.seen && <span className="dot" />}<button className="secondary mini" type="button" onClick={() => setDismissed((prev) => [...prev, item.id])}>تایید</button></div></article>)}
        {filtered.length === 0 && <Empty text="اعلانی وجود ندارد" />}
      </div>
    </section>
  );
}

function ActivityLog({ data }: { data: AppSnapshot }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const types = Array.from(new Set(data.activities.map((item) => item.type))).filter(Boolean);
  const actions = Array.from(new Set(data.activities.map((item) => item.title))).filter(Boolean);
  const filtered = data.activities.filter((item) => {
    const matchesText = `${item.type} ${item.title} ${item.body}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesAction = actionFilter === 'all' || item.title === actionFilter;
    return matchesText && matchesType && matchesAction;
  });
  return <section className="stack"><div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجو: کاربر، نوع، عملیات، شرح" /><Picker label="نوع موجودیت" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'همه نوع‌ها' }, ...types.map((value) => ({ value, label: activityTypeLabel(value) }))]} /><Picker label="عملیات" value={actionFilter} onChange={setActionFilter} options={[{ value: 'all', label: 'همه عملیات‌ها' }, ...actions.map((value) => ({ value, label: value }))]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setTypeFilter('all'); setActionFilter('all'); }}>پاک کردن فیلترها</button></div><List title="گزارش عملیات">{filtered.map((item) => <article className="row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p><p className="muted">{activityTypeLabel(item.type)}</p></div><span>{dateText(item.createdAt)}</span></article>)}{filtered.length === 0 && <Empty text="هنوز عملیاتی ثبت نشده است" />}</List></section>;
}

function Reports({ data }: { data: AppSnapshot }) {
  const totalSales = data.invoices.reduce((sum, item) => sum + item.amount, 0);
  const received = data.invoices.reduce((sum, item) => sum + item.paid, 0) + data.collaboratorPayments.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(totalSales - received, 0);
  const delivered = data.orders.filter((item) => item.status === 'delivered').length;
  const cancelled = data.orders.filter((item) => item.status === 'cancelled').length;
  return (
    <section className="stack">
      <div className="metrics"><Metric label="کل فروش" value={money(totalSales)} /><Metric label="دریافت شده" value={money(received)} /><Metric label="مانده" value={money(remaining)} /><Metric label="تحویل/لغو" value={`${delivered.toLocaleString('fa-IR')} / ${cancelled.toLocaleString('fa-IR')}`} /></div>
      <List title="گزارش سفارش‌ها">{Object.entries(statusLabels).map(([status, label]) => <article className="row" key={status}><div><h3>{label}</h3><p>{data.orders.filter((item) => item.status === status).length.toLocaleString('fa-IR')} سفارش</p></div><span>{money(data.orders.filter((item) => item.status === status).reduce((sum, item) => sum + item.total, 0))}</span></article>)}</List>
      <List title="گزارش انبار کم‌موجودی">{data.inventory.filter((item) => item.quantity <= item.minQuantity).map((item) => <article className="row" key={item.id}><div><h3>{item.name}</h3><p>{item.quantity.toLocaleString('fa-IR')} {item.unit}</p></div><span className="pill warning">کمبود</span></article>)}{data.inventory.every((item) => item.quantity > item.minQuantity) && <Empty text="کمبود موجودی ندارید" />}</List>
    </section>
  );
}

function Backup({ data, run, reload, backupInterval, onSaveBackupInterval }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void>; reload: () => Promise<void>; backupInterval: number; onSaveBackupInterval: (minutes: number) => Promise<void> }) {
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [intervalInput, setIntervalInput] = useState(String(backupInterval));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  useEffect(() => setIntervalInput(String(backupInterval)), [backupInterval]);
  function download() {
    const filename = `best-mobile-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadText(filename, json, 'application/json;charset=utf-8');
    void run(() => backend.recordBackup(filename), 'بکاپ اجرا شد');
  }
  const backupRows = data.activities.filter((item) => item.type === 'backup').map((item) => ({ ...item, status: item.title.includes('بازیابی') ? 'SUCCESS' : 'SUCCESS' }));
  const filteredBackups = backupRows.filter((item) => {
    const matchesText = `${item.id} ${item.title} ${item.body} ${dateText(item.createdAt)}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesText && matchesStatus;
  });
  async function importFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as AppSnapshot;
    await run(async () => { await backend.importSnapshot(parsed); await reload(); }, 'بکاپ بازیابی شد');
  }
  return (
    <section className="stack">
      <section className="panel"><h2>پشتیبان داده‌ها</h2><p className="muted">همه داده‌ها داخل SQLite گوشی ذخیره می‌شود. خروجی JSON برای انتقال دستی یا نگهداری امن است و با آپدیت APK پاک نمی‌شود.</p><div className="form-grid"><label>فاصله بکاپ خودکار (دقیقه)<input value={intervalInput} inputMode="numeric" onChange={(event) => setIntervalInput(event.target.value)} /></label><button className="secondary" type="button" onClick={() => void onSaveBackupInterval(Number(intervalInput))}>ذخیره تنظیمات</button></div><button className="primary" type="button" onClick={download}><Database size={18} />اجرای بکاپ و دانلود</button><label className="upload-button"><Upload size={18} />ریستور JSON<input type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></label></section>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجو: شناسه بکاپ، تاریخ، فایل" /><Picker label="وضعیت بکاپ" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, { value: 'SUCCESS', label: 'موفق' }, { value: 'FAILED', label: 'ناموفق' }, { value: 'PENDING', label: 'در انتظار' }]} /><button className="secondary full-button" type="button" onClick={() => { setQuery(''); setStatusFilter('all'); }}>پاک کردن فیلترها</button></div>
      <List title="لاگ بکاپ‌ها">
        {filteredBackups.map((item) => <article className="row detail-row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p><p className="muted">{dateText(item.createdAt)}</p></div><div className="row-actions"><span className="pill paid">موفق</span><button className="secondary mini" type="button" onClick={download}><Download size={16} />دانلود JSON</button></div></article>)}
        {filteredBackups.length === 0 && <Empty text="لاگ بکاپی پیدا نشد" />}
      </List>
      <pre className="backup-preview">{json}</pre>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={18} /><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function List({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return <section id={id} className="section"><h2>{title}</h2><div className="list">{children}</div></section>;
}

function FlowSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flow-section"><h3>{title}</h3>{children}</section>;
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function dueNotifications(data: AppSnapshot) {
  const nowDate = new Date();
  const soon = new Date(nowDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  const orders = data.orders.filter((order) => order.dueDate && !['delivered', 'cancelled'].includes(order.status) && new Date(order.dueDate) <= soon).map((order) => ({ id: `order-${order.id}`, title: `موعد سفارش ${order.title}`, body: `تاریخ تحویل: ${dateText(order.dueDate)}`, level: new Date(order.dueDate) < nowDate ? 'critical' : 'warning' }));
  const invoices = data.invoices.filter((invoice) => invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) <= soon).map((invoice) => ({ id: `invoice-${invoice.id}`, title: `سررسید فاکتور ${invoice.title}`, body: `${invoice.customerName} - مانده ${money(invoice.amount - invoice.paid)}`, level: new Date(invoice.dueDate) < nowDate ? 'critical' : 'warning' }));
  return [...orders, ...invoices];
}

function activityTypeLabel(value: string) {
  const labels: Record<string, string> = {
    order: 'سفارش',
    invoice: 'فاکتور',
    customer: 'مشتری',
    collaborator: 'همکار',
    inventory: 'انبار',
    mesh: 'نوع توری',
    user: 'کاربر',
    backup: 'بکاپ'
  };
  return labels[value] ?? value;
}

function safeFilePart(value: string) {
  return (value || 'best').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim().slice(0, 80) || 'best';
}
function downloadHtmlPdf(filename: string, html: string, widthMm = 0, heightMm = 0, openAfterSave = true) {
  if (window.BestAndroid?.saveHtmlPdfFile) {
    window.BestAndroid.saveHtmlPdfFile(filename, html, widthMm, heightMm, openAfterSave);
    return;
  }

  downloadText(filename.replace(/\.pdf$/i, '.html'), html, 'text/html;charset=utf-8');
}

function escapeHtml(value: string) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

async function downloadOrderLabelsPdf(order: Order) {
  const labelItems = order.lineItems.length ? order.lineItems : [{ id: 'empty', width: 0, height: 0, quantity: 1, meshTitle: '', meshTypeId: '', unitPrice: 0, total: 0, description: '' }];
  const fontFaceCss = await getLabelFontFaceCss();
  if (window.BestAndroid?.saveHtmlPdfFile) {
    labelItems.forEach((item, index) => {
      saveDashboardLabelPdf(order, item, index, fontFaceCss, index === 0);
    });
    return;
  }

  saveDashboardLabelPdf(order, labelItems[0], 0, fontFaceCss, true);
}

async function downloadOrderLineLabelPdf(order: Order, item: OrderLineItem, index: number) {
  const fontFaceCss = await getLabelFontFaceCss();
  saveDashboardLabelPdf(order, item, index, fontFaceCss, true);
}

function saveDashboardLabelPdf(order: Order, item: OrderLineItem, index: number, fontFaceCss: string, openAfterSave: boolean) {
  const fileName = buildDashboardLabelFileName(order, item, index);
  const html = renderDashboardLabelHtml(order, item, fontFaceCss);
  if (window.BestAndroid?.saveHtmlPdfFile) {
    window.BestAndroid.saveHtmlPdfFile(fileName, html, 34, 24, openAfterSave);
    return;
  }

  downloadHtmlPdf(fileName, html, 34, 24);
}

async function downloadInvoicePdf(invoice: Invoice, orders: Order[] = [], data?: AppSnapshot) {
  const logoDataUri = await getTorbestLogoDataUri();
  downloadHtmlPdf(`best-invoice-${safeFilePart(invoice.invoiceNumber || invoice.title || invoice.orderTitle || invoice.id)}.pdf`, renderInvoiceHtml(invoice, orders, logoDataUri, data));
}

function downloadCollaboratorPaymentPdf(payment: AppSnapshot['collaboratorPayments'][number], collaborator: AppSnapshot['collaborators'][number], remainingBefore = 0) {
  const remainingAfter = Math.max(remainingBefore - Number(payment.amount ?? 0), 0);
  downloadHtmlPdf(`best-collaborator-payment-${safeFilePart(collaborator.name)}-${safeFilePart(payment.paidAt)}.pdf`, renderPaymentReceiptHtml(payment, collaborator, remainingBefore, remainingAfter));
}

let torbestLogoDataUriPromise: Promise<string | null> | null = null;

function getTorbestLogoDataUri() {
  torbestLogoDataUriPromise ??= fetch(torbestLogoUrl)
    .then((response) => response.blob())
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
  return torbestLogoDataUriPromise;
}

let labelFontFaceCssPromise: Promise<string> | null = null;

function getLabelFontFaceCss() {
  labelFontFaceCssPromise ??= Promise
    .all([
      fontFaceRule('Vazirmatn', 400, vazirmatnArabic400Url),
      fontFaceRule('Vazirmatn', 600, vazirmatnArabic600Url),
      fontFaceRule('Vazirmatn', 700, vazirmatnArabic700Url),
      fontFaceRule('Vazirmatn', 900, vazirmatnArabic900Url)
    ])
    .then((rules) => rules.join(''))
    .catch(() => '');
  return labelFontFaceCssPromise;
}

async function fontFaceRule(family: string, weight: number, url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const dataUri = await blobToDataUri(blob);
  return `@font-face{font-family:'${family}';src:url(${dataUri}) format('woff2');font-weight:${weight};font-style:normal;font-display:swap;}`;
}

function blobToDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function renderDashboardLabelHtml(order: Order, item: OrderLineItem, fontFaceCss = '') {
  const dimensions = `${dimensionText(item.width)}\u00d7${dimensionText(item.height)}`;
  const customerName = order.customerName || '-';
  const collaboratorPhone = order.collaboratorPhone || '-';
  const dimensionFontSize = pickLabelFontSize(dimensions, 18.4, 13.2);
  const customerFontSize = pickLabelFontSize(customerName, 12.6, 8.8);
  const phoneFontSize = pickLabelFontSize(collaboratorPhone, 10.8, 7.8);

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
${fontFaceCss}
@page{
  size:34mm 24mm;
  margin:0;
}
*{box-sizing:border-box}
html,body{
  margin:0;
  padding:0;
  width:34mm;
  height:24mm;
}
body{
  font-family:Vazirmatn,Tahoma,sans-serif;
  direction:rtl;
  color:#0f172a;
  background:#fff;
  display:flex;
  justify-content:center;
  align-items:center;
  overflow:hidden;
}
.label{
  width:33mm;
  height:23mm;
  border:1px solid #cbd5e1;
  border-radius:1.5mm;
  display:flex;
  justify-content:center;
  align-items:center;
  box-sizing:border-box;
  background:#fff;
}
.rotated-content{
  transform:rotate(-90deg) translateY(-8mm);
  transform-origin:center;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:0.7mm;
}
.line{
  text-align:center;
  line-height:1.12;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.line-1{
  font-weight:900;
  letter-spacing:0.32mm;
}
.line-2{
  transform:translateY(2mm);
  font-weight:700
}
.line-3{
  transform:translateY(5mm);
  font-weight:600;
  letter-spacing:0.32mm;
  direction:ltr;
  unicode-bidi:plaintext;
  font-variant-numeric:tabular-nums;
}
</style>
</head>
<body>
  <div class="label">
    <div class="rotated-content">
      <div class="line line-1" style="font-size:${dimensionFontSize}px">${escapeHtml(dimensions)}</div>
      <div class="line line-2" style="font-size:${customerFontSize}px">${escapeHtml(customerName)}</div>
      <div class="line line-3" style="font-size:${phoneFontSize}px">${escapeHtml(collaboratorPhone)}</div>
    </div>
  </div>
</body>
</html>`;
}

function buildDashboardLabelFileName(order: Order, item: OrderLineItem, index: number) {
  const customerName = normalizeLabelFileNamePart(order.customerName || 'بدون-مشتری');
  const collaboratorName = normalizeLabelFileNamePart(order.collaboratorName || order.collaboratorPhone || 'بدون-همکار');
  const dimensions = `${dimensionText(item.width)}x${dimensionText(item.height)}`;
  return `لیبل-${customerName}-${collaboratorName}-${dimensions}-${index + 1}.pdf`;
}

function normalizeLabelFileNamePart(value: string) {
  return (value || '')
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim() || 'بدون-نام';
}

function pickLabelFontSize(value: string, baseSize: number, minSize: number) {
  const textLength = String(value ?? '').trim().length;
  if (textLength <= 10) return baseSize;
  if (textLength <= 14) return Math.max(baseSize - 1, minSize);
  if (textLength <= 18) return Math.max(baseSize - 2, minSize);
  if (textLength <= 24) return Math.max(baseSize - 3, minSize);
  return minSize;
}

function renderInvoiceHtml(invoice: Invoice, orders: Order[], logoDataUri: string | null, data?: AppSnapshot) {
  const invoiceOrders = orders.length ? orders : [];
  const combinedItems = invoiceOrders.flatMap((order) => order.lineItems.map((item) => ({ ...item, orderTitle: order.title })));
  const orderTitle = invoiceOrders.length ? invoiceOrders.map((order) => order.title).join(' + ') : invoice.orderTitle || '-';
  const buyerName = invoice.payerName || invoiceOrders[0]?.collaboratorName || '-';
  const buyer = data?.collaborators.find((collaborator) => collaborator.id === invoice.payerId);
  const buyerPhone = buyer?.phone || invoiceOrders.find((order) => order.collaboratorPhone)?.collaboratorPhone || '-';
  const buyerAddress = '-';
  const sellerName = 'تولیدی توربست';
  const sellerPhone = '09124617758 - 09004617758';
  const sellerAddress = 'میانجاده، جنب خیابان عدل، بن‌بست 12، پلاک 1';
  const discountAmount = moneyNumber(invoice.discount);
  const finalAmount = moneyNumber(invoice.amount);
  const subtotal = Math.max(finalAmount + discountAmount, 0);
  const previousRemaining = moneyNumber(data ? calculatePreviousRemaining(invoice, data) : 0);
  const finalPayableAmount = finalAmount + previousRemaining;
  const rows = combinedItems.map((item, index) => `<tr><td>${index + 1}</td><td class="name-cell"><div class="item-title">${escapeHtml(item.meshTitle || 'آیتم')}</div><div class="item-sub">(${escapeHtml(`${dimensionText(item.width)} × ${dimensionText(item.height)}`)})</div></td><td>${numberText(item.quantity)}</td><td>${formatPdfMoney(item.unitPrice)}</td><td>${formatPdfMoney(item.total)}</td><td class="desc-cell">${escapeHtml(item.description || item.orderTitle || '-')}</td></tr>`).join('') || `<tr><td colspan="6">قلمی برای این فاکتور ثبت نشده است.</td></tr>`;
  const summaryRows = [
    `<div class="sum-row"><div class="sum-label">جمع جزء</div><div class="sum-amount">${formatPdfMoney(subtotal)}</div></div>`,
    discountAmount > 0 ? `<div class="sum-row"><div class="sum-label">تخفیف</div><div class="sum-amount">${formatPdfMoney(discountAmount)}</div></div>` : '',
    `<div class="sum-row final"><div class="sum-label">مبلغ کل فاکتور (تومان)</div><div class="sum-amount">${formatPdfMoney(finalAmount)}</div></div>`,
    previousRemaining > 0 ? `<div class="sum-row carry"><div class="sum-label">مانده قبلی</div><div class="sum-amount">${formatPdfMoney(previousRemaining)}</div></div>` : '',
    previousRemaining > 0 ? `<div class="sum-row final payable"><div class="sum-label">مبلغ نهایی قابل پرداخت</div><div class="sum-amount">${formatPdfMoney(finalPayableAmount)}</div></div>` : ''
  ].filter(Boolean).join('');

  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8" /><style>
@page{size:A4;margin:12mm 10mm}
:root{--text:#111827;--muted:#6b7280;--border:#d6d9df;--soft:#f8fafc;--heading:#0f172a}
*{box-sizing:border-box}
html,body{width:100%;min-height:0}
body{margin:0;padding:12mm 10mm;box-sizing:border-box;color:var(--text);background:#fff;font-family:Vazirmatn,Tahoma,sans-serif;font-size:12.5px;line-height:1.65;direction:rtl}
.invoice{width:100%;margin:0 auto;padding:0}
.header{display:grid;grid-template-columns:1.05fr 1.2fr .65fr;gap:14px;align-items:stretch;margin-bottom:14px}
.meta{border-left:1px solid var(--border);padding-left:10px;align-content:center}
.meta-grid,.party-info{display:grid;grid-template-columns:auto auto 1fr;row-gap:6px;column-gap:8px;font-size:12.5px}
.label{color:var(--muted);font-weight:600;white-space:nowrap}
.meta-grid strong,.party-info strong{font-size:13px;font-weight:700;color:var(--heading)}
.title-block{border-left:1px solid var(--border);border-right:1px solid var(--border);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:4px 12px}
.title-block h1{margin:0;font-size:36px;line-height:1.15;color:#020617;font-weight:800;letter-spacing:-.4px}
.logo-card{border:1px solid var(--border);border-radius:12px;background:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:6px;padding:8px}
.logo-image{width:100%;max-width:140px;max-height:130px;object-fit:contain}
.logo-fallback{font-size:19px;font-weight:800;color:#f59e0b;letter-spacing:1px}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.party-card{border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:#fff}
.party-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.party-header h3{margin:0;font-size:22px;line-height:1.1;color:var(--heading);font-weight:800}
.table-wrap{margin:8px 0 12px;border:1px solid var(--border);border-radius:12px;background:#fff;overflow:hidden}
table{width:100%;border-collapse:separate;border-spacing:0;margin:0;table-layout:auto}
thead{display:table-header-group}
th,td{border:0;border-inline-start:1px solid var(--border);border-bottom:1px solid var(--border);padding:9px 10px;font-size:12.5px;text-align:center;vertical-align:middle;page-break-inside:avoid;break-inside:avoid}
th:first-child,td:first-child{border-inline-start:0} tbody tr:last-child td{border-bottom:0}
th{background:#f3f4f6;color:#111827;font-weight:700;white-space:nowrap}
td{white-space:nowrap}.name-cell,.desc-cell{text-align:right;white-space:normal;word-break:normal;overflow-wrap:break-word;line-height:1.45}
.item-title{font-weight:700;color:#111827;margin-bottom:2px}.item-sub{font-size:12px;color:#4b5563;direction:ltr;unicode-bidi:plaintext;text-align:right}
.summary{border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px}
.sum-row{display:flex;align-items:center;border-bottom:1px solid var(--border);min-height:42px;background:#fff}.sum-row:last-child{border-bottom:0}
.sum-label{flex:1;text-align:right;padding:0 14px;font-size:14px;color:#111827;font-weight:600}
.sum-amount{width:220px;border-right:1px solid var(--border);text-align:left;padding:0 14px;font-size:16px;font-weight:700;color:#111827;direction:ltr;unicode-bidi:plaintext}
.sum-row.final .sum-label,.sum-row.final .sum-amount{font-size:18px;font-weight:800;color:#0b1220;background:var(--soft)}.sum-row.carry .sum-label,.sum-row.carry .sum-amount{font-size:16px;font-weight:800}.sum-row.payable .sum-label,.sum-row.payable .sum-amount{background:#eef2ff}
.notes{border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:12px;text-align:right}.notes-head{font-size:15px;font-weight:700;margin-bottom:8px}
.thank-you{text-align:center;color:#374151;font-size:12px;font-weight:500;margin:0}
.header,.party-grid,.party-card,.summary,.notes,.footer,tr{page-break-inside:avoid;break-inside:avoid}
</style></head><body><div class="invoice">
<section class="header"><div class="meta"><div class="meta-grid"><span class="label">شماره فاکتور</span><span>:</span><strong>${escapeHtml(invoice.invoiceNumber || invoice.id.slice(0, 8))}</strong><span class="label">تاریخ فاکتور</span><span>:</span><strong>${escapeHtml(dateText(invoice.createdAt))}</strong><span class="label">ساعت</span><span>:</span><strong>${escapeHtml(timeText(invoice.createdAt))}</strong><span class="label">شماره سفارش</span><span>:</span><strong>${escapeHtml(orderTitle)}</strong></div></div><div class="title-block"><h1>فاکتور فروش</h1></div><div class="logo-card">${logoDataUri ? `<img class="logo-image" src="${logoDataUri}" alt="لوگوی توربست" />` : '<span class="logo-fallback">TORBEST</span>'}</div></section>
<section class="party-grid"><article class="party-card"><div class="party-header"><h3>خریدار</h3></div><div class="party-info"><span class="label">نام خریدار</span><span>:</span><strong>${escapeHtml(buyerName)}</strong><span class="label">شماره همراه</span><span>:</span><strong>${escapeHtml(buyerPhone)}</strong><span class="label">آدرس</span><span>:</span><strong>${escapeHtml(buyerAddress)}</strong></div></article><article class="party-card"><div class="party-header"><h3>فروشنده</h3></div><div class="party-info"><span class="label">نام فروشگاه</span><span>:</span><strong>${escapeHtml(sellerName)}</strong><span class="label">تلفن</span><span>:</span><strong>${escapeHtml(sellerPhone)}</strong><span class="label">آدرس</span><span>:</span><strong>${escapeHtml(sellerAddress)}</strong></div></article></section>
<div class="table-wrap"><table><thead><tr><th style="width:54px;">ردیف</th><th>نام کالا</th><th style="width:72px;">تعداد</th><th style="width:138px;">قیمت واحد (تومان)</th><th style="width:148px;">مبلغ کل (تومان)</th><th style="width:170px;">توضیحات</th></tr></thead><tbody>${rows}</tbody></table></div>
<section class="summary">${summaryRows}</section>${invoice.note ? `<section class="notes"><div class="notes-head">توضیحات</div><p>${escapeHtml(invoice.note)}</p></section>` : ''}<footer class="footer"><p class="thank-you">از اعتماد و خرید شما سپاسگزاریم.</p></footer></div></body></html>`;
}

function calculatePreviousRemaining(invoice: Invoice, data: AppSnapshot) {
  const payerId = invoice.payerId;
  if (!payerId) return 0;
  const invoiceTime = new Date(invoice.createdAt).getTime();
  const safeInvoiceTime = Number.isFinite(invoiceTime) ? invoiceTime : Date.now();
  const previousInvoices = data.invoices.filter((item) => {
    if (item.id === invoice.id || item.payerId !== payerId) return false;
    const itemTime = new Date(item.createdAt).getTime();
    return Number.isFinite(itemTime) && itemTime < safeInvoiceTime;
  });
  const previousDebt = previousInvoices.reduce((sum, item) => sum + Math.max(moneyNumber(item.amount) - moneyNumber(item.paid), 0), 0);
  const previousDirectPayments = data.collaboratorPayments
    .filter((payment) => {
      if (payment.collaboratorId !== payerId) return false;
      const paymentTime = new Date(payment.paidAt || payment.createdAt).getTime();
      return Number.isFinite(paymentTime) && paymentTime < safeInvoiceTime;
    })
    .reduce((sum, payment) => sum + moneyNumber(payment.amount), 0);
  return Math.max(previousDebt - previousDirectPayments, 0);
}

function renderPaymentReceiptHtml(payment: AppSnapshot['collaboratorPayments'][number], collaborator: AppSnapshot['collaborators'][number], remainingBefore: number, remainingAfter: number) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8" /><style>@page{size:A4;margin:14mm 12mm}html,body{width:100%;min-height:0}body{margin:0;padding:14mm 12mm;box-sizing:border-box;font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;font-size:13px;line-height:1.65}.wrap{border:1px solid #dbe2ea;border-radius:14px;padding:16px}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.title{font-size:24px;font-weight:800;margin:0}.sub{color:#64748b;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.card{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff}.label{color:#64748b;font-size:12px}.value{font-size:15px;font-weight:700;margin-top:3px}.table{border:1px solid #dbe2ea;border-radius:10px;overflow:hidden;margin-top:8px}.row{display:flex;border-bottom:1px solid #e2e8f0;min-height:42px;align-items:center}.row:last-child{border-bottom:0}.cell-label{flex:1;padding:0 12px;font-weight:600}.cell-value{width:260px;border-right:1px solid #e2e8f0;padding:0 12px;text-align:left;direction:ltr;unicode-bidi:plaintext;font-weight:700}.final{background:#f8fafc;font-size:15px}.note{margin-top:12px;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fcfcfd}</style></head><body><div class="wrap"><div class="head"><div><h1 class="title">رسید پرداخت</h1></div><div class="sub">${escapeHtml(dateText(payment.paidAt))}</div></div><div class="grid"><div class="card"><div class="label">نام</div><div class="value">${escapeHtml(collaborator.name)}</div></div><div class="card"><div class="label">شماره تماس</div><div class="value">${escapeHtml(collaborator.phone || '-')}</div></div></div><div class="table"><div class="row"><div class="cell-label">مانده قبل از رسید (تومان)</div><div class="cell-value">${formatPdfMoney(remainingBefore)}</div></div><div class="row"><div class="cell-label">مبلغ رسید (تومان)</div><div class="cell-value">${formatPdfMoney(payment.amount)}</div></div><div class="row final"><div class="cell-label">مانده بعد از رسید (تومان)</div><div class="cell-value">${formatPdfMoney(remainingAfter)}</div></div></div><div class="note"><span class="label">توضیح پرداخت:</span><div class="value">${escapeHtml(payment.note || '-')}</div></div></div></body></html>`;
}

function formatPdfMoney(value: number) {
  return moneyNumber(value).toLocaleString('fa-IR');
}

function timeText(iso?: string) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function downloadText(filename: string, content: string, type: string) {
  if (window.BestAndroid?.saveTextFile) {
    window.BestAndroid.saveTextFile(filename, content, type);
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
