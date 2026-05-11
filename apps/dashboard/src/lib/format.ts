export const money = (value: number) => new Intl.NumberFormat('fa-IR').format(value || 0);
export const shamsiDate = (value?: string) => (value ? new Date(value).toLocaleString('fa-IR-u-ca-persian') : '-');
export const fullName = (input?: { firstName?: string; lastName?: string }) =>
  [input?.firstName, input?.lastName].filter(Boolean).join(' ') || '-';

export const ORDER_STAGES: Array<{ value: string; label: string }> = [
  { value: 'RECEIVED', label: '\u062f\u0631\u06cc\u0627\u0641\u062a \u0634\u062f\u0647' },
  { value: 'STARTED', label: '\u0634\u0631\u0648\u0639 \u0634\u062f\u0647' },
  { value: 'IN_PROGRESS', label: '\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645' },
  { value: 'READY_IN_WAREHOUSE', label: '\u0622\u0645\u0627\u062f\u0647 \u062f\u0631 \u0627\u0646\u0628\u0627\u0631' },
  { value: 'DELIVERED', label: '\u062a\u062d\u0648\u06cc\u0644 \u062f\u0627\u062f\u0647 \u0634\u062f\u0647' },
  { value: 'CANCELLED', label: '\u0644\u063a\u0648 \u0634\u062f\u0647' }
];

export const WORK_TYPES: Array<{ value: string; label: string }> = [
  { value: 'NEW_CONSTRUCTION', label: '\u0633\u0627\u062e\u062a \u062c\u062f\u06cc\u062f' },
  { value: 'REPAIR', label: '\u062a\u0639\u0645\u06cc\u0631' }
];

export const INVOICE_STATUS: Array<{ value: string; label: string }> = [
  { value: 'UNPAID', label: '\u067e\u0631\u062f\u0627\u062e\u062a \u0646\u0634\u062f\u0647' },
  { value: 'PARTIAL', label: '\u0646\u0627\u0642\u0635' },
  { value: 'PAID', label: '\u067e\u0631\u062f\u0627\u062e\u062a \u0634\u062f\u0647' }
];
