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
  FileSpreadsheet,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  PackagePlus,
  Printer,
  ReceiptText,
  Search,
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
import type { AppSnapshot, DashboardStats, InvoiceStatus, Order, OrderLineItem, OrderStatus, WorkType } from '../data/types';

declare global {
  interface Window {
    BestAndroid?: {
      saveTextFile: (filename: string, content: string, mimeType: string) => string;
    };
  }
}

type Tab = 'dashboard' | 'orders' | 'invoices' | 'collaborators' | 'customers' | 'mesh' | 'warehouse' | 'users' | 'backups' | 'notifications' | 'activity' | 'reports';

const emptySnapshot: AppSnapshot = {
  customers: [],
  orders: [],
  invoices: [],
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
  { key: 'notifications', label: 'اعلان‌ها', icon: Bell },
  { key: 'activity', label: 'عملیات', icon: Activity },
  { key: 'reports', label: 'گزارش', icon: BarChart3 }
];

const quickTabs: Tab[] = ['dashboard', 'orders', 'invoices', 'collaborators', 'customers'];

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

const money = (value: number) => `${Math.round(value || 0).toLocaleString('fa-IR')} تومان`;
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

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<AppSnapshot>(emptySnapshot);
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('assistant');

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
      await reload();
      setReady(true);
    })();
  }, []);

  const stats = useMemo<DashboardStats>(
    () => ({
      customers: data.customers.length,
      activeOrders: data.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
      unpaidTotal: data.invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0),
      lowStock: data.inventory.filter((item) => item.quantity <= item.minQuantity).length,
      todayOrders: data.orders.filter((order) => order.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
    }),
    [data]
  );

  const managerOnlyTabs: Tab[] = ['users', 'backups', 'activity', 'reports'];
  const availableTabs = useMemo(() => tabs.filter((item) => role === 'manager' || !managerOnlyTabs.includes(item.key)), [role]);
  const activeTabLabel = availableTabs.find((item) => item.key === tab)?.label ?? '';

  function closeMenu() {
    document.querySelector('details.menu-details')?.removeAttribute('open');
  }

  function goTo(nextTab: Tab) {
    setTab(nextTab);
    closeMenu();
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
        </nav>
        <button className="drawer-logout" type="button" onClick={() => { backend.logout(); setAuthed(false); }}>
          <LogOut size={19} />
          خروج از حساب
        </button>
      </aside>

      <main className="content">
        {message && <div className="toast">{message}</div>}
        {tab === 'dashboard' && <Dashboard data={data} stats={stats} />}
        {tab === 'orders' && <Orders data={data} run={run} />}
        {tab === 'invoices' && <Invoices data={data} run={run} />}
        {tab === 'collaborators' && <Collaborators data={data} run={run} />}
        {tab === 'customers' && <Customers data={data} run={run} />}
        {tab === 'mesh' && <MeshTypes data={data} run={run} />}
        {tab === 'warehouse' && <Inventory data={data} run={run} />}
        {tab === 'users' && role === 'manager' && <UsersPage data={data} run={run} />}
        {tab === 'backups' && role === 'manager' && <Backup data={data} run={run} reload={reload} />}
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

function Customers({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const filtered = data.customers.filter((item) => (item.name + ' ' + item.phone + ' ' + item.address).toLowerCase().includes(query.trim().toLowerCase()));
  const reset = () => { setEditingId(''); setName(''); setPhone(''); setAddress(''); setNote(''); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['customers'][number]) => { setEditingId(item.id); setName(item.name); setPhone(item.phone); setAddress(item.address); setNote(item.note); setFormOpen(true); };
  const close = () => { reset(); setFormOpen(false); };
  return (
    <section className="stack">
      <PageActions title="مشتریان" actionLabel="افزودن مشتری" onAction={openCreate}>
        <button className="secondary" type="button" onClick={() => exportCustomersCsv(filtered)}><FileSpreadsheet size={17} /> CSV</button>
      </PageActions>
      <Modal title={editingId ? 'ویرایش مشتری' : 'افزودن مشتری'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام مشتری لازم است'); if (editingId) await backend.updateCustomer({ id: editingId, name, phone, address, note }); else await backend.addCustomer({ name, phone, address, note }); close(); }, editingId ? 'مشتری ویرایش شد' : 'مشتری ثبت شد'); }}>
          <label>نام مشتری<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="form-grid"><label>موبایل<input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></label><label>آدرس<input value={address} onChange={(event) => setAddress(event.target.value)} /></label></div>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><UserRoundPlus size={18} />{editingId ? 'ویرایش مشتری' : 'ثبت مشتری'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <SearchBox value={query} onChange={setQuery} placeholder="جستجوی مشتری" />
      <List title="لیست مشتریان">
        {filtered.map((item) => {
          const orders = data.orders.filter((order) => order.customerId === item.id);
          const invoices = data.invoices.filter((invoice) => orders.some((order) => order.id === invoice.orderId));
          const remaining = invoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);
          return <article className="row detail-row" key={item.id}><div><h3>{item.name}</h3><p>{item.phone || 'بدون موبایل'} {item.address ? ` / ${item.address}` : ''}</p><p>{orders.length.toLocaleString('fa-IR')} سفارش / مانده {money(remaining)}</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions"><span>{dateText(item.createdAt)}</span><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteCustomer(item.id), 'مشتری حذف شد')}><Trash2 size={16} /></button></div></article>;
        })}
        {filtered.length === 0 && <Empty text="مشتری پیدا نشد" />}
      </List>
    </section>
  );
}

function Collaborators({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('همکار');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const filtered = data.collaborators.filter((item) => (item.name + ' ' + item.phone + ' ' + item.role).toLowerCase().includes(query.trim().toLowerCase()));
  const reset = () => { setEditingId(''); setName(''); setPhone(''); setRole('همکار'); setNote(''); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['collaborators'][number]) => { setEditingId(item.id); setName(item.name); setPhone(item.phone); setRole(item.role); setNote(item.note); setFormOpen(true); };
  const close = () => { reset(); setFormOpen(false); };
  return (
    <section className="stack">
      <PageActions title="همکاران" actionLabel="افزودن همکار" onAction={openCreate} />
      <Modal title={editingId ? 'ویرایش همکار' : 'افزودن همکار'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام همکار لازم است'); if (editingId) await backend.updateCollaborator({ id: editingId, name, phone, role, note }); else await backend.addCollaborator({ name, phone, role, note }); close(); }, editingId ? 'همکار ویرایش شد' : 'همکار ثبت شد'); }}>
          <label>نام همکار<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="form-grid"><label>موبایل<input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} /></label><label>نقش<input value={role} onChange={(event) => setRole(event.target.value)} /></label></div>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><UserRoundPlus size={18} />{editingId ? 'ویرایش همکار' : 'ثبت همکار'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <SearchBox value={query} onChange={setQuery} placeholder="جستجوی همکار" />
      <List title="لیست همکاران">
        {filtered.map((item) => {
          const orders = data.orders.filter((order) => order.collaboratorId === item.id);
          return <article className="row detail-row" key={item.id}><div><h3>{item.name}</h3><p>{item.role} {item.phone ? ` / ${item.phone}` : ''}</p><p>{orders.length.toLocaleString('fa-IR')} سفارش مرتبط</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions"><span>{dateText(item.createdAt)}</span><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteCollaborator(item.id), 'همکار حذف شد')}><Trash2 size={16} /></button></div></article>;
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
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی نوع توری" /><Picker label="فیلتر وضعیت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, { value: 'active', label: 'فعال' }, { value: 'inactive', label: 'غیرفعال' }]} /></div>
      <List title="لیست نوع توری">
        {filtered.map((item) => <article className="card-row" key={item.id}><div><h3>{item.title}</h3><p>{money(item.unitPrice)}</p>{item.note && <p>{item.note}</p>}</div><div className="row-actions"><span className={`pill ${item.isDefault ? 'paid' : !item.isActive ? 'warning' : ''}`}>{item.isDefault ? 'پیش‌فرض' : item.isActive ? 'فعال' : 'غیرفعال'}</span>{!item.isDefault && <button className="secondary mini" type="button" onClick={() => void run(() => backend.updateMeshType({ id: item.id, isDefault: true, isActive: true }), 'نوع توری پیش‌فرض شد')}>پیش‌فرض</button>}{!item.isDefault && <button className="secondary mini" type="button" onClick={() => void run(() => backend.updateMeshType({ id: item.id, isActive: !item.isActive }), item.isActive ? 'نوع توری غیرفعال شد' : 'نوع توری فعال شد')}>{item.isActive ? 'غیرفعال' : 'فعال'}</button>}<button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteMeshType(item.id), 'نوع توری حذف شد')}><Trash2 size={16} /></button></div></article>)}
        {filtered.length === 0 && <Empty text="نوع توری پیدا نشد" />}
      </List>
    </section>
  );
}


type LineDraft = { meshTypeId: string; width: string; height: string; quantity: string; unitPrice: string; description: string };

function Orders({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const activeMeshTypes = data.meshTypes.filter((mesh) => mesh.isActive);
  const defaultMesh = activeMeshTypes.find((mesh) => mesh.isDefault) ?? activeMeshTypes[0] ?? data.meshTypes[0];
  const defaultLine = () => ({ meshTypeId: defaultMesh?.id ?? '', width: '1', height: '1', quantity: '1', unitPrice: String(defaultMesh?.unitPrice ?? 0), description: '' });
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? '');
  const [collaboratorId, setCollaboratorId] = useState('');
  const [title, setTitle] = useState('');
  const [workType, setWorkType] = useState<WorkType>('new_construction');
  const [dueDate, setDueDate] = useState(todayInput());
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [items, setItems] = useState<LineDraft[]>([defaultLine()]);
  const filtered = data.orders.filter((item) => `${item.title} ${item.customerName} ${item.collaboratorName}`.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter));

  useEffect(() => { if (!customerId && data.customers[0]) setCustomerId(data.customers[0].id); }, [customerId, data.customers]);

  const reset = () => { setEditingId(''); setTitle(''); setCollaboratorId(''); setWorkType('new_construction'); setDueDate(todayInput()); setDiscount('0'); setNote(''); setItems([defaultLine()]); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const fillOrder = (order: Order) => {
    setEditingId(order.id);
    setCustomerId(order.customerId);
    setCollaboratorId(order.collaboratorId);
    setTitle(order.title);
    setWorkType(order.workType);
    setDueDate(order.dueDate || todayInput());
    setDiscount(String(order.discount ?? 0));
    setNote(order.note);
    setItems(order.lineItems.length ? order.lineItems.map((item) => ({ meshTypeId: item.meshTypeId, width: String(item.width), height: String(item.height), quantity: String(item.quantity), unitPrice: String(item.unitPrice), description: item.description })) : [defaultLine()]);
    setFormOpen(true);
  };
  const buildLines = () => items.map((item) => {
    const mesh = data.meshTypes.find((meshType) => meshType.id === item.meshTypeId);
    return { meshTypeId: item.meshTypeId, meshTitle: mesh?.title ?? 'آیتم', width: Number(item.width), height: Number(item.height), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), description: item.description };
  });
  const subtotal = items.reduce((sum, item) => sum + Math.max(Number(item.width), 0) * Math.max(Number(item.height), 0) * Math.max(Number(item.quantity), 0) * Math.max(Number(item.unitPrice), 0), 0);

  return (
    <section className="stack">
      <PageActions title="سفارشات" actionLabel="افزودن سفارش" onAction={openCreate}>
        <button className="secondary" type="button" onClick={() => exportOrdersCsv(filtered)}><FileSpreadsheet size={17} /> CSV</button>
      </PageActions>
      <Modal title={editingId ? 'ویرایش سفارش' : 'افزودن سفارش'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!customerId) throw new Error('اول یک مشتری ثبت کنید'); if (!title.trim()) throw new Error('عنوان سفارش لازم است'); const payload = { customerId, collaboratorId, title, workType, dueDate, discount: Number(discount), note, lineItems: buildLines() }; if (editingId) await backend.updateOrder({ id: editingId, ...payload }); else await backend.addOrder(payload); close(); }, editingId ? 'سفارش ویرایش شد' : 'سفارش ثبت شد'); }}>
          <Picker label="مشتری" value={customerId} onChange={setCustomerId} placeholder="اول مشتری ثبت کنید" options={data.customers.map((customer) => ({ value: customer.id, label: customer.name, helper: customer.phone }))} />
          <Picker label="همکار" value={collaboratorId} onChange={setCollaboratorId} placeholder="بدون همکار" options={[{ value: '', label: 'بدون همکار' }, ...data.collaborators.map((item) => ({ value: item.id, label: item.name, helper: item.role }))]} />
          <label>عنوان سفارش<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="form-grid">
            <Picker label="نوع کار" value={workType} onChange={(value) => setWorkType(value as WorkType)} options={Object.entries(workTypeLabels).map(([value, label]) => ({ value, label }))} />
            <PersianDatePicker label="تاریخ تحویل" value={dueDate} onChange={setDueDate} />
          </div>
          {items.map((item, index) => <div className="line-item-editor" key={index}><Picker label="نوع توری" value={item.meshTypeId} placeholder="نوع توری را انتخاب کنید" options={(item.meshTypeId && !activeMeshTypes.some((mesh) => mesh.id === item.meshTypeId) ? [...activeMeshTypes, data.meshTypes.find((mesh) => mesh.id === item.meshTypeId)!].filter(Boolean) : activeMeshTypes).map((mesh) => ({ value: mesh.id, label: mesh.title, helper: money(mesh.unitPrice) }))} onChange={(nextValue) => { const mesh = data.meshTypes.find((meshType) => meshType.id === nextValue); setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, meshTypeId: nextValue, unitPrice: String(mesh?.unitPrice ?? row.unitPrice) } : row)); }} /><div className="form-grid four"><input aria-label="عرض" placeholder="عرض" value={item.width} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, width: event.target.value } : row))} /><input aria-label="ارتفاع" placeholder="ارتفاع" value={item.height} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, height: event.target.value } : row))} /><input aria-label="تعداد" placeholder="تعداد" value={item.quantity} inputMode="decimal" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /><input aria-label="قیمت" placeholder="قیمت" value={item.unitPrice} inputMode="numeric" onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} /></div><input aria-label="توضیح آیتم" placeholder="توضیح آیتم" value={item.description} onChange={(event) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />{items.length > 1 && <button className="secondary danger-text" type="button" onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>حذف آیتم</button>}</div>)}
          <button className="secondary" type="button" onClick={() => setItems((prev) => [...prev, defaultLine()])}>افزودن آیتم</button>
          <div className="form-grid"><label>تخفیف<input value={discount} inputMode="numeric" onChange={(event) => setDiscount(event.target.value)} /></label><label>جمع سفارش<input value={money(Math.max(subtotal - Number(discount || 0), 0))} readOnly /></label></div>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><PackagePlus size={18} />{editingId ? 'ویرایش سفارش' : 'ثبت سفارش'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی سفارش" /><Picker label="فیلتر وضعیت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه وضعیت‌ها' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /></div>
      <List title="لیست سفارش‌ها">
        {filtered.map((order) => <OrderCard key={order.id} order={order} onEdit={() => fillOrder(order)} run={run} />)}
        {filtered.length === 0 && <Empty text="سفارشی پیدا نشد" />}
      </List>
    </section>
  );
}

