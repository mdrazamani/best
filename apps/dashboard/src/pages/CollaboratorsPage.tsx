import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ClipboardList, Download, Eye, FileText, MoreHorizontal, Plus, Search, Trash2, User, Users } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, invoiceStatusBadgeVariant, invoiceStatusLabel, money, orderStageBadgeVariant, orderStageLabel, shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { PersianDatePicker } from '../components/ui/persian-date-picker';
import { CreateCollaboratorDialog } from '../components/modals/CreateCollaboratorDialog';
import { CreateCustomerDialog } from '../components/modals/CreateCustomerDialog';
import { CreateOrderDialog } from '../components/modals/CreateOrderDialog';
import { CreateInvoiceDialog } from '../components/modals/CreateInvoiceDialog';

const PAGE_SIZE = 10;
const ORDER_STAGE_OPTIONS = [
  { value: 'RECEIVED', label: 'دریافت شده' },
  { value: 'IN_PROGRESS', label: 'در حال انجام' },
  { value: 'READY_IN_WAREHOUSE', label: 'آماده در انبار' },
  { value: 'DELIVERED', label: 'تحویل داده شده' },
  { value: 'CANCELLED', label: 'لغو شده' }
] as const;
const INVOICE_STATUS_OPTIONS = [
  { value: 'UNPAID', label: 'پرداخت نشده' },
  { value: 'PARTIAL', label: 'ناقص' },
  { value: 'PAID', label: 'پرداخت شده' }
] as const;

