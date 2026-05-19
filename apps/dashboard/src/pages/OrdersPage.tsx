import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Download, Eye, FileText, History, List, MoreHorizontal, Plus, Search, Trash2, User, Users } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { INVOICE_STATUS, ORDER_STAGES, WORK_TYPES, activityActionLabel, activityDescriptionLabel, fullName, invoiceStatusBadgeVariant, invoiceStatusLabel, money, orderStageBadgeVariant, orderStageLabel, paymentStatusBadgeVariant, paymentStatusLabel, shamsiDate, textFa } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { PersianDatePicker } from '../components/ui/persian-date-picker';
import { CreateOrderDialog } from '../components/modals/CreateOrderDialog';

const PAGE_SIZE = 10;
const INVOICE_STATUS_OPTIONS = [
  { value: 'UNPAID', label: 'پرداخت نشده' },
  { value: 'PARTIAL', label: 'ناقص' },
  { value: 'PAID', label: 'پرداخت شده' }
] as const;

const toNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const payerTypeLabel = (value?: string) => {
  if (value === 'COLLABORATOR') return 'همکار';
  return 'مشتری';
};

const meshTypeLabelsFromItems = (lineItems?: Array<{ meshType?: { title?: string } | null }>) => {
  const titles = Array.from(new Set((lineItems ?? []).map((item) => item?.meshType?.title).filter(Boolean)));
  return titles.length ? titles.join('، ') : '-';
};