function OrderCard({ order, onEdit, run }: { order: Order; onEdit: () => void; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  return (
    <article className="card-row order-card">
      <div>
        <h3>{order.title}</h3>
        <p>{order.customerName}{order.collaboratorName ? ` / ${order.collaboratorName}` : ''}</p>
        <p>{workTypeLabels[order.workType]} / {order.lineItems.length.toLocaleString('fa-IR')} آیتم / تحویل: {dateText(order.dueDate)}</p>
        <strong>{money(order.total)}</strong>
        <div className="line-summary">{order.lineItems.map((item: OrderLineItem) => <span key={item.id}>{item.meshTitle}: {item.width}×{item.height}، {item.quantity} عدد</span>)}</div>
        {order.note && <p>{order.note}</p>}
      </div>
      <div className="side-actions">
        <Picker label="وضعیت سفارش" value={order.status} options={Object.entries(statusLabels).map(([key, label]) => ({ value: key, label }))} onChange={(nextValue) => void run(() => backend.setOrderStatus(order.id, nextValue as OrderStatus), 'وضعیت تغییر کرد')} />
        <button className="secondary mini" type="button" onClick={onEdit}>ویرایش</button>
        <button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteOrder(order.id), 'سفارش حذف شد')}><Trash2 size={16} /></button>
      </div>
    </article>
  );
}