export function CollaboratorsPage() {
  const {
    collaborators,
    customers,
    invoices: invoiceRows,
    meshTypes,
    collaboratorDetail,
    createCollaborator,
    createCustomer,
    createOrder,
    createInvoice,
    removeCollaborator,
    removeCustomer,
    removeOrder,
    removeInvoice,
    addInvoicePayment,
    addCollaboratorPayment,
    openInvoiceDetail,
    openCollaboratorDetail,
    closeCollaboratorDetail,
    openCustomerDetail,
    openOrderDetail,
    updateOrder,
    navigateToTab,
    downloadProtected
  } = useBestContext();

  const [createCollaboratorOpen, setCreateCollaboratorOpen] = useState(false);
  const [createDetailCustomerOpen, setCreateDetailCustomerOpen] = useState(false);
  const [createDetailOrderOpen, setCreateDetailOrderOpen] = useState(false);
  const [createDetailInvoiceOpen, setCreateDetailInvoiceOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'has_orders' | 'no_orders'>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtor' | 'clear'>('all');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [detailOrdersSearch, setDetailOrdersSearch] = useState('');
  const [detailOrdersStageFilter, setDetailOrdersStageFilter] = useState<'all' | string>('all');
  const [detailInvoicesSearch, setDetailInvoicesSearch] = useState('');
  const [detailInvoicesStatusFilter, setDetailInvoicesStatusFilter] = useState<'all' | string>('all');
  const [detailCustomersSearch, setDetailCustomersSearch] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paidAt: '', note: '' });
  const [collaboratorPaymentOpen, setCollaboratorPaymentOpen] = useState(false);
  const [collaboratorPaymentForm, setCollaboratorPaymentForm] = useState({ amount: '', paidAt: '', note: '' });
  const searchInputRef = useRef<HTMLInputElement | null>(null);


  const collaboratorRemainingById = useMemo(() => {
    const map = new Map<string, number>();

    for (const collaborator of collaborators) {
      const remainingFromAccounting = Number(collaborator.accounting?.remaining ?? 0);
      map.set(collaborator.id, Math.max(remainingFromAccounting, 0));
    }

    for (const invoice of invoiceRows) {
      const isCollaboratorPayer = (invoice.payerType ?? 'CUSTOMER') === 'COLLABORATOR';
      if (!isCollaboratorPayer) continue;
      const relatedOrders = Array.isArray(invoice.orders) && invoice.orders.length ? invoice.orders : invoice.order ? [invoice.order] : [];
      if (!relatedOrders.length) continue;
      if (relatedOrders.every((order) => order.stage === 'CANCELLED')) continue;

      const collaboratorId = relatedOrders.find((order) => order.collaborator?.id)?.collaborator?.id ?? invoice.payerId;
      if (!collaboratorId) continue;
      if (map.has(collaboratorId)) continue;

      const amount = Number(invoice.amount ?? 0);
      const paidAmount = Number(invoice.paidAmount ?? 0);
      const remaining = Math.max(amount - paidAmount, 0);
      if (!remaining) continue;

      map.set(collaboratorId, (map.get(collaboratorId) ?? 0) + remaining);
    }

    return map;
  }, [collaborators, invoiceRows]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collaborators.filter((item) => {
      const name = fullName(item).toLowerCase();
      const phone = (item.phone ?? '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || phone.includes(q);

      const count = item._count?.orders ?? 0;
      const matchesOrders = ordersFilter === 'all' || (ordersFilter === 'has_orders' ? count > 0 : count === 0);

      const remaining = collaboratorRemainingById.get(item.id) ?? 0;
      const matchesBalance =
        balanceFilter === 'all' ||
        (balanceFilter === 'debtor' ? remaining > 0 : remaining <= 0);

      return matchesSearch && matchesOrders && matchesBalance;
    });
  }, [collaborators, search, ordersFilter, balanceFilter, collaboratorRemainingById]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page, totalPages]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearch('');
      setPage(1);
      return;
    }
    if (event.key !== 'Enter') return;
    const firstItem = filteredItems[0];
    if (firstItem?.id) {
      event.preventDefault();
      void openCollaboratorDetail(firstItem.id);
    }
  };

  const detail = collaboratorDetail;
  const detailId = detail?.id as string | undefined;

  const customerOptions = useMemo(
    () =>
      customers.map((item) => ({
        value: item.id,
        label: fullName(item),
        referredByCollaboratorId: item.referredByCollaborator?.id ?? null
      })),
    [customers]
  );

  const meshOptions = useMemo(
    () =>
      meshTypes
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.id,
          label: item.title,
          unitPrice: Number(item.unitPrice ?? 0),
          isDefault: Boolean(item.isDefault)
        })),
    [meshTypes]
  );

  const canInvoiceOrder = (order: any) => {
    if (!order?.id) return false;
    if (order.stage === 'CANCELLED') return false;
    const hasInvoiceLinks = Array.isArray(order.invoiceLinks) && order.invoiceLinks.length > 0;
    const hasInvoices = Array.isArray(order.invoices) && order.invoices.length > 0;
    return !hasInvoiceLinks && !hasInvoices;
  };

  const detailOrderOptions = useMemo(() => {
    const list = Array.isArray(collaboratorDetail?.orders) ? collaboratorDetail.orders : [];
    return list
      .filter((item: any) => canInvoiceOrder(item))
      .map((item: any) => ({
        value: item.id,
        label: `${item.orderNumber ?? item.id}${item.customer ? ` - ${fullName(item.customer)}` : ''}`,
        totalPrice: Number(item.totalPrice ?? 0),
        discountAmount: Number(item.discountAmount ?? 0)
      }));
  }, [collaboratorDetail?.orders]);

  const defaultInvoiceOrderIds = useMemo(
    () => detailOrderOptions.map((item: { value: string }) => item.value),
    [detailOrderOptions]
  );

  const changeOrderStage = async (orderId: string, nextStage: string) => {
    if (!detailId) return;
    setSavingOrderId(orderId);
    try {
      await updateOrder(orderId, { stage: nextStage });
      await openCollaboratorDetail(detailId);
    } finally {
      setSavingOrderId(null);
    }
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentInvoice?.id) return;
    await addInvoicePayment(paymentInvoice.id, {
      amount: Number(paymentForm.amount || 0),
      paidAt: paymentForm.paidAt || undefined,
      note: paymentForm.note || undefined
    });
    if (detailId) await openCollaboratorDetail(detailId);
    setPaymentOpen(false);
    setPaymentInvoice(null);
    setPaymentForm({ amount: '', paidAt: '', note: '' });
  };

  const submitCollaboratorPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!detailId) return;
    await addCollaboratorPayment(detailId, {
      amount: Number(collaboratorPaymentForm.amount || 0),
      paidAt: collaboratorPaymentForm.paidAt || undefined,
      note: collaboratorPaymentForm.note || undefined
    });
    await openCollaboratorDetail(detailId);
    setCollaboratorPaymentOpen(false);
    setCollaboratorPaymentForm({ amount: '', paidAt: '', note: '' });
  };

  if (detail) {
    const orders = Array.isArray(detail.orders) ? detail.orders : [];
    const invoices = Array.isArray(detail.invoices) ? detail.invoices : [];
    const paymentHistory = Array.isArray(detail.paymentHistory) ? detail.paymentHistory : [];
    const detailCustomers = Array.isArray(detail.customers) ? detail.customers : [];
    const totalRemaining = Number(detail.summary?.totalRemaining ?? 0);
    const filteredOrders = orders.filter((order: any) => {
      const q = detailOrdersSearch.trim().toLowerCase();
      const orderNumber = (order.orderNumber ?? '').toLowerCase();
      const customerName = fullName(order.customer).toLowerCase();
      const matchesSearch = !q || orderNumber.includes(q) || customerName.includes(q);
      const matchesStage = detailOrdersStageFilter === 'all' || order.stage === detailOrdersStageFilter;
      return matchesSearch && matchesStage;
    });

    const filteredInvoices = invoices.filter((invoice: any) => {
      const q = detailInvoicesSearch.trim().toLowerCase();
      const invoiceNumber = (invoice.invoiceNumber ?? '').toLowerCase();
      const orderNumbers = Array.isArray(invoice.orders)
        ? invoice.orders.map((item: any) => item?.orderNumber ?? '').join(' ')
        : (invoice.order?.orderNumber ?? '');
      const matchesSearch = !q || invoiceNumber.includes(q) || orderNumbers.toLowerCase().includes(q);
      const matchesStatus = detailInvoicesStatusFilter === 'all' || invoice.status === detailInvoicesStatusFilter;
      return matchesSearch && matchesStatus;
    });

    const filteredCustomers = detailCustomers.filter((customer: any) => {
      const q = detailCustomersSearch.trim().toLowerCase();
      const name = fullName(customer).toLowerCase();
      const phone = (customer.phone ?? '').toLowerCase();
      return !q || name.includes(q) || phone.includes(q);
    });

    return (
      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-extrabold">
                <Users className="h-6 w-6 text-muted-foreground" />
                جزئیات همکار
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{fullName(detail)} - تاریخ ثبت: {shamsiDate(detail.createdAt)}</p>
            </div>
            <Button variant="outline" onClick={closeCollaboratorDetail}>
              <ArrowRight className="h-4 w-4" />
              بازگشت به لیست
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تعداد سفارش‌ها</p>
                <p className="mt-1 text-lg font-bold">{detail.summary?.totalOrders ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مجموع مبلغ فاکتورها</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalOrderAmount ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ فاکتورهای همکار</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalInvoiced ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">کل پرداخت‌شده</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalPaid ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  فاکتوری: {money(detail.summary?.totalInvoicePaid ?? 0)} | کلی: {money(detail.summary?.totalDirectPaid ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مانده</p>
                <p className="mt-1 text-lg font-bold text-destructive">{money(totalRemaining)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تحویل‌شده / درحال‌انجام</p>
                <p className="mt-1 text-lg font-bold">{detail.summary?.completedOrders ?? 0} / {detail.summary?.inProgressOrders ?? 0}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
              <p><span className="font-semibold">موبایل:</span> {detail.phone || '-'}</p>
              <p><span className="font-semibold">آدرس:</span> {detail.address || '-'}</p>
              <p><span className="font-semibold">توضیحات:</span> {detail.description || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-xl font-bold">پرداخت‌های همکار</CardTitle>
            <Button
              size="sm"
              disabled={totalRemaining <= 0}
              onClick={() => {
                setCollaboratorPaymentForm((prev) => ({
                  ...prev,
                  amount: totalRemaining > 0 ? String(totalRemaining) : ''
                }));
                setCollaboratorPaymentOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              ثبت پرداخت برای همکار
            </Button>
          </CardHeader>
          <CardContent>
            {paymentHistory.length === 0 ? (
              <EmptyState title="پرداختی برای این همکار ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>تاریخ پرداخت</TableHead>
                    <TableHead>منبع پرداخت</TableHead>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>ثبت‌کننده</TableHead>
                    <TableHead>توضیح</TableHead>
                    <TableHead>رسید</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((item: any, idx: number) => (
                    <TableRow key={item.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{shamsiDate(item.paidAt)}</TableCell>
                      <TableCell>{item.source === 'COLLABORATOR' ? 'پرداخت کلی همکار' : 'پرداخت فاکتور'}</TableCell>
                      <TableCell>{item.invoiceNumber || '-'}</TableCell>
                      <TableCell className="font-semibold">{money(Number(item.amount ?? 0))}</TableCell>
                      <TableCell>{fullName(item.createdBy)}</TableCell>
                      <TableCell>{item.note || '-'}</TableCell>
                      <TableCell>
                        {item.source === 'COLLABORATOR' && detailId && item.collaboratorPaymentId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void downloadProtected(`/collaborators/${detailId}/payments/${item.collaboratorPaymentId}/pdf`)}
                          >
                            <Download className="h-4 w-4" />
                            دانلود رسید
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              سفارشات همکار
            </CardTitle>
            <Button size="sm" onClick={() => setCreateDetailOrderOpen(true)}>
              <Plus className="h-4 w-4" />
              افزودن سفارش
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid gap-3 md:grid-cols-3">
              <Input
                className="md:col-span-2"
                placeholder="جستجو در شماره سفارش یا نام مشتری"
                value={detailOrdersSearch}
                onChange={(e) => setDetailOrdersSearch(e.target.value)}
              />
              <SearchableSelect
                value={detailOrdersStageFilter}
                onChange={(value) => setDetailOrdersStageFilter((value || 'all') as 'all' | string)}
                options={[{ value: 'all', label: 'همه مراحل' }, ...ORDER_STAGE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))]}
                placeholder="فیلتر مرحله"
                isSearchable={false}
              />
            </div>
            {filteredOrders.length === 0 ? (
              <EmptyState title="هنوز سفارشی برای این همکار ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>مرحله</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead>بروزرسانی مرحله</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any, idx: number) => (
                    <TableRow key={order.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>
                        {order.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openOrderDetail(order.id);
                              navigateToTab('orders');
                            }}
                          >
                            {order.orderNumber ?? '-'}
                          </button>
                        ) : (order.orderNumber ?? '-')}
                      </TableCell>
                      <TableCell>
                        {order.customer?.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openCustomerDetail(order.customer.id);
                              navigateToTab('customers');
                            }}
                          >
                            {fullName(order.customer)}
                          </button>
                        ) : fullName(order.customer)}
                      </TableCell>
                      <TableCell><Badge variant={orderStageBadgeVariant(order.stage)}>{orderStageLabel(order.stage)}</Badge></TableCell>
                      <TableCell>{money(Number(order.totalPrice ?? 0))}</TableCell>
                      <TableCell>{shamsiDate(order.createdAt)}</TableCell>
                      <TableCell>
                        {order.id ? (
                          <div className="flex w-full min-w-[170px] items-center gap-2 sm:min-w-[240px]">
                            <SearchableSelect
                              value={order.stage}
                              onChange={(value) => {
                                void changeOrderStage(order.id, value);
                              }}
                              options={ORDER_STAGE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                              placeholder="انتخاب مرحله"
                              isSearchable={false}
                              className="flex-1"
                              disabled={savingOrderId === order.id}
                            />
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {order.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  await removeOrder(order.id);
                                  if (detailId) await openCollaboratorDetail(detailId);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <FileText className="h-5 w-5 text-muted-foreground" />
              فاکتورهای همکار
            </CardTitle>
            <Button size="sm" onClick={() => setCreateDetailInvoiceOpen(true)}>
              <Plus className="h-4 w-4" />
              افزودن فاکتور
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid gap-3 md:grid-cols-3">
              <Input
                className="md:col-span-2"
                placeholder="جستجو در شماره فاکتور یا سفارش"
                value={detailInvoicesSearch}
                onChange={(e) => setDetailInvoicesSearch(e.target.value)}
              />
              <SearchableSelect
                value={detailInvoicesStatusFilter}
                onChange={(value) => setDetailInvoicesStatusFilter((value || 'all') as 'all' | string)}
                options={[{ value: 'all', label: 'همه وضعیت‌ها' }, ...INVOICE_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))]}
                placeholder="فیلتر وضعیت"
                isSearchable={false}
              />
            </div>
            {filteredInvoices.length === 0 ? (
              <EmptyState title="هنوز فاکتوری برای این همکار ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>پرداختی / کل</TableHead>
                    <TableHead>سررسید</TableHead>
                    <TableHead>دانلود</TableHead>
                    <TableHead>مانده</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice: any, idx: number) => (
                    <TableRow key={invoice.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{invoice.invoiceNumber ?? '-'}</TableCell>
                      <TableCell>
                        {Array.isArray(invoice.orders) && invoice.orders.length > 1 ? (
                          invoice.orders.map((item: any) => item?.orderNumber).filter(Boolean).join('، ')
                        ) : invoice.order?.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openOrderDetail(invoice.order.id);
                              navigateToTab('orders');
                            }}
                          >
                            {invoice.order?.orderNumber ?? '-'}
                          </button>
                        ) : ((Array.isArray(invoice.orders) && invoice.orders.length
                          ? invoice.orders.map((item: any) => item?.orderNumber).filter(Boolean).join('، ')
                          : invoice.order?.orderNumber) ?? '-')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
                      </TableCell>
                      <TableCell>{money(Number(invoice.paidAmount ?? 0))} / {money(Number(invoice.amount ?? 0))}</TableCell>
                      <TableCell>{shamsiDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        {invoice.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`)}
                          >
                            <Download className="h-4 w-4" />
                            دانلود
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{money(Math.max(Number(invoice.amount ?? 0) - Number(invoice.paidAmount ?? 0), 0))}</TableCell>
                      <TableCell>
                        {invoice.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  void openInvoiceDetail(invoice.id);
                                  navigateToTab('invoices');
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                جزئیات / تاریخچه پرداخت
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={invoice.status === 'PAID'}
                                onClick={() => {
                                  setPaymentInvoice(invoice);
                                  setPaymentOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                ثبت پرداخت جدید
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`)}>
                                <Download className="h-4 w-4" />
                                دانلود PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  await removeInvoice(invoice.id);
                                  if (detailId) await openCollaboratorDetail(detailId);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <User className="h-5 w-5 text-muted-foreground" />
              مشتریان مرتبط
            </CardTitle>
            <Button size="sm" onClick={() => setCreateDetailCustomerOpen(true)}>
              <Plus className="h-4 w-4" />
              افزودن مشتری
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Input
                placeholder="جستجو در نام یا شماره تماس مشتری"
                value={detailCustomersSearch}
                onChange={(e) => setDetailCustomersSearch(e.target.value)}
              />
            </div>
            {filteredCustomers.length === 0 ? (
              <EmptyState title="هیچ مشتری مرتبطی برای این همکار ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>شماره تماس</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer: any, idx: number) => (
                    <TableRow key={customer.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>
                        {customer.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openCustomerDetail(customer.id);
                              navigateToTab('customers');
                            }}
                          >
                            {fullName(customer)}
                          </button>
                        ) : fullName(customer)}
                      </TableCell>
                      <TableCell>{customer.phone ?? '-'}</TableCell>
                      <TableCell>
                        {customer.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  await removeCustomer(customer.id);
                                  if (detailId) await openCollaboratorDetail(detailId);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <CreateCustomerDialog
          open={createDetailCustomerOpen}
          onOpenChange={setCreateDetailCustomerOpen}
          title="افزودن مشتری"
          description="مشتری جدید با همین همکار به عنوان معرف ثبت می‌شود."
          lockedReferrer={detailId ? { id: detailId, label: fullName(detail) } : undefined}
          onSubmit={async (payload) => {
            await createCustomer(payload as Record<string, unknown>);
            if (detailId) await openCollaboratorDetail(detailId);
          }}
        />

        <CreateOrderDialog
          open={createDetailOrderOpen}
          onOpenChange={setCreateDetailOrderOpen}
          title="افزودن سفارش"
          description="سفارش جدید برای این همکار ثبت می‌شود."
          lockedCollaborator={detailId ? { id: detailId, label: fullName(detail) } : undefined}
          customerOptions={customerOptions}
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
            if (detailId) await openCollaboratorDetail(detailId);
          }}
        />

        <CreateInvoiceDialog
          open={createDetailInvoiceOpen}
          onOpenChange={setCreateDetailInvoiceOpen}
          title="افزودن فاکتور"
          description="فاکتور جدید برای همکار ثبت می‌شود."
          orderOptions={detailOrderOptions}
          defaultSelectedOrderIds={defaultInvoiceOrderIds}
          lockedPayer={detailId ? { type: 'COLLABORATOR', id: detailId, label: fullName(detail) } : undefined}
          onSubmit={async (payload) => {
            await createInvoice(payload as Record<string, unknown>);
            if (detailId) await openCollaboratorDetail(detailId);
          }}
        />

        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>ثبت پرداخت فاکتور</DialogTitle>
              <DialogDescription>
                {paymentInvoice?.invoiceNumber ? `پرداخت برای فاکتور ${paymentInvoice.invoiceNumber}` : 'اطلاعات پرداخت را وارد کنید.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitPayment} className="space-y-3">
              <div>
                <label className="text-sm font-medium">مبلغ پرداخت (تومان)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">تاریخ پرداخت</label>
                <PersianDatePicker
                  value={paymentForm.paidAt}
                  onChange={(value) => setPaymentForm((prev) => ({ ...prev, paidAt: value ?? '' }))}
                  placeholder="تاریخ پرداخت"
                />
              </div>
              <div>
                <label className="text-sm font-medium">توضیح (اختیاری)</label>
                <Textarea
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit">ثبت پرداخت</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={collaboratorPaymentOpen} onOpenChange={setCollaboratorPaymentOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>ثبت پرداخت کلی همکار</DialogTitle>
              <DialogDescription>
                این پرداخت به بدهی کلی همکار اعمال می‌شود و الزامی نیست به فاکتور خاصی متصل شود.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCollaboratorPayment} className="space-y-3">
              <div>
                <label className="text-sm font-medium">مبلغ پرداخت (تومان)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={collaboratorPaymentForm.amount}
                  onChange={(e) => setCollaboratorPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">تاریخ پرداخت</label>
                <PersianDatePicker
                  value={collaboratorPaymentForm.paidAt}
                  onChange={(value) => setCollaboratorPaymentForm((prev) => ({ ...prev, paidAt: value ?? '' }))}
                  placeholder="تاریخ پرداخت"
                />
              </div>
              <div>
                <label className="text-sm font-medium">توضیح (اختیاری)</label>
                <Textarea
                  value={collaboratorPaymentForm.note}
                  onChange={(e) => setCollaboratorPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setCollaboratorPaymentOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit">ثبت پرداخت</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">همکاران</CardTitle>
          <Button onClick={() => setCreateCollaboratorOpen(true)}>
            <Plus className="h-4 w-4" />
            ثبت همکار
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={searchInputRef} className="pr-9" placeholder="جستجو در نام یا شماره تماس ( / )" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} onKeyDown={onSearchKeyDown} />
            </div>
            <SearchableSelect
              value={ordersFilter}
              onChange={(value) => { setOrdersFilter(value as 'all' | 'has_orders' | 'no_orders'); setPage(1); }}
              options={[
                { value: 'all', label: 'همه همکاران' },
                { value: 'has_orders', label: 'دارای سفارش' },
                { value: 'no_orders', label: 'بدون سفارش' }
              ]}
              placeholder="فیلتر سفارش"
              isSearchable={false}
            />
            <SearchableSelect
              value={balanceFilter}
              onChange={(value) => { setBalanceFilter(value as 'all' | 'debtor' | 'clear'); setPage(1); }}
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'debtor', label: 'همکاران بدهکار' },
                { value: 'clear', label: 'بدون بدهی' }
              ]}
              placeholder="فیلتر مانده حساب"
              isSearchable={false}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState title="همکاری پیدا نشد" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>موبایل</TableHead>
                    <TableHead>تعداد سفارش</TableHead>
                    <TableHead>مانده حساب</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => {
                    const remaining = collaboratorRemainingById.get(item.id) ?? 0;
                    return (
                      <TableRow key={item.id} className={`${idx % 2 ? 'bg-muted/10' : ''} cursor-pointer`} onDoubleClick={() => void openCollaboratorDetail(item.id)}>
                        <TableCell>
                          <button type="button" className="font-medium text-primary hover:underline" onClick={() => void openCollaboratorDetail(item.id)}>
                            {fullName(item)}
                          </button>
                        </TableCell>
                        <TableCell>{item.phone || '-'}</TableCell>
                        <TableCell>{item._count?.orders || 0}</TableCell>
                        <TableCell className={remaining > 0 ? 'font-semibold text-destructive' : ''}>{money(remaining)}</TableCell>
                        <TableCell>{shamsiDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void openCollaboratorDetail(item.id)}>
                                <Eye className="h-4 w-4" />
                                مشاهده
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeCollaborator(item.id)}>
                                <Trash2 className="h-4 w-4" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={filteredItems.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <CreateCollaboratorDialog
        open={createCollaboratorOpen}
        onOpenChange={setCreateCollaboratorOpen}
        onSubmit={async (payload) => {
          await createCollaborator(payload as Record<string, unknown>);
        }}
      />
    </section>
  );
}

