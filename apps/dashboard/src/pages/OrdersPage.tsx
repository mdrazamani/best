import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { ORDER_STAGES, WORK_TYPES, fullName, money, shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { PersianDatePicker } from '../components/ui/persian-date-picker';

const PAGE_SIZE = 10;

type LineItemForm = {
  id: string;
  width: string;
  height: string;
  quantity: string;
  unitPrice: string;
};

const createLineItem = (): LineItemForm => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  width: '',
  height: '',
  quantity: '',
  unitPrice: ''
});

const toNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function OrdersPage() {
  const { customers, collaborators, meshTypes, orders, createOrder, updateOrder, removeOrder } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageOrderId, setStageOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  const [form, setForm] = useState({
    customerId: '',
    collaboratorId: '',
    workType: 'NEW_CONSTRUCTION',
    meshTypeId: '',
    expectedCompletionDate: '',
    description: ''
  });
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createLineItem()]);
  const [finalPrice, setFinalPrice] = useState('');
  const [finalPriceOverridden, setFinalPriceOverridden] = useState(false);

  const [selectedStage, setSelectedStage] = useState('RECEIVED');

  const customerOptions = useMemo(() => customers.map((item) => ({ value: item.id, label: fullName(item) })), [customers]);
  const collaboratorOptions = useMemo(
    () => [{ value: '', label: 'بدون همکار' }, ...collaborators.map((item) => ({ value: item.id, label: fullName(item) }))],
    [collaborators]
  );
  const meshOptions = useMemo(() => meshTypes.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.title })), [meshTypes]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((item) => {
      const orderNo = item.orderNumber.toLowerCase();
      const customerName = `${item.customer?.firstName ?? ''} ${item.customer?.lastName ?? ''}`.toLowerCase();
      const collaboratorName = `${item.collaborator?.firstName ?? ''} ${item.collaborator?.lastName ?? ''}`.toLowerCase();
      const matchesSearch = !q || orderNo.includes(q) || customerName.includes(q) || collaboratorName.includes(q);
      const matchesStage = stageFilter === 'all' || item.stage === stageFilter;
      const matchesPayment = paymentFilter === 'all' || item.paymentSummary.status === paymentFilter;
      return matchesSearch && matchesStage && matchesPayment;
    });
  }, [orders, search, stageFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page, totalPages]);

  const calculatedTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const width = toNumber(item.width);
      const height = toNumber(item.height);
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      return sum + width * height * quantity * unitPrice;
    }, 0);
  }, [lineItems]);

  useEffect(() => {
    if (!createOpen) {
      setForm({ customerId: '', collaboratorId: '', workType: 'NEW_CONSTRUCTION', meshTypeId: '', expectedCompletionDate: '', description: '' });
      setLineItems([createLineItem()]);
      setFinalPrice('');
      setFinalPriceOverridden(false);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!finalPriceOverridden) {
      setFinalPrice(calculatedTotal ? String(calculatedTotal) : '');
    }
  }, [calculatedTotal, finalPriceOverridden]);

  const updateLineItem = (id: string, key: keyof Omit<LineItemForm, 'id'>, value: string) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, createLineItem()]);

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedLineItems = lineItems
      .map((item) => ({
        width: toNumber(item.width),
        height: toNumber(item.height),
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice)
      }))
      .filter((item) => item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0);

    const firstLine = normalizedLineItems[0];
    const payloadTotal = finalPrice.trim() ? Number(finalPrice) : calculatedTotal;

    await createOrder({
      customerId: form.customerId,
      collaboratorId: form.collaboratorId || null,
      workType: form.workType,
      meshTypeId: form.meshTypeId,
      expectedCompletionDate: form.expectedCompletionDate || undefined,
      width: firstLine?.width,
      height: firstLine?.height,
      quantity: firstLine?.quantity,
      unitPrice: firstLine?.unitPrice,
      lineItems: normalizedLineItems,
      totalPrice: Number.isFinite(payloadTotal) ? payloadTotal : 0,
      description: form.description || undefined
    });

    setCreateOpen(false);
  };

  const openStageDialog = (orderId: string, currentStage: string) => {
    setStageOrderId(orderId);
    setSelectedStage(currentStage);
    setStageOpen(true);
  };

  const saveStage = async () => {
    if (!stageOrderId) return;
    await updateOrder(stageOrderId, { stage: selectedStage });
    setStageOpen(false);
    setStageOrderId(null);
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">مدیریت سفارشات</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                ثبت سفارش
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl lg:max-w-6xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">ثبت سفارش جدید</DialogTitle>
                <DialogDescription>اطلاعات سفارش را وارد کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <SearchableSelect options={customerOptions} value={form.customerId} onChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))} placeholder="انتخاب مشتری" />
                  <SearchableSelect options={collaboratorOptions} value={form.collaboratorId} onChange={(value) => setForm((prev) => ({ ...prev, collaboratorId: value }))} placeholder="انتخاب همکار" />
                  <SearchableSelect options={WORK_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={form.workType} onChange={(value) => setForm((prev) => ({ ...prev, workType: value }))} placeholder="نوع سفارش" />
                  <SearchableSelect options={meshOptions} value={form.meshTypeId} onChange={(value) => setForm((prev) => ({ ...prev, meshTypeId: value }))} placeholder="نوع توری" />
                  <div className="md:col-span-2">
                    <PersianDatePicker value={form.expectedCompletionDate} onChange={(value) => setForm((prev) => ({ ...prev, expectedCompletionDate: value ?? '' }))} placeholder="تاریخ موعد تکمیل" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-300/70 bg-muted/20 p-3 dark:border-slate-700/80">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">اقلام سفارش</p>
                    <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-4 w-4" />
                      افزودن قلم
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, index) => {
                      const lineTotal = toNumber(item.width) * toNumber(item.height) * toNumber(item.quantity) * toNumber(item.unitPrice);
                      return (
                        <div key={item.id} className="rounded-lg border border-slate-300/70 bg-card p-3 dark:border-slate-700/80">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">ردیف {index + 1}</p>
                            <Button type="button" variant="ghost" size="icon" disabled={lineItems.length === 1} onClick={() => removeLineItem(item.id)} aria-label="حذف ردیف">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-5">
                            <Input type="number" min="0" step="0.01" value={item.width} placeholder="عرض" onChange={(e) => updateLineItem(item.id, 'width', e.target.value)} />
                            <Input type="number" min="0" step="0.01" value={item.height} placeholder="ارتفاع" onChange={(e) => updateLineItem(item.id, 'height', e.target.value)} />
                            <Input type="number" min="0" step="0.01" value={item.quantity} placeholder="تعداد" onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)} />
                            <Input type="number" min="0" step="0.01" value={item.unitPrice} placeholder="قیمت واحد" onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)} />
                            <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary">{money(lineTotal)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">مبلغ محاسبه‌شده</p>
                    <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary">{money(calculatedTotal)}</div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">قیمت نهایی (قابل ویرایش)</p>
                    <Input type="number" min="0" step="0.01" value={finalPrice} placeholder="قیمت نهایی" onChange={(e) => { setFinalPrice(e.target.value); setFinalPriceOverridden(true); }} />
                  </div>
                </div>

                <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
                  <Button type="submit">ذخیره سفارش</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو: شماره سفارش، مشتری، همکار" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">همه مراحل</option>
              {ORDER_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>{stage.label}</option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value as 'all' | 'paid' | 'partial' | 'unpaid'); setPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">همه وضعیت‌های مالی</option>
              <option value="paid">تسویه شده</option>
              <option value="partial">پرداخت ناقص</option>
              <option value="unpaid">پرداخت نشده</option>
            </select>
          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState title="هنوز سفارشی ثبت نشده است" description="از دکمه ثبت سفارش استفاده کنید." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>همکار</TableHead>
                    <TableHead>نوع/توری</TableHead>
                    <TableHead>مرحله</TableHead>
                    <TableHead>وضعیت مالی</TableHead>
                    <TableHead>موعد تکمیل</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((order, idx) => (
                    <TableRow key={order.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{fullName(order.customer)}</TableCell>
                      <TableCell>{fullName(order.collaborator || undefined)}</TableCell>
                      <TableCell>{WORK_TYPES.find((item) => item.value === order.workType)?.label} / {order.meshType?.title || '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{ORDER_STAGES.find((item) => item.value === order.stage)?.label ?? order.stage}</Badge></TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{order.paymentSummary.percent}%</div>
                        <div className="font-medium">{money(order.paymentSummary.paidAmount)} / {money(order.paymentSummary.total)}</div>
                      </TableCell>
                      <TableCell>{shamsiDate(order.expectedCompletionDate || undefined)}</TableCell>
                      <TableCell>{shamsiDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openStageDialog(order.id, order.stage)}>تغییر مرحله</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeOrder(order.id)}>حذف (نرم)</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={filteredOrders.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغییر مرحله سفارش</DialogTitle>
            <DialogDescription>مرحله جدید را انتخاب کنید.</DialogDescription>
          </DialogHeader>
          <SearchableSelect options={ORDER_STAGES.map((item) => ({ value: item.value, label: item.label }))} value={selectedStage} onChange={setSelectedStage} placeholder="انتخاب مرحله" />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setStageOpen(false)}>انصراف</Button>
            <Button type="button" onClick={() => void saveStage()}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