function Invoices({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [orderId, setOrderId] = useState(data.orders[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [dueDate, setDueDate] = useState(todayInput());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [payments, setPayments] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = data.invoices.filter((item) => `${item.title} ${item.customerName} ${item.orderTitle}`.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter));
  const reset = () => { setEditingId(''); setOrderId(data.orders[0]?.id ?? ''); setTitle(''); setAmount('0'); setPaid('0'); setDueDate(todayInput()); setNote(''); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const fillInvoice = (invoice: AppSnapshot['invoices'][number]) => { setEditingId(invoice.id); setOrderId(invoice.orderId); setTitle(invoice.title); setAmount(String(invoice.amount)); setPaid(String(invoice.paid)); setDueDate(invoice.dueDate || todayInput()); setNote(invoice.note); setFormOpen(true); };
  const selectedOrder = data.orders.find((order) => order.id === orderId);

  useEffect(() => { if (!orderId && data.orders[0]) setOrderId(data.orders[0].id); }, [orderId, data.orders]);
  useEffect(() => { if (!editingId && selectedOrder && Number(amount) === 0) setAmount(String(selectedOrder.total)); }, [selectedOrder, editingId, amount]);

  function exportCsv() {
    const rows = [['customer', 'order', 'title', 'amount', 'paid', 'remaining', 'status'], ...filtered.map((item) => [item.customerName, item.orderTitle, item.title, item.amount, item.paid, item.amount - item.paid, item.status])];
    downloadText('best-invoices.csv', csv(rows), 'text/csv;charset=utf-8');
  }
  function printInvoices() {
    const html = filtered.map((item) => `<tr><td>${item.title}</td><td>${item.customerName}</td><td>${item.amount}</td><td>${item.paid}</td><td>${invoiceStatusLabels[item.status]}</td></tr>`).join('');
    printHtml(`<h1>فاکتورها</h1><table border="1" cellspacing="0" cellpadding="8">${html}</table>`);
  }

  return (
    <section className="stack">
      <PageActions title="فاکتورها" actionLabel="افزودن فاکتور" onAction={openCreate}>
        <button className="secondary" type="button" onClick={exportCsv}><FileSpreadsheet size={17} /> CSV</button>
        <button className="secondary" type="button" onClick={printInvoices}><Printer size={17} /> چاپ</button>
      </PageActions>
      <Modal title={editingId ? 'ویرایش فاکتور' : 'افزودن فاکتور'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!orderId) throw new Error('اول سفارش ثبت کنید'); const payload = { orderId, title, amount: Number(amount), paid: Number(paid), dueDate, note }; if (editingId) await backend.updateInvoice({ id: editingId, ...payload }); else await backend.addInvoice(payload); close(); }, editingId ? 'فاکتور ویرایش شد' : 'فاکتور ثبت شد'); }}>
          <Picker label="سفارش" value={orderId} onChange={setOrderId} placeholder="اول سفارش ثبت کنید" options={data.orders.map((order) => ({ value: order.id, label: order.title, helper: `${order.customerName} - ${money(order.total)}` }))} />
          <label>عنوان فاکتور<input value={title} placeholder={selectedOrder ? `فاکتور ${selectedOrder.title}` : ''} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="form-grid"><label>مبلغ فاکتور<input value={amount} inputMode="numeric" onChange={(event) => setAmount(event.target.value)} /></label><label>پرداخت اولیه<input value={paid} inputMode="numeric" onChange={(event) => setPaid(event.target.value)} /></label></div>
          <PersianDatePicker label="تاریخ سررسید" value={dueDate} onChange={setDueDate} />
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><ReceiptText size={18} />{editingId ? 'ویرایش فاکتور' : 'ثبت فاکتور'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <div className="filter-grid"><SearchBox value={query} onChange={setQuery} placeholder="جستجوی فاکتور" /><Picker label="فیلتر پرداخت" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'همه فاکتورها' }, ...Object.entries(invoiceStatusLabels).map(([value, label]) => ({ value, label }))]} /></div>
      <List title="لیست فاکتورها">
        {filtered.map((invoice) => {
          const remain = Math.max(invoice.amount - invoice.paid, 0);
          return <article className="card-row" key={invoice.id}><div><h3>{invoice.title || invoice.customerName}</h3><p>{invoice.customerName} / {invoice.orderTitle}</p><p>پرداخت شده: {money(invoice.paid)} / {money(invoice.amount)}</p><p>سررسید: {dateText(invoice.dueDate)}</p><span className={`pill ${invoice.status}`}>{invoiceStatusLabels[invoice.status]}</span>{invoice.note && <p>{invoice.note}</p>}</div><div className="side-actions"><button className="secondary" type="button" disabled={remain <= 0} onClick={() => void run(() => backend.addInvoicePayment(invoice.id, remain), 'پرداخت ثبت شد')}><CheckCircle2 size={17} />تسویه</button><div className="payment-inline"><input aria-label="مبلغ پرداخت" placeholder="مبلغ" inputMode="numeric" value={payments[invoice.id] ?? ''} onChange={(event) => setPayments((prev) => ({ ...prev, [invoice.id]: event.target.value }))} /><button className="secondary" type="button" onClick={() => void run(() => backend.addInvoicePayment(invoice.id, Number(payments[invoice.id] ?? 0)), 'پرداخت ثبت شد')}>ثبت</button></div><button className="secondary mini" type="button" onClick={() => fillInvoice(invoice)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteInvoice(invoice.id), 'فاکتور حذف شد')}><Trash2 size={16} /></button></div></article>;
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
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const reset = () => { setEditingId(''); setName(''); setQuantity('0'); setUnit('عدد'); setMinQuantity('0'); setNote(''); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['inventory'][number]) => { setEditingId(item.id); setName(item.name); setQuantity(String(item.quantity)); setUnit(item.unit); setMinQuantity(String(item.minQuantity)); setNote(item.note); setFormOpen(true); };
  return (
    <section className="stack">
      <PageActions title="انبار" actionLabel="افزودن کالا" onAction={openCreate}>
        <button className="secondary" type="button" onClick={() => exportInventoryCsv(data.inventory)}><FileSpreadsheet size={17} /> CSV</button>
      </PageActions>
      <Modal title={editingId ? 'ویرایش کالا' : 'افزودن کالا'} open={formOpen} onClose={close}>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!name.trim()) throw new Error('نام کالا لازم است'); if (editingId) await backend.updateInventoryItem({ id: editingId, name, quantity: Number(quantity), unit, minQuantity: Number(minQuantity), note }); else await backend.addInventoryItem({ name, quantity: Number(quantity), unit, minQuantity: Number(minQuantity), note }); close(); }, editingId ? 'کالا ویرایش شد' : 'کالا ثبت شد'); }}>
          <label>نام کالا<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="form-grid"><label>موجودی<input value={quantity} inputMode="numeric" onChange={(event) => setQuantity(event.target.value)} /></label><label>واحد<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>
          <label>حد هشدار<input value={minQuantity} inputMode="numeric" onChange={(event) => setMinQuantity(event.target.value)} /></label>
          <label>توضیحات<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="form-actions"><button className="primary" type="submit"><PackagePlus size={18} />{editingId ? 'ویرایش کالا' : 'ثبت کالا'}</button><button className="secondary" type="button" onClick={close}>انصراف</button></div>
        </form>
      </Modal>
      <List title="لیست انبار">
        {data.inventory.map((item) => <article className="card-row" key={item.id}><div><h3>{item.name}</h3><p>{item.quantity.toLocaleString('fa-IR')} {item.unit}</p>{item.quantity <= item.minQuantity && <span className="pill warning">کمبود</span>}{item.note && <p>{item.note}</p>}</div><div className="stepper"><button type="button" className="wide-step" onClick={() => openEdit(item)}>ویرایش</button><button type="button" onClick={() => void run(() => backend.adjustInventory(item.id, -1), 'موجودی کم شد')}><Minus size={18} /></button><button type="button" onClick={() => void run(() => backend.adjustInventory(item.id, 1), 'موجودی زیاد شد')}>+</button><button type="button" className="danger-mini" onClick={() => void run(() => backend.deleteInventoryItem(item.id), 'کالا حذف شد')}><Trash2 size={16} /></button></div></article>)}
      </List>
    </section>
  );
}

