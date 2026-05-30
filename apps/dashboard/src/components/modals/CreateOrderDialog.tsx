import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { money } from '../../lib/format';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { PersianDatePicker } from '../ui/persian-date-picker';
import { SearchableSelect } from '../ui/searchable-select';
import { Textarea } from '../ui/textarea';

type CustomerOption = { value: string; label: string; referredByCollaboratorId?: string | null };
type CollaboratorOption = { value: string; label: string };
type MeshOption = { value: string; label: string; unitPrice?: number; isDefault?: boolean };

type QuickCustomerPayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  referredByCollaboratorId?: string;
};

type LineItemForm = {
  id: string;
  meshTypeId: string;
  width: string;
  height: string;
  quantity: string;
  unitPrice: string;
  lineTotalOverride: string;
  lineTotalManual: boolean;
  description: string;
};

type CreateOrderPayload = {
  title?: string;
  customerId?: string;
  collaboratorId?: string | null;
  workType: 'NEW_CONSTRUCTION' | 'REPAIR';
  expectedCompletionDate?: string;
  width?: number;
  height?: number;
  quantity?: number;
  unitPrice?: number;
  lineItems: Array<{
    meshTypeId: string;
    width: number;
    height: number;
    quantity: number;
    unitPrice: number;
    description?: string;
  }>;
  totalPrice: number;
  discountAmount?: number;
  createInitialInvoice?: boolean;
  description?: string;
};

type CreateOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateOrderPayload) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  customerOptions: CustomerOption[];
  collaboratorOptions?: CollaboratorOption[];
  meshOptions: MeshOption[];
  lockedCollaborator?: { id: string; label: string };
  lockedCustomer?: { id: string; label: string };
  onQuickCreateCustomer?: (payload: QuickCustomerPayload) => Promise<{ id: string; label: string } | null>;
};

const WORK_TYPE_OPTIONS: Array<{ value: 'NEW_CONSTRUCTION' | 'REPAIR'; label: string }> = [
  { value: 'NEW_CONSTRUCTION', label: 'ساخت جدید' },
  { value: 'REPAIR', label: 'تعمیر' }
];

const toNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateLineTotal = (width: number, height: number, quantity: number, unitPrice: number) => {
  const areaMeters = (width * height) / 10000;
  if (areaMeters > 1) return areaMeters * quantity * unitPrice;
  return quantity * unitPrice;
};

const normalizeAmountInput = (value: number) => {
  const rounded = Math.max(Math.round(value * 100) / 100, 0);
  return Number.isFinite(rounded) ? String(rounded) : '0';
};

const withAutoLineTotal = (item: LineItemForm): LineItemForm => {
  if (item.lineTotalManual) return item;
  const calculated = calculateLineTotal(toNumber(item.width), toNumber(item.height), toNumber(item.quantity), toNumber(item.unitPrice));
  return { ...item, lineTotalOverride: normalizeAmountInput(calculated) };
};

const createLineItem = (defaultMeshId?: string, defaultUnitPrice?: number): LineItemForm =>
  withAutoLineTotal({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  meshTypeId: defaultMeshId ?? '',
  width: '',
  height: '',
  quantity: '1',
  unitPrice: defaultUnitPrice !== undefined ? String(defaultUnitPrice) : '',
  lineTotalOverride: '',
  lineTotalManual: false,
  description: ''
});

const emptyForm = {
  title: '',
  customerId: '',
  collaboratorId: '',
  workType: 'NEW_CONSTRUCTION' as 'NEW_CONSTRUCTION' | 'REPAIR',
  expectedCompletionDate: '',
  description: ''
};

const emptyQuickCustomer = {
  firstName: '',
  lastName: '',
  phone: ''
};

