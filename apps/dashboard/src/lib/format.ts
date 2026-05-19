export const money = (value: number) => `${new Intl.NumberFormat('fa-IR').format(value || 0)} تومان`;
export const shamsiDate = (value?: string) => (value ? new Date(value).toLocaleString('fa-IR-u-ca-persian') : '-');
export const fullName = (input?: { firstName?: string; lastName?: string }) => {
  const firstName = textFa(input?.firstName ?? '', '');
  const lastName = textFa(input?.lastName ?? '', '');
  return [firstName, lastName].filter(Boolean).join(' ') || '-';
};

export const ORDER_STAGES: Array<{ value: string; label: string }> = [
  { value: 'RECEIVED', label: 'دریافت شده' },
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
export const invoiceStatusBadgeVariant = (value?: string): 'success' | 'warning' | 'outline' =>
  value === 'PAID' ? 'success' : value === 'PARTIAL' ? 'warning' : 'outline';
export const orderStageBadgeVariant = (value?: string): 'success' | 'warning' | 'secondary' | 'outline' => {
  if (value === 'DELIVERED') return 'success';
  if (value === 'CANCELLED') return 'outline';
  if (value === 'READY_IN_WAREHOUSE') return 'warning';
  if (value === 'IN_PROGRESS') return 'secondary';
  return 'outline';
};
export const paymentStatusBadgeVariant = (value?: string): 'success' | 'warning' | 'outline' =>
  value === 'paid' ? 'success' : value === 'partial' ? 'warning' : 'outline';
export const paymentStatusLabel = (value?: string) =>
  value === 'paid' ? 'تسویه‌شده' : value === 'partial' ? 'پرداخت ناقص' : 'پرداخت نشده';

function hasPersianChars(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function decodeMojibake(value: string) {
  if (!/[\u00D8\u00D9]/.test(value)) return value;

  const candidates: string[] = [];

  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    candidates.push(new TextDecoder('utf-8').decode(bytes));
  } catch {
    // ignored
  }

  try {
    const decoded = decodeURIComponent(
      Array.from(value)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    candidates.push(decoded);
  } catch {
    // ignored
  }

  return candidates.find((item) => hasPersianChars(item)) ?? value;
}

export const textFa = (value?: string | null, fallback = '-') => {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  const fixed = decodeMojibake(raw).replace(/\?{3,}/g, 'نامشخص');
  return fixed || fallback;
};

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  REVOKE: 'ابطال',
  ASSIGN_ROLE: 'اختصاص نقش'
};

const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  ORDER: 'سفارش',
  INVOICE: 'فاکتور',
  CUSTOMER: 'مشتری',
  COLLABORATOR: 'همکار',
  MESHTYPE: 'نوع توری',
  USER: 'کاربر',
  USERROLE: 'نقش کاربر',
  ROLE: 'نقش',
  PERMISSION: 'دسترسی',
  AUTH: 'احراز هویت',
  SESSION: 'نشست',
  BACKUP: 'پشتیبان',
  REPORT: 'گزارش',
  NOTIFICATION: 'اعلان'
};

const ACTIVITY_DESCRIPTION_LABELS: Record<string, string> = {
  'invoice created': 'فاکتور ایجاد شد',
  'invoice updated': 'فاکتور ویرایش شد',
  'invoice soft deleted': 'فاکتور حذف شد',
  'order created': 'سفارش ایجاد شد',
  'order updated': 'سفارش ویرایش شد',
  'order soft deleted': 'سفارش حذف شد',
  'customer created': 'مشتری ایجاد شد',
  'customer updated': 'مشتری ویرایش شد',
  'customer soft deleted': 'مشتری حذف شد',
  'collaborator created': 'همکار ایجاد شد',
  'collaborator updated': 'همکار ویرایش شد',
  'collaborator soft deleted': 'همکار حذف شد',
  'mesh type created': 'نوع توری ایجاد شد',
  'mesh type updated': 'نوع توری ویرایش شد',
  'soft delete mesh type': 'نوع توری حذف شد',
  'soft delete user': 'کاربر حذف شد',
  'session revoked': 'نشست باطل شد'
};

const EN_ENTITY_MAP: Record<string, string> = {
  order: 'سفارش',
  invoice: 'فاکتور',
  customer: 'مشتری',
  collaborator: 'همکار',
  'mesh type': 'نوع توری',
  user: 'کاربر',
  session: 'نشست',
  role: 'نقش',
  permission: 'دسترسی',
  auth: 'احراز هویت'
};

export const activityActionLabel = (value?: string | null) => {
  const raw = (value ?? '').trim();
  if (!raw) return '-';
  return ACTIVITY_ACTION_LABELS[raw.toUpperCase()] ?? textFa(raw);
};

export const activityEntityLabel = (value?: string | null) => {
  const raw = (value ?? '').trim();
  if (!raw) return '-';
  const key = raw.replace(/[\s_-]/g, '').toUpperCase();
  return ACTIVITY_ENTITY_LABELS[key] ?? textFa(raw);
};

export const activityDescriptionLabel = (value?: string | null) => {
  const raw = (value ?? '').trim();
  if (!raw) return '-';
  const normalized = raw.toLowerCase();
  const fromMap = ACTIVITY_DESCRIPTION_LABELS[normalized];
  if (fromMap) return fromMap;

  const match = normalized.match(/^(.*)\s(created|updated|soft deleted|deleted)$/);
  if (match) {
    const entity = EN_ENTITY_MAP[match[1].trim()];
    if (entity) {
      const verb = match[2] === 'created' ? 'ایجاد شد' : match[2] === 'updated' ? 'ویرایش شد' : 'حذف شد';
      return `${entity} ${verb}`;
    }
  }

  return textFa(raw);
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