function UsersPage({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('assistant');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const reset = () => { setEditingId(''); setUsername(''); setName(''); setPin(''); setRole('assistant'); };
  const close = () => { reset(); setFormOpen(false); };
  const openCreate = () => { reset(); setFormOpen(true); };
  const openEdit = (item: AppSnapshot['users'][number]) => { setEditingId(item.id); setUsername(item.username); setName(item.name); setPin(''); setRole(item.role); setFormOpen(true); };
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
      <List title="لیست کاربران">
        {data.users.map((item) => <article className="row" key={item.id}><div><h3>{item.name}</h3><p dir="ltr">{item.username}</p></div><div className="row-actions"><span className="pill">{item.role === 'manager' ? 'مدیر' : 'دستیار'}</span><button className="secondary mini" type="button" onClick={() => openEdit(item)}>ویرایش</button><button className="danger-icon" type="button" onClick={() => void run(() => backend.deleteUser(item.id), 'کاربر حذف شد')}><Trash2 size={16} /></button></div></article>)}
      </List>
    </section>
  );
}


function Notifications({ data, run }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void> }) {
  const generated = dueNotifications(data);
  const unseen = data.notifications.filter((item) => !item.seen).length + generated.length;
  return (
    <section className="stack">
      <section className="panel section-heading"><div><h2>اعلان‌ها</h2><p className="muted">{unseen.toLocaleString('fa-IR')} اعلان خوانده نشده</p></div><button className="secondary" type="button" onClick={() => void run(() => backend.markNotificationsSeen(), 'اعلان‌ها خوانده شد')}>تایید همه</button></section>
      <div className="list">
        {generated.map((item) => <article className="row notification-row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p></div><span className="dot" /></article>)}
        {data.notifications.map((item) => <article className="row notification-row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p></div>{!item.seen && <span className="dot" />}</article>)}
        {generated.length === 0 && data.notifications.length === 0 && <Empty text="اعلانی وجود ندارد" />}
      </div>
    </section>
  );
}

function ActivityLog({ data }: { data: AppSnapshot }) {
  return <List title="گزارش عملیات">{data.activities.map((item) => <article className="row" key={item.id}><div><h3>{item.title}</h3><p>{item.body}</p></div><span>{dateText(item.createdAt)}</span></article>)}{data.activities.length === 0 && <Empty text="هنوز عملیاتی ثبت نشده است" />}</List>;
}

function Reports({ data }: { data: AppSnapshot }) {
  const totalSales = data.invoices.reduce((sum, item) => sum + item.amount, 0);
  const received = data.invoices.reduce((sum, item) => sum + item.paid, 0);
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

function Backup({ data, run, reload }: { data: AppSnapshot; run: (action: () => Promise<void>, done?: string) => Promise<void>; reload: () => Promise<void> }) {
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);
  function download() {
    downloadText(`best-mobile-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json;charset=utf-8');
  }
  async function importFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as AppSnapshot;
    await run(async () => { await backend.importSnapshot(parsed); await reload(); }, 'بکاپ بازیابی شد');
  }
  return (
    <section className="stack">
      <section className="panel"><h2>پشتیبان داده‌ها</h2><p className="muted">همه داده‌ها داخل SQLite گوشی ذخیره می‌شود. خروجی JSON برای انتقال دستی یا نگهداری امن است و با آپدیت APK پاک نمی‌شود.</p><button className="primary" type="button" onClick={download}><Database size={18} />خروجی JSON</button><label className="upload-button"><Upload size={18} />ریستور JSON<input type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></label></section>
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

function List({ title, children }: { title: string; children: ReactNode }) {
  return <section className="section"><h2>{title}</h2><div className="list">{children}</div></section>;
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function dueNotifications(data: AppSnapshot) {
  const nowDate = new Date();
  const soon = new Date(nowDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  const orders = data.orders.filter((order) => order.dueDate && !['delivered', 'cancelled'].includes(order.status) && new Date(order.dueDate) <= soon).map((order) => ({ id: `order-${order.id}`, title: `موعد سفارش ${order.title}`, body: `تاریخ تحویل: ${dateText(order.dueDate)}` }));
  const invoices = data.invoices.filter((invoice) => invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) <= soon).map((invoice) => ({ id: `invoice-${invoice.id}`, title: `سررسید فاکتور ${invoice.title}`, body: `${invoice.customerName} - مانده ${money(invoice.amount - invoice.paid)}` }));
  return [...orders, ...invoices];
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

function printHtml(body: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>BEST</title></head><body>${body}</body></html>`);
  win.document.close();
  win.print();
}

function csv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

function exportCustomersCsv(items: AppSnapshot['customers']) {
  downloadText('best-customers.csv', csv([['name', 'phone', 'address', 'note'], ...items.map((item) => [item.name, item.phone, item.address, item.note])]), 'text/csv;charset=utf-8');
}

function exportOrdersCsv(items: AppSnapshot['orders']) {
  downloadText('best-orders.csv', csv([['title', 'customer', 'collaborator', 'status', 'workType', 'total', 'dueDate'], ...items.map((item) => [item.title, item.customerName, item.collaboratorName, statusLabels[item.status], workTypeLabels[item.workType], item.total, item.dueDate])]), 'text/csv;charset=utf-8');
}

function exportInventoryCsv(items: AppSnapshot['inventory']) {
  downloadText('best-inventory.csv', csv([['name', 'quantity', 'unit', 'minQuantity', 'note'], ...items.map((item) => [item.name, item.quantity, item.unit, item.minQuantity, item.note])]), 'text/csv;charset=utf-8');
}
