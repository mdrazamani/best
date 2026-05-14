export const money = (value: number) => `${new Intl.NumberFormat('fa-IR').format(value || 0)} ریال`;
export const shamsiDate = (value?: string) => (value ? new Date(value).toLocaleString('fa-IR-u-ca-persian') : '-');
export const fullName = (input?: { firstName?: string; lastName?: string }) =>
  [input?.firstName, input?.lastName].filter(Boolean).join(' ') || '-';

export const ORDER_STAGES: Array<{ value: string; label: string }> = [
  { value: 'RECEIVED', label: 'دریافت شده' },
  { value: 'STARTED', label: 'شروع شده' },
  { value: 'IN_PROGRESS', label: 'در حال انجام' },
  { value: 'READY_IN_WAREHOUSE', label: 'آماده در انبار' },
  { value: 'DELIVERED', label: 'تحویل داده شده' },
  { value: 'CANCELLED', label: 'لغو شده' }
];

export const WORK_TYPES: Array<{ value: string; label: string }> = [
  { value: 'NEW_CONSTRUCTION', label: 'ساخت جدید' },
  { value: 'REPAIR', label: 'تعمیر' }
];

export const INVOICE_STATUS: Array<{ value: string; label: string }> = [
  { value: 'UNPAID', label: 'پرداخت نشده' },
  { value: 'PARTIAL', label: 'ناقص' },
  { value: 'PAID', label: 'پرداخت شده' }
];

export const orderStageLabel = (value?: string) => ORDER_STAGES.find((item) => item.value === value)?.label ?? value ?? '-';
export const invoiceStatusLabel = (value?: string) => INVOICE_STATUS.find((item) => item.value === value)?.label ?? value ?? '-';

function hasPersianChars(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function decodeMojibake(value: string) {
  if (!/[ÙØ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return hasPersianChars(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

export const textFa = (value?: string | null, fallback = '-') => {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  const fixed = decodeMojibake(raw).replace(/\?{3,}/g, 'نامشخص');
  return fixed || fallback;
};

export const PERMISSION_LABELS: Record<string, string> = {
  'roles.list': 'مشاهده نقش‌ها',
  'roles.manage': 'مدیریت دسترسی نقش‌ها',
  'permissions.list': 'مشاهده مجوزها',
  'users.list': 'مشاهده کاربران',
  'users.create': 'ایجاد و مدیریت کاربران',
  'collaborators.all': 'مدیریت همکاران',
  'customers.all': 'مدیریت مشتریان',
  'mesh_types.all': 'مدیریت انواع توری',
  'orders.all': 'مدیریت سفارشات',
  'invoices.all': 'مدیریت فاکتورها',
  'backups.all': 'مدیریت بکاپ‌ها',
  'reports.all': 'مشاهده گزارش‌ها',
  'logs.list': 'مشاهده لاگ عملیات'
};

export const permissionLabel = (key: string) => PERMISSION_LABELS[key] ?? key;
