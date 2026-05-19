import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { PersianDatePicker } from '../ui/persian-date-picker';
import { SearchableSelect } from '../ui/searchable-select';
import { Textarea } from '../ui/textarea';

type Option = { value: string; label: string };

type CreateInvoicePayload = {
  title?: string;
  orderIds: string[];
  amount?: number;
  discountAmount?: number;
  initialPaidAmount?: number;
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';
  payerType?: 'CUSTOMER' | 'COLLABORATOR';
  payerId?: string;
  dueDate?: string;
  description?: string;
};

type CreateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateInvoicePayload) => Promise<void>;
  orderOptions: Option[];
  title?: string;
  description?: string;
  submitLabel?: string;
  statusOptions?: Option[];
  lockedPayer?: {
    type: 'CUSTOMER' | 'COLLABORATOR';
    id: string;
    label: string;
  };
  lockedOrderIds?: string[];
  defaultSelectedOrderIds?: string[];
  allowMultipleOrders?: boolean;
  getPayerOptions?: (orderIds: string[]) => Option[];
};

const defaultStatusOptions: Option[] = [
  { value: 'UNPAID', label: 'پرداخت نشده' },
  { value: 'PARTIAL', label: 'ناقص' },
  { value: 'PAID', label: 'پرداخت شده' }
];

const emptyForm = {
  title: '',
  amount: '',
  discountAmount: '',
  initialPaidAmount: '',
  status: 'UNPAID' as 'UNPAID' | 'PARTIAL' | 'PAID',
  payerType: 'CUSTOMER' as 'CUSTOMER' | 'COLLABORATOR',
  payerId: '',
  dueDate: '',
  description: '',
  orderSearch: ''
};

const toNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSubmit,
  orderOptions,
  title = 'ثبت فاکتور جدید',
  description = 'اطلاعات فاکتور را کامل کنید.',
  submitLabel = 'ثبت فاکتور',
  statusOptions = defaultStatusOptions,
  lockedPayer,
  lockedOrderIds,
  defaultSelectedOrderIds,
  allowMultipleOrders = true,
  getPayerOptions
}: CreateInvoiceDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm((prev) => ({
        ...emptyForm,
        payerType: lockedPayer?.type ?? prev.payerType,
        payerId: lockedPayer?.id ?? prev.payerId
      }));
      setSelectedOrderIds(lockedOrderIds ?? defaultSelectedOrderIds ?? []);
      setSubmitting(false);
      return;
    }

    if (lockedPayer) {
      setForm((prev) => ({
        ...prev,
        payerType: lockedPayer.type,
        payerId: lockedPayer.id
      }));
    }

    if (lockedOrderIds?.length) {
      setSelectedOrderIds(lockedOrderIds);
    } else {
      setSelectedOrderIds(defaultSelectedOrderIds ?? []);
    }
  }, [open, lockedPayer?.id, lockedPayer?.type, lockedOrderIds, defaultSelectedOrderIds]);

  const visibleOrderOptions = useMemo(() => {
    const q = form.orderSearch.trim().toLowerCase();
    if (!q) return orderOptions;
    return orderOptions.filter((item) => item.label.toLowerCase().includes(q));
  }, [orderOptions, form.orderSearch]);

  const payerOptions = useMemo(() => {
    if (!getPayerOptions) return [];
    return getPayerOptions(selectedOrderIds);
  }, [getPayerOptions, selectedOrderIds]);

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((item) => item !== orderId);
      if (!allowMultipleOrders) return [orderId];
      return [...prev, orderId];
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const effectiveOrderIds = (lockedOrderIds?.length ? lockedOrderIds : selectedOrderIds).filter(Boolean);
    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title || undefined,
        orderIds: effectiveOrderIds,
        amount: toNumber(form.amount),
        discountAmount: toNumber(form.discountAmount),
        initialPaidAmount: toNumber(form.initialPaidAmount),
        status: form.status,
        payerType: lockedPayer?.type ?? form.payerType,
        payerId: lockedPayer?.id ?? (form.payerId || undefined),
        dueDate: form.dueDate || undefined,
        description: form.description || undefined
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrders = useMemo(() => {
    return selectedOrderIds
      .map((id) => orderOptions.find((item) => item.value === id))
      .filter(Boolean) as Option[];
  }, [selectedOrderIds, orderOptions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">عنوان فاکتور</label>
              <Input placeholder="عنوان فاکتور (اختیاری)" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2 rounded-lg border border-dashed p-3">
              <label className="text-sm font-medium">سفارش‌ها</label>
              {selectedOrders.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedOrders.map((item) => (
                    <span key={item.value} className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
                      {item.label}
                      {!lockedOrderIds?.length ? (
                        <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => toggleOrder(item.value)}>
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">سفارشی انتخاب نشده است.</p>
              )}
              {lockedOrderIds?.length ? null : (
                <>
                  <Input
                    placeholder="جستجو در سفارش‌ها"
                    value={form.orderSearch}
                    onChange={(e) => setForm((prev) => ({ ...prev, orderSearch: e.target.value }))}
                  />
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-2">
                    {visibleOrderOptions.map((order) => (
                      <label key={order.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/30">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selectedOrderIds.includes(order.value)}
                          onChange={() => toggleOrder(order.value)}
                        />
                        <span className="text-sm">{order.label}</span>
                      </label>
                    ))}
                    {!visibleOrderOptions.length ? <p className="text-xs text-muted-foreground">موردی پیدا نشد.</p> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{allowMultipleOrders ? 'امکان انتخاب چند سفارش وجود دارد.' : 'فقط یک سفارش قابل انتخاب است.'}</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">وضعیت فاکتور</label>
              <SearchableSelect options={statusOptions} value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value as 'UNPAID' | 'PARTIAL' | 'PAID' }))} placeholder="وضعیت فاکتور" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تخفیف (تومان)</label>
              <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={form.discountAmount} onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">مبلغ کل فاکتور (تومان)</label>
              <Input type="number" min="0" step="0.01" placeholder="مثال: 2100000" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">پرداخت اولیه (تومان)</label>
              <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={form.initialPaidAmount} onChange={(e) => setForm((prev) => ({ ...prev, initialPaidAmount: e.target.value }))} />
            </div>

            {lockedPayer ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">پرداخت‌کننده</label>
                <Input value={lockedPayer.label} disabled />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع پرداخت‌کننده</label>
                  <SearchableSelect
                    options={[
                      { value: 'CUSTOMER', label: 'مشتری' },
                      { value: 'COLLABORATOR', label: 'همکار' }
                    ]}
                    value={form.payerType}
                    onChange={(value) => setForm((prev) => ({ ...prev, payerType: value as 'CUSTOMER' | 'COLLABORATOR', payerId: '' }))}
                    placeholder="نوع پرداخت‌کننده"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">پرداخت‌کننده</label>
                  <SearchableSelect options={payerOptions} value={form.payerId} onChange={(value) => setForm((prev) => ({ ...prev, payerId: value }))} placeholder="انتخاب شخص پرداخت‌کننده" />
                </div>
              </>
            )}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">تاریخ سررسید پرداخت</label>
              <PersianDatePicker value={form.dueDate} onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value ?? '' }))} placeholder="تاریخ سررسید پرداخت" />
            </div>
          </div>
          <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" disabled={submitting}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