export function CreateOrderDialog({
  open,
  onOpenChange,
  onSubmit,
  title = 'ثبت سفارش جدید',
  description = 'اطلاعات سفارش را کامل کنید.',
  submitLabel = 'ثبت سفارش',
  customerOptions,
  collaboratorOptions,
  meshOptions,
  lockedCollaborator,
  lockedCustomer,
  onQuickCreateCustomer
}: CreateOrderDialogProps) {
  const defaultMesh = useMemo(() => meshOptions.find((item) => item.isDefault) ?? meshOptions[0], [meshOptions]);

  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createLineItem(defaultMesh?.value, defaultMesh?.unitPrice)]);
  const [finalPrice, setFinalPrice] = useState('');
  const [finalPriceOverridden, setFinalPriceOverridden] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [createInitialInvoice, setCreateInitialInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localCustomerOptions, setLocalCustomerOptions] = useState<CustomerOption[]>(customerOptions);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerSubmitting, setQuickCustomerSubmitting] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState(emptyQuickCustomer);

  useEffect(() => {
    setLocalCustomerOptions(customerOptions);
  }, [customerOptions]);

  useEffect(() => {
    if (!open) {
      setForm({
        ...emptyForm,
        collaboratorId: lockedCollaborator?.id ?? '',
        customerId: lockedCustomer?.id ?? ''
      });
      setLineItems([createLineItem(defaultMesh?.value, defaultMesh?.unitPrice)]);
      setFinalPrice('');
      setFinalPriceOverridden(false);
      setDiscountAmount('');
      setCreateInitialInvoice(false);
      setSubmitting(false);
      setQuickCustomerOpen(false);
      setQuickCustomerSubmitting(false);
      setQuickCustomerForm(emptyQuickCustomer);
      return;
    }

    setForm((prev) => ({
      ...prev,
      collaboratorId: lockedCollaborator?.id ?? prev.collaboratorId,
      customerId: lockedCustomer?.id ?? prev.customerId
    }));

    setLineItems((prev) => {
      if (prev.length) return prev;
      return [createLineItem(defaultMesh?.value, defaultMesh?.unitPrice)];
    });
  }, [open, lockedCollaborator?.id, lockedCustomer?.id, defaultMesh?.value, defaultMesh?.unitPrice]);

  const collaboratorSelectOptions = useMemo(
    () => [{ value: '', label: 'بدون همکار' }, ...(collaboratorOptions ?? [])],
    [collaboratorOptions]
  );

  const activeCollaboratorId = lockedCollaborator?.id || form.collaboratorId || '';

  const prioritizedCustomerOptions = useMemo(() => {
    if (!activeCollaboratorId) return localCustomerOptions;
    const preferred: CustomerOption[] = [];
    const others: CustomerOption[] = [];
    for (const item of localCustomerOptions) {
      if (item.referredByCollaboratorId === activeCollaboratorId) preferred.push(item);
      else others.push(item);
    }
    return [...preferred, ...others];
  }, [activeCollaboratorId, localCustomerOptions]);

  const lineTotals = useMemo(() => {
    return lineItems.map((item) => {
      const width = toNumber(item.width);
      const height = toNumber(item.height);
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      const calculated = calculateLineTotal(width, height, quantity, unitPrice);
      const override = toNumber(item.lineTotalOverride);
      const hasManualOverride = item.lineTotalManual && item.lineTotalOverride.trim() !== '';
      const effective = hasManualOverride ? Math.max(override, 0) : calculated;
      return { calculated, effective, width, height, quantity };
    });
  }, [lineItems]);

  const calculatedTotal = useMemo(() => lineTotals.reduce((sum, item) => sum + item.effective, 0), [lineTotals]);
  const discountValue = useMemo(() => Math.max(toNumber(discountAmount), 0), [discountAmount]);
  const adjustedTotal = useMemo(() => Math.max(calculatedTotal - discountValue, 0), [calculatedTotal, discountValue]);

  useEffect(() => {
    if (!finalPriceOverridden) {
      setFinalPrice(adjustedTotal ? String(adjustedTotal) : '');
    }
  }, [adjustedTotal, finalPriceOverridden]);

  const updateLineItem = (id: string, key: keyof Omit<LineItemForm, 'id' | 'lineTotalManual'>, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next: LineItemForm = { ...item, [key]: value };
        if (key === 'lineTotalOverride') {
          next.lineTotalManual = true;
          return next;
        }
        if (key === 'meshTypeId') {
          const mesh = meshOptions.find((m) => m.value === value);
          if (mesh && (item.unitPrice.trim() === '' || Number(item.unitPrice) === Number(meshOptions.find((m) => m.value === item.meshTypeId)?.unitPrice ?? 0))) {
            next.unitPrice = String(Number(mesh.unitPrice ?? 0));
          }
        }
        return withAutoLineTotal(next);
      })
    );
  };

  const addLineItem = () => setLineItems((prev) => [...prev, createLineItem(defaultMesh?.value, defaultMesh?.unitPrice)]);

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const commitLineTotalOverride = (id: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.lineTotalOverride.trim() !== '') return item;
        return withAutoLineTotal({ ...item, lineTotalManual: false });
      })
    );
  };

  const submitQuickCustomer = async (typedLastName?: string) => {
    if (!onQuickCreateCustomer) return;

    const firstName = quickCustomerForm.firstName.trim();
    const typedLastNameNormalized = typedLastName?.trim() ?? '';
    const lastName = quickCustomerForm.lastName.trim() || typedLastNameNormalized;
    const phone = quickCustomerForm.phone.trim();

    if (!firstName && !lastName && typedLastName !== undefined) {
      setQuickCustomerOpen((prev) => !prev);
      return;
    }

    if (!firstName && typedLastNameNormalized) {
      const existing = prioritizedCustomerOptions.find(
        (item) => item.label.trim().toLocaleLowerCase() === typedLastNameNormalized.toLocaleLowerCase()
      );
      if (existing) {
        setForm((prev) => ({ ...prev, customerId: existing.value }));
        setQuickCustomerOpen(false);
        return;
      }
    }

    if (!firstName && !lastName) {
      toast.error('حداقل نام یا نام خانوادگی مشتری را وارد کنید.');
      return;
    }

    setQuickCustomerSubmitting(true);
    try {
      const created = await onQuickCreateCustomer({
        firstName,
        lastName,
        phone: phone || undefined,
        referredByCollaboratorId: activeCollaboratorId || undefined
      });
      if (!created) return;

      setLocalCustomerOptions((prev) => {
        const exists = prev.some((item) => item.value === created.id);
        if (exists) return prev;
        return [
          {
            value: created.id,
            label: created.label,
            referredByCollaboratorId: activeCollaboratorId || null
          },
          ...prev
        ];
      });
      setForm((prev) => ({ ...prev, customerId: created.id }));
      setQuickCustomerForm(emptyQuickCustomer);
      setQuickCustomerOpen(false);
      toast.success('مشتری جدید انتخاب شد.');
    } finally {
      setQuickCustomerSubmitting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const customerId = lockedCustomer?.id ?? form.customerId;
    const collaboratorId = lockedCollaborator?.id ?? form.collaboratorId;

    if (!customerId.trim() && !collaboratorId.trim()) {
      toast.error('برای ثبت سفارش، حداقل یکی از مشتری یا همکار را انتخاب کنید.');
      return;
    }

    const normalizedLineItems = lineItems
      .map((item) => {
        const meshTypeId = item.meshTypeId;
        const width = toNumber(item.width);
        const height = toNumber(item.height);
        const quantity = toNumber(item.quantity);
        const unitPrice = toNumber(item.unitPrice);
        const lineTotalOverride = toNumber(item.lineTotalOverride);
        const description = item.description.trim();

        const areaMeters = (width * height) / 10000;
        const factor = areaMeters > 1 ? areaMeters * quantity : quantity;
        const calculatedLineTotal = calculateLineTotal(width, height, quantity, unitPrice);
        const hasManualOverride = item.lineTotalManual && item.lineTotalOverride.trim() !== '';
        const effectiveLineTotal = hasManualOverride ? Math.max(lineTotalOverride, 0) : calculatedLineTotal;
        const effectiveUnitPrice = factor > 0 ? effectiveLineTotal / factor : unitPrice;

        return {
          meshTypeId,
          width,
          height,
          quantity,
          unitPrice: effectiveUnitPrice,
          description: description || undefined
        };
      })
      .filter((item) => item.meshTypeId && item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0);

    if (!normalizedLineItems.length) {
      toast.error('حداقل یک ردیف سفارش معتبر وارد کنید.');
      return;
    }

    const firstLine = normalizedLineItems[0];
    const payloadTotal = finalPrice.trim() ? toNumber(finalPrice) : adjustedTotal;

    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title || undefined,
        customerId: customerId || undefined,
        collaboratorId: collaboratorId || null,
        workType: form.workType,
        expectedCompletionDate: form.expectedCompletionDate || undefined,
        width: firstLine?.width,
        height: firstLine?.height,
        quantity: firstLine?.quantity,
        unitPrice: firstLine?.unitPrice,
        lineItems: normalizedLineItems,
        totalPrice: Number.isFinite(payloadTotal) ? payloadTotal : 0,
        discountAmount: discountValue,
        createInitialInvoice,
        description: form.description || undefined
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="عنوان سفارش (اختیاری)"
              className="md:col-span-2"
            />

            {lockedCustomer ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">مشتری: {lockedCustomer.label}</div>
            ) : (
              <div className="space-y-2">
                <SearchableSelect
                  options={prioritizedCustomerOptions}
                  value={form.customerId}
                  onChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))}
                  placeholder="انتخاب مشتری"
                  actionLabel="افزودن سریع مشتری"
                  actionTitle="افزودن سریع مشتری"
                  onActionClick={onQuickCreateCustomer ? (typedValue) => void submitQuickCustomer(typedValue) : undefined}
                  actionDisabled={quickCustomerSubmitting}
                  actionOnEnter
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {activeCollaboratorId ? 'ابتدا مشتری‌های مرتبط با همین همکار نمایش داده می‌شوند.' : 'برای سرعت بیشتر، می‌توانید اول همکار را انتخاب کنید.'}
                  </p>
                </div>
                <div className="flex justify-start">
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuickCustomerOpen((prev) => !prev)} disabled={quickCustomerSubmitting}>
                    {quickCustomerOpen ? '\u0628\u0633\u062a\u0646 \u0641\u0631\u0645 \u0627\u0641\u0632\u0648\u062f\u0646 \u0633\u0631\u06cc\u0639 \u0645\u0634\u062a\u0631\u06cc' : '\u0627\u0641\u0632\u0648\u062f\u0646 \u0633\u0631\u06cc\u0639 \u0645\u0634\u062a\u0631\u06cc'}
                  </Button>
                </div>
                {quickCustomerOpen ? (
                  <div className="grid gap-2 rounded-md border border-dashed p-2">
                    <Input
                      value={quickCustomerForm.firstName}
                      onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="نام مشتری"
                    />
                    <Input
                      value={quickCustomerForm.lastName}
                      onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="نام خانوادگی مشتری"
                    />
                    <Input
                      value={quickCustomerForm.phone}
                      onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="شماره تماس (اختیاری)"
                    />
                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={() => void submitQuickCustomer()} disabled={quickCustomerSubmitting}>
                        ثبت سریع مشتری
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {lockedCollaborator ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">همکار: {lockedCollaborator.label}</div>
            ) : (
              <SearchableSelect
                options={collaboratorSelectOptions}
                value={form.collaboratorId}
                onChange={(value) => setForm((prev) => ({ ...prev, collaboratorId: value }))}
                placeholder="انتخاب همکار"
              />
            )}

            <SearchableSelect
              options={WORK_TYPE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              value={form.workType}
              onChange={(value) => setForm((prev) => ({ ...prev, workType: value as 'NEW_CONSTRUCTION' | 'REPAIR' }))}
              placeholder="نوع کار"
              isSearchable={false}
            />
            <PersianDatePicker
              value={form.expectedCompletionDate}
              onChange={(value) => setForm((prev) => ({ ...prev, expectedCompletionDate: value ?? '' }))}
              placeholder="تاریخ تکمیل تقریبی"
            />
          </div>

          <div className="rounded-lg border border-slate-300/70 bg-muted/20 p-3 dark:border-slate-700/80">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">ردیف‌های سفارش</p>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4" />
                افزودن ردیف
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-slate-300/70 bg-card p-3 dark:border-slate-700/80">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">ردیف {index + 1}</p>
                    <Button type="button" variant="ghost" size="icon" disabled={lineItems.length === 1} onClick={() => removeLineItem(item.id)} aria-label="حذف ردیف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-7">
                    <SearchableSelect options={meshOptions} value={item.meshTypeId} onChange={(value) => updateLineItem(item.id, 'meshTypeId', value)} placeholder="نوع توری" className="md:col-span-2" />
                    <Input type="number" min="0" step="0.01" value={item.width} placeholder="عرض (cm)" onChange={(e) => updateLineItem(item.id, 'width', e.target.value)} />
                    <Input type="number" min="0" step="0.01" value={item.height} placeholder="ارتفاع (cm)" onChange={(e) => updateLineItem(item.id, 'height', e.target.value)} />
                    <Input type="number" min="0" step="0.01" value={item.quantity} placeholder="تعداد" onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)} />
                    <Input type="number" min="0" step="0.01" value={item.unitPrice} placeholder="قیمت واحد نوع توری" onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)} />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.lineTotalOverride}
                      placeholder="مبلغ نهایی ردیف (اختیاری)"
                      onChange={(e) => updateLineItem(item.id, 'lineTotalOverride', e.target.value)}
                      onBlur={() => commitLineTotalOverride(item.id)}
                    />
                  </div>
                  <Input className="mt-3" value={item.description} placeholder="توضیحات ردیف (اختیاری)" onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} />
                  <p className="mt-2 text-xs text-muted-foreground">جمع محاسباتی ردیف: {money(lineTotals[index]?.calculated ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-300/70 bg-muted/10 p-3 dark:border-slate-700/80">
            <p className="text-sm font-semibold">جمع‌بندی مالی</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">جمع ردیف‌ها</p>
                <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary">{money(calculatedTotal)}</div>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">تخفیف (اختیاری)</p>
                <Input type="number" min="0" step="0.01" value={discountAmount} placeholder="مبلغ تخفیف" onChange={(e) => setDiscountAmount(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">مبلغ نهایی کل (قابل تغییر دستی)</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={finalPrice}
                placeholder="مبلغ نهایی کل"
                onChange={(e) => {
                  setFinalPrice(e.target.value);
                  setFinalPriceOverridden(true);
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-dashed border-slate-300/80 bg-muted/15 px-3 py-2 text-sm dark:border-slate-700/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={createInitialInvoice}
              onChange={(e) => setCreateInitialInvoice(e.target.checked)}
            />
            <span>بعد از ثبت سفارش، فاکتور اولیه به‌صورت خودکار ساخته شود.</span>
          </label>

          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="توضیحات"
            className="min-h-[88px]"
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