export function OrdersPage() {
  const {
    customers,
    collaborators,
    meshTypes,
    orders,
    orderDetail,
    createOrder,
    createCustomer,
    updateOrder,
    removeOrder,
    openOrderDetail,
    openInvoiceDetail,
    closeOrderDetail,
    openCustomerDetail,
    openCollaboratorDetail,
    createInvoice,
    navigateToTab,
    downloadProtected
  } = useBestContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageOrderId, setStageOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  const [selectedStage, setSelectedStage] = useState('RECEIVED');
  const [detailStageDraft, setDetailStageDraft] = useState('RECEIVED');
  const [detailStageSaving, setDetailStageSaving] = useState(false);
  const [detailInvoiceOpen, setDetailInvoiceOpen] = useState(false);
  const [detailInvoiceSubmitting, setDetailInvoiceSubmitting] = useState(false);
  const [detailInvoiceForm, setDetailInvoiceForm] = useState({
    title: '',
    amount: '',
    discountAmount: '',
    initialPaidAmount: '',
    status: 'UNPAID',
    payerType: 'CUSTOMER',
    dueDate: '',
    description: ''
  });

  const customerOptions = useMemo(
    () =>
      customers.map((item) => ({
        value: item.id,
        label: fullName(item),
        referredByCollaboratorId: item.referredByCollaborator?.id ?? null
      })),
    [customers]
  );
  const collaboratorOptions = useMemo(
    () => [{ value: '', label: 'بدون همکار' }, ...collaborators.map((item) => ({ value: item.id, label: fullName(item) }))],
    [collaborators]
  );
  const meshOptions = useMemo(() => meshTypes.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.title })), [meshTypes]);
  const stageFilterOptions = useMemo(
    () => [{ value: 'all', label: 'همه مراحل' }, ...ORDER_STAGES.map((stage) => ({ value: stage.value, label: stage.label }))],
    []
  );
  const paymentFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه وضعیت‌های پرداخت' },
      { value: 'paid', label: 'تسویه‌شده' },
      { value: 'partial', label: 'پرداخت ناقص' },
      { value: 'unpaid', label: 'پرداخت نشده' }
    ],
    []
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((item) => {
      const orderNo = item.orderNumber.toLowerCase();
      const orderTitle = (item.title ?? '').toLowerCase();
      const customerName = `${item.customer?.firstName ?? ''} ${item.customer?.lastName ?? ''}`.toLowerCase();
      const customerPhone = (item.customer?.phone ?? '').toLowerCase();
      const collaboratorName = `${item.collaborator?.firstName ?? ''} ${item.collaborator?.lastName ?? ''}`.toLowerCase();
      const collaboratorPhone = (item.collaborator?.phone ?? '').toLowerCase();
      const matchesSearch =
        !q ||
        orderNo.includes(q) ||
        orderTitle.includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        collaboratorName.includes(q) ||
        collaboratorPhone.includes(q);
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

  useEffect(() => {
    if (orderDetail?.stage) {
      setDetailStageDraft(orderDetail.stage);
    }
  }, [orderDetail?.id, orderDetail?.stage]);

  useEffect(() => {
    if (!orderDetail?.id) return;
    const remainingAmount = Number(orderDetail.paymentSummary?.remainingAmount ?? orderDetail.paymentSummary?.total ?? orderDetail.totalPrice ?? 0);
    setDetailInvoiceForm({
      title: '',
      amount: remainingAmount > 0 ? String(remainingAmount) : '',
      discountAmount: '',
      initialPaidAmount: '',
      status: 'UNPAID',
      payerType: orderDetail.collaborator?.id ? 'COLLABORATOR' : 'CUSTOMER',
      dueDate: orderDetail.expectedCompletionDate ?? '',
      description: ''
    });
  }, [orderDetail?.id, orderDetail?.paymentSummary?.remainingAmount, orderDetail?.paymentSummary?.total, orderDetail?.totalPrice, orderDetail?.collaborator?.id, orderDetail?.expectedCompletionDate]);

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

  const openDetail = async (orderId: string) => {
    await openOrderDetail(orderId);
  };

  const saveDetailStage = async (nextStage: string) => {
    if (!orderDetail?.id) return;
    setDetailStageSaving(true);
    try {
      await updateOrder(orderDetail.id, { stage: nextStage });
      await openOrderDetail(orderDetail.id);
    } finally {
      setDetailStageSaving(false);
    }
  };

  const submitDetailInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderDetail?.id) return;

    const amount = toNumber(detailInvoiceForm.amount);
    const discountAmount = toNumber(detailInvoiceForm.discountAmount);
    const initialPaidAmount = toNumber(detailInvoiceForm.initialPaidAmount);

    setDetailInvoiceSubmitting(true);
    try {
      await createInvoice({
        title: detailInvoiceForm.title || undefined,
        orderIds: [orderDetail.id],
        amount,
        discountAmount,
        initialPaidAmount,
        status: detailInvoiceForm.status,
        payerType: detailInvoiceForm.payerType,
        payerId: detailInvoiceForm.payerType === 'COLLABORATOR' ? orderDetail.collaborator?.id : orderDetail.customer?.id,
        dueDate: detailInvoiceForm.dueDate || undefined,
        description: detailInvoiceForm.description || undefined
      });
      await openOrderDetail(orderDetail.id);
      setDetailInvoiceOpen(false);
    } finally {
      setDetailInvoiceSubmitting(false);
    }
  };

  if (orderDetail) {
    const detailLineItems = Array.isArray(orderDetail.lineItems) ? orderDetail.lineItems : [];
    const detailMeshTypeText = meshTypeLabelsFromItems(detailLineItems);
    const detailInvoices = Array.isArray(orderDetail.invoices) ? orderDetail.invoices : [];
    const detailLogs = Array.isArray(orderDetail.operationLogs) ? orderDetail.operationLogs : [];
    const hasInvoices = detailInvoices.length > 0;
    const detailTotal = Number(orderDetail.paymentSummary?.total ?? 0);
    const detailPaidAmount = Number(orderDetail.paymentSummary?.paidAmount ?? 0);
    const detailRemainingAmount = Number(orderDetail.paymentSummary?.remainingAmount ?? 0);
    const detailDiscount = detailInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice?.discountAmount ?? 0), 0);
    const detailBase = Math.max(detailTotal + detailDiscount, 0);
    const detailMoneyLabel = (value: number) => (hasInvoices ? money(value) : '-');

    return (
      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-extrabold">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
                جزئیات سفارش {orderDetail.orderNumber}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">عنوان: {orderDetail.title || '-'}</p>
              <p className="mt-1 text-sm text-muted-foreground">تاریخ ثبت: {shamsiDate(orderDetail.createdAt)}</p>
            </div>
            <Button variant="outline" onClick={closeOrderDetail}>
              <ArrowRight className="h-4 w-4" />
              بازگشت به لیست
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مرحله سفارش</p>
                <p className="mt-1 font-bold">{orderStageLabel(orderDetail.stage)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">درصد پرداخت</p>
                <p className="mt-1 font-bold">{hasInvoices ? `${orderDetail.paymentSummary?.percent ?? 0}%` : '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">بر اساس فاکتورهای ثبت‌شده</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تاریخ تکمیل تقریبی</p>
                <p className="mt-1 font-bold">{shamsiDate(orderDetail.expectedCompletionDate)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">نوع کار / توری</p>
                <p className="mt-1 font-bold">{WORK_TYPES.find((item) => item.value === orderDetail.workType)?.label ?? '-'} / {detailMeshTypeText}</p>
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
              <SearchableSelect
                value={detailStageDraft || orderDetail.stage}
                onChange={(value) => {
                  setDetailStageDraft(value);
                  void saveDetailStage(value);
                }}
                options={ORDER_STAGES.map((item) => ({ value: item.value, label: item.label }))}
                placeholder="تغییر مرحله سفارش"
                isSearchable={false}
                disabled={detailStageSaving}
              />
              <div className="flex items-center px-2 text-xs text-muted-foreground">{detailStageSaving ? 'در حال ذخیره...' : 'تغییر خودکار'}</div>
            </div>
            {!hasInvoices ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">هنوز فاکتوری برای این سفارش ثبت نشده است.</p>
                <p className="text-xs">تا زمان ثبت اولین فاکتور، اعداد مالی بر اساس فاکتور قابل محاسبه نیست.</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ کل سفارش</p>
                <p className="mt-1 text-lg font-bold">{detailMoneyLabel(detailTotal)}</p>
                <p className="mt-1 text-xs text-muted-foreground">پایه: {hasInvoices ? money(detailBase) : '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تخفیف</p>
                <p className="mt-1 text-lg font-bold">{detailMoneyLabel(detailDiscount)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ پرداخت‌شده</p>
                <p className="mt-1 text-lg font-bold">{detailMoneyLabel(detailPaidAmount)}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مانده</p>
                <p className={`mt-1 text-lg font-bold ${hasInvoices && detailRemainingAmount > 0 ? 'text-destructive' : ''}`}>{detailMoneyLabel(detailRemainingAmount)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تعداد فاکتورها</p>
                <p className="mt-1 text-lg font-bold">{detailInvoices.length}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  مشخصات مشتری
                </p>
                {orderDetail.customer?.id ? (
                  <button
                    type="button"
                    className="mt-1 font-semibold text-primary hover:underline"
                    onClick={() => {
                      void openCustomerDetail(orderDetail.customer.id);
                      navigateToTab('customers');
                    }}
                  >
                    {fullName(orderDetail.customer)}
                  </button>
                ) : (
                  <p className="mt-1 font-semibold">{fullName(orderDetail.customer)}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">موبایل: {orderDetail.customer?.phone || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">آدرس: {orderDetail.customer?.address || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  مشخصات همکار
                </p>
                {orderDetail.collaborator?.id ? (
                  <button
                    type="button"
                    className="mt-1 font-semibold text-primary hover:underline"
                    onClick={() => {
                      void openCollaboratorDetail(orderDetail.collaborator.id);
                      navigateToTab('collaborators');
                    }}
                  >
                    {fullName(orderDetail.collaborator)}
                  </button>
                ) : (
                  <p className="mt-1 font-semibold">{fullName(orderDetail.collaborator)}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">موبایل: {orderDetail.collaborator?.phone || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">آدرس: {orderDetail.collaborator?.address || '-'}</p>
              </div>
              <p className="sm:col-span-2">
                <span className="font-semibold">توضیحات سفارش:</span> {orderDetail.description || '-'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <List className="h-5 w-5 text-muted-foreground" />
              ردیف‌های سفارش
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailLineItems.length === 0 ? (
              <EmptyState title="هیچ ردیفی برای سفارش ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع توری</TableHead>
                    <TableHead>عرض</TableHead>
                    <TableHead>ارتفاع</TableHead>
                    <TableHead>تعداد</TableHead>
                    <TableHead>قیمت واحد</TableHead>
                    <TableHead>جمع ردیف</TableHead>
                    <TableHead>توضیحات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLineItems.map((item: any, idx: number) => (
                    <TableRow key={item.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{item.meshType?.title || '-'}</TableCell>
                      <TableCell>{Number(item.width ?? 0)}</TableCell>
                      <TableCell>{Number(item.height ?? 0)}</TableCell>
                      <TableCell>{Number(item.quantity ?? 0)}</TableCell>
                      <TableCell>{money(Number(item.unitPrice ?? 0))}</TableCell>
                      <TableCell className="font-semibold">{money(Number(item.lineTotal ?? 0))}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <FileText className="h-5 w-5 text-muted-foreground" />
              فاکتورهای سفارش و وضعیت پرداخت
            </CardTitle>
            <Button onClick={() => setDetailInvoiceOpen(true)} disabled={detailInvoices.length > 0}>
              <Plus className="h-4 w-4" />
              افزودن فاکتور
            </Button>
          </CardHeader>
          <CardContent>
            {detailInvoices.length === 0 ? (
              <EmptyState title="هنوز فاکتوری برای این سفارش ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead>پرداخت‌کننده</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>پرداختی / کل</TableHead>
                    <TableHead>سررسید</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead>دانلود</TableHead>
                    <TableHead>مشاهده جزئیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailInvoices.map((invoice: any, idx: number) => (
                    <TableRow key={invoice.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium">{invoice.invoiceNumber ?? '-'}</TableCell>
                      <TableCell>{invoice.title || '-'}</TableCell>
                      <TableCell>{payerTypeLabel(invoice.payerType)}</TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>
                          {invoiceStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>{money(Number(invoice.paidAmount ?? 0))} / {money(Number(invoice.amount ?? 0))}</div>
                        <div className="text-xs text-muted-foreground">تخفیف: {money(Number(invoice.discountAmount ?? 0))}</div>
                      </TableCell>
                      <TableCell>{shamsiDate(invoice.dueDate)}</TableCell>
                      <TableCell>{shamsiDate(invoice.createdAt)}</TableCell>
                      <TableCell>
                        {invoice.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber ?? 'invoice'}.pdf`)}
                          >
                            <Download className="h-4 w-4" />
                            دانلود
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {invoice.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void openInvoiceDetail(invoice.id);
                              navigateToTab('invoices');
                            }}
                          >
                            جزئیات
                          </Button>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailInvoiceOpen} onOpenChange={setDetailInvoiceOpen}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>افزودن فاکتور برای سفارش {orderDetail.orderNumber}</DialogTitle>
              <DialogDescription>از همین صفحه می‌توانید فاکتور جدید ثبت کنید.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitDetailInvoice} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  value={detailInvoiceForm.title}
                  placeholder="عنوان فاکتور (اختیاری)"
                  onChange={(e) => setDetailInvoiceForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={detailInvoiceForm.amount}
                  placeholder="مبلغ کل فاکتور"
                  onChange={(e) => setDetailInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={detailInvoiceForm.discountAmount}
                  placeholder="تخفیف"
                  onChange={(e) => setDetailInvoiceForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={detailInvoiceForm.initialPaidAmount}
                  placeholder="پرداخت اولیه"
                  onChange={(e) => setDetailInvoiceForm((prev) => ({ ...prev, initialPaidAmount: e.target.value }))}
                />
                <SearchableSelect
                  value={detailInvoiceForm.status}
                  onChange={(value) => setDetailInvoiceForm((prev) => ({ ...prev, status: value }))}
                  options={INVOICE_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                  placeholder="وضعیت فاکتور"
                  isSearchable={false}
                />
                <SearchableSelect
                  value={detailInvoiceForm.payerType}
                  onChange={(value) => setDetailInvoiceForm((prev) => ({ ...prev, payerType: value }))}
                  options={[
                    { value: 'CUSTOMER', label: 'پرداخت‌کننده: مشتری' },
                    ...(orderDetail.collaborator?.id ? [{ value: 'COLLABORATOR', label: 'پرداخت‌کننده: همکار' }] : [])
                  ]}
                  placeholder="نوع پرداخت‌کننده"
                  isSearchable={false}
                />
                <div className="sm:col-span-2">
                  <PersianDatePicker
                    value={detailInvoiceForm.dueDate}
                    onChange={(value) => setDetailInvoiceForm((prev) => ({ ...prev, dueDate: value ?? '' }))}
                    placeholder="تاریخ سررسید فاکتور"
                  />
                </div>
              </div>
              <Textarea
                value={detailInvoiceForm.description}
                placeholder="توضیحات فاکتور"
                onChange={(e) => setDetailInvoiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setDetailInvoiceOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" disabled={detailInvoiceSubmitting}>
                  ذخیره فاکتور
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="h-5 w-5 text-muted-foreground" />
              آخرین تغییرات سفارش
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailLogs.length === 0 ? (
              <EmptyState title="هیچ لاگی برای سفارش ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>کاربر</TableHead>
                    <TableHead>عملیات</TableHead>
                    <TableHead>شرح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLogs.slice(0, 20).map((log: any, idx: number) => (
                    <TableRow key={log.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{shamsiDate(log.createdAt)}</TableCell>
                      <TableCell>{fullName(log.actor)}</TableCell>
                      <TableCell>{activityActionLabel(log.action)}</TableCell>
                      <TableCell>{activityDescriptionLabel(log.description)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">مدیریت سفارشات</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            ثبت سفارش
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو: شماره سفارش، نام/شماره مشتری، نام/شماره همکار" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={stageFilter}
              onChange={(value) => {
                setStageFilter((value || 'all') as 'all' | string);
                setPage(1);
              }}
              options={stageFilterOptions}
              placeholder="همه مراحل"
              isSearchable={false}
            />
            <SearchableSelect
              value={paymentFilter}
              onChange={(value) => {
                setPaymentFilter((value || 'all') as 'all' | 'paid' | 'partial' | 'unpaid');
                setPage(1);
              }}
              options={paymentFilterOptions}
              placeholder="همه وضعیت‌های پرداخت"
              isSearchable={false}
            />
          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState title="سفارشی پیدا نشد" description="با ثبت سفارش جدید شروع کنید." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>همکار</TableHead>
                    <TableHead>نوع/توری</TableHead>
                    <TableHead>مرحله</TableHead>
                    <TableHead>پرداخت</TableHead>
                    <TableHead>تکمیل تقریبی</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((order, idx) => (
                    <TableRow key={order.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => void openDetail(order.id)}>
                          {order.orderNumber}
                        </button>
                        <div className="text-xs text-muted-foreground">{textFa(order.title)}</div>
                      </TableCell>
                      <TableCell>
                        {order.customer?.id ? (
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => {
                              const customerId = order.customer?.id;
                              if (!customerId) return;
                              void openCustomerDetail(customerId);
                              navigateToTab('customers');
                            }}
                          >
                            {fullName(order.customer)}
                          </button>
                        ) : (
                          fullName(order.customer)
                        )}
                      </TableCell>
                      <TableCell>
                        {order.collaborator?.id ? (
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => {
                              const collaboratorId = order.collaborator?.id;
                              if (!collaboratorId) return;
                              void openCollaboratorDetail(collaboratorId);
                              navigateToTab('collaborators');
                            }}
                          >
                            {fullName(order.collaborator)}
                          </button>
                        ) : (
                          fullName(order.collaborator || undefined)
                        )}
                      </TableCell>
                      <TableCell>{WORK_TYPES.find((item) => item.value === order.workType)?.label} / {meshTypeLabelsFromItems(order.lineItems)}</TableCell>
                      <TableCell><Badge variant={orderStageBadgeVariant(order.stage)}>{ORDER_STAGES.find((item) => item.value === order.stage)?.label ?? order.stage}</Badge></TableCell>
                      <TableCell>
                        <div className="mb-1">
                          <Badge variant={paymentStatusBadgeVariant(order.paymentSummary.status)}>{paymentStatusLabel(order.paymentSummary.status)}</Badge>
                        </div>
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
                            <DropdownMenuItem onClick={() => void openDetail(order.id)}>
                              <Eye className="h-4 w-4" />
                              مشاهده
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openStageDialog(order.id, order.stage)}>تغییر مرحله</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeOrder(order.id)}>حذف </DropdownMenuItem>
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
      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customerOptions={customerOptions}
        collaboratorOptions={collaboratorOptions.filter((item) => item.value)}
        meshOptions={meshOptions}
        onQuickCreateCustomer={async (payload) => {
          const created = await createCustomer(payload as Record<string, unknown>);
          if (!created) return null;
          const id = (created as any).id as string | undefined;
          const firstName = (created as any).firstName as string | undefined;
          const lastName = (created as any).lastName as string | undefined;
          if (!id) return null;
          return { id, label: [firstName, lastName].filter(Boolean).join(' ').trim() || 'مشتری جدید' };
        }}
        onSubmit={async (payload) => {
          await createOrder(payload as Record<string, unknown>);
        }}
      />

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

