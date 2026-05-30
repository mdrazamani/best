import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Download, Eye, MoreHorizontal, Plus, Search, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { useBestContext } from '../contexts/best-context';
import { INVOICE_STATUS, fullName, invoiceStatusBadgeVariant, money, shamsiDate, textFa } from '../lib/format';
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
import { ConfirmActionDialog } from '../components/shared/confirm-action-dialog';
import { Pagination } from '../components/shared/pagination';
import { PersianDatePicker } from '../components/ui/persian-date-picker';
import { CreateInvoiceDialog } from '../components/modals/CreateInvoiceDialog';

const PAGE_SIZE = 10;

const emptyInvoiceForm = {
  title: '',
  amount: '',
  discountAmount: '',
  status: 'UNPAID',
  payerId: '',
  dueDate: '',
  description: ''
} as const;

type InvoiceFormState = {
  title: string;
  amount: string;
  discountAmount: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payerId: string;
  dueDate: string;
  description: string;
};

const emptyPaymentForm = {
  amount: '',
  paidAt: '',
  note: ''
};

export function InvoicesPage() {
  const {
    orders,
    invoices,
    invoiceDetail,
    createInvoice,
    updateInvoice,
    removeInvoice,
    addInvoicePayment,
    openInvoiceDetail,
    closeInvoiceDetail,
    downloadProtected
  } = useBestContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'UNPAID' | 'PARTIAL' | 'PAID'>('all');
  const [payerFilter, setPayerFilter] = useState<'all' | 'COLLABORATOR'>('all');
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InvoiceFormState>({ ...emptyInvoiceForm });
  const [paymentForm, setPaymentForm] = useState({ ...emptyPaymentForm });

  const orderOptions = useMemo(
    () =>
      orders
        .filter((item) => item.stage !== 'CANCELLED' && !(Array.isArray(item.invoices) && item.invoices.length > 0))
        .map((item) => ({
          value: item.id,
          label: `${item.orderNumber} - ${fullName(item.customer)}${item.collaborator ? ` / ${fullName(item.collaborator)}` : ''}`,
          totalPrice: Number(item.totalPrice ?? 0),
          discountAmount: Number(item.discountAmount ?? 0)
        })),
    [orders]
  );

  const statusFilterOptions = useMemo(() => [{ value: 'all', label: 'همه وضعیت‌ها' }, ...INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))], []);
  const payerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه پرداخت‌کننده‌ها' },
      { value: 'COLLABORATOR', label: 'همکار' }
    ],
    []
  );

  const buildPayerOptions = (orderIds: string[]) => {
    const selectedOrders = orders.filter((item) => orderIds.includes(item.id));
    const map = new Map<string, { value: string; label: string }>();

    for (const order of selectedOrders) {
      if (order.collaborator?.id) {
        map.set(order.collaborator.id, {
          value: order.collaborator.id,
          label: fullName(order.collaborator)
        });
      }
    }

    return Array.from(map.values());
  };

  const getPayerInfo = (invoice: any) => {
    const typeLabel = 'همکار';
    const relatedOrders = Array.isArray(invoice.orders) && invoice.orders.length ? invoice.orders : invoice.order ? [invoice.order] : [];
    const payerRecord = relatedOrders.find((item: any) => item.collaborator?.id === invoice.payerId)?.collaborator ?? relatedOrders[0]?.collaborator;
    const name = fullName(payerRecord || undefined);
    const phone = payerRecord?.phone || '';
    return {
      typeLabel,
      name,
      phone,
      display: `${typeLabel} - ${name || '-'}`
    };
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((item) => {
      const invoiceNo = item.invoiceNumber.toLowerCase();
      const invoiceTitle = (item.title ?? '').toLowerCase();
      const orderNumbers = (item.orders ?? []).map((order) => order.orderNumber.toLowerCase()).join(' ');
      const payerInfo = getPayerInfo(item);
      const matchesSearch =
        !q ||
        invoiceNo.includes(q) ||
        invoiceTitle.includes(q) ||
        orderNumbers.includes(q) ||
        payerInfo.typeLabel.toLowerCase().includes(q) ||
        (payerInfo.name || '').toLowerCase().includes(q) ||
        payerInfo.phone.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const effectivePayer = item.payerType ?? 'COLLABORATOR';
      const matchesPayer = payerFilter === 'all' || effectivePayer === payerFilter;
      return matchesSearch && matchesStatus && matchesPayer;
    });
  }, [invoices, search, statusFilter, payerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, page, totalPages]);

  const openEdit = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    setEditForm({
      title: invoice.title ?? '',
      amount: String(Number(invoice.amount ?? 0)),
      discountAmount: String(Number(invoice.discountAmount ?? 0)),
      status: invoice.status,
      payerId: invoice.payerId ?? '',
      dueDate: invoice.dueDate ?? '',
      description: invoice.description ?? ''
    });
    setEditOpen(true);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingInvoiceId) return;

    await updateInvoice(editingInvoiceId, {
      title: editForm.title || undefined,
      amount: Number(editForm.amount || 0),
      discountAmount: Number(editForm.discountAmount || 0),
      status: editForm.status,
      payerId: editForm.payerId || undefined,
      dueDate: editForm.dueDate || undefined,
      description: editForm.description || undefined
    });

    setEditOpen(false);
    setEditingInvoiceId(null);
    setEditForm({ ...emptyInvoiceForm });
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoiceDetail?.id) return;

    await addInvoicePayment(invoiceDetail.id, {
      amount: Number(paymentForm.amount || 0),
      paidAt: paymentForm.paidAt || undefined,
      note: paymentForm.note || undefined
    });

    await openInvoiceDetail(invoiceDetail.id);
    setPaymentOpen(false);
    setPaymentForm({ ...emptyPaymentForm });
  };

  const openPaymentDialog = () => {
    if (!invoiceDetail) return;
    const remaining = Math.max(Number(invoiceDetail.amount ?? 0) - Number(invoiceDetail.paidAmount ?? 0), 0);
    setPaymentForm({
      ...emptyPaymentForm,
      amount: remaining > 0 ? String(remaining) : ''
    });
    setPaymentOpen(true);
  };

  if (invoiceDetail) {
    const detailOrders = Array.isArray(invoiceDetail.orders) ? invoiceDetail.orders : [];
    const paymentHistory = Array.isArray(invoiceDetail.paymentHistory) ? invoiceDetail.paymentHistory : [];
    const remaining = Math.max(Number(invoiceDetail.amount ?? 0) - Number(invoiceDetail.paidAmount ?? 0), 0);

    return (
      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-extrabold">جزئیات فاکتور {invoiceDetail.invoiceNumber}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">تاریخ ثبت: {shamsiDate(invoiceDetail.createdAt)}</p>
            </div>
            <Button variant="outline" onClick={closeInvoiceDetail}>
              <ArrowRight className="h-4 w-4" />
              بازگشت به لیست
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">وضعیت</p>
                <Badge className="mt-1" variant={invoiceStatusBadgeVariant(invoiceDetail.status)}>{INVOICE_STATUS.find((item) => item.value === invoiceDetail.status)?.label || invoiceDetail.status}</Badge>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ کل</p>
                <p className="mt-1 text-lg font-bold">{money(Number(invoiceDetail.amount ?? 0))}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ پرداختی</p>
                <p className="mt-1 text-lg font-bold">{money(Number(invoiceDetail.paidAmount ?? 0))}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مانده</p>
                <p className={`mt-1 text-lg font-bold ${remaining > 0 ? 'text-destructive' : ''}`}>{money(remaining)}</p>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <p><span className="font-semibold">عنوان:</span> {textFa(invoiceDetail.title)}</p>
              <p><span className="font-semibold">توضیحات:</span> {textFa(invoiceDetail.description)}</p>
              <p><span className="font-semibold">سررسید:</span> {shamsiDate(invoiceDetail.dueDate)}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">سفارش‌های این فاکتور</p>
              {detailOrders.length === 0 ? (
                <EmptyState title="سفارشی برای این فاکتور ثبت نشده است" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>شماره سفارش</TableHead>
                      <TableHead>مشتری</TableHead>
                      <TableHead>همکار</TableHead>
                      <TableHead>مبلغ سفارش</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrders.map((order: any, idx: number) => (
                      <TableRow key={order.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                        <TableCell>{order.orderNumber}</TableCell>
                        <TableCell>{fullName(order.customer)}</TableCell>
                        <TableCell>{fullName(order.collaborator)}</TableCell>
                        <TableCell>{money(Number(order.totalPrice ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">تاریخچه پرداخت‌ها</p>
                <Button onClick={openPaymentDialog} disabled={invoiceDetail.status === 'PAID'}>
                  <Plus className="h-4 w-4" />
                  ثبت پرداخت جدید
                </Button>
              </div>
              {paymentHistory.length === 0 ? (
                <EmptyState title="تاکنون پرداختی برای این فاکتور ثبت نشده است" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ پرداخت</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead>ثبت‌کننده</TableHead>
                      <TableHead>توضیح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((item: any, idx: number) => (
                      <TableRow key={item.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                        <TableCell>{shamsiDate(item.paidAt)}</TableCell>
                        <TableCell className="font-semibold">{money(Number(item.amount ?? 0))}</TableCell>
                        <TableCell>{fullName(item.createdBy)}</TableCell>
                        <TableCell>{item.note || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />ثبت پرداخت جدید</DialogTitle>
              <DialogDescription>بعد از تسویه کامل، ثبت پرداخت جدید برای این فاکتور بسته می‌شود.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitPayment} className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-medium">مبلغ پرداخت (تومان)</label>
                  <Input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">تاریخ پرداخت</label>
                  <PersianDatePicker value={paymentForm.paidAt} onChange={(value) => setPaymentForm((prev) => ({ ...prev, paidAt: value ?? '' }))} placeholder="تاریخ پرداخت" />
                </div>
                <div>
                  <label className="text-sm font-medium">توضیح (اختیاری)</label>
                  <Textarea value={paymentForm.note} onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)}>انصراف</Button>
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
          <CardTitle className="text-2xl font-extrabold">مدیریت فاکتورها</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            ثبت فاکتور
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder="جستجو: شماره فاکتور، سفارش، نام یا موبایل"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <SearchableSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value || 'all') as 'all' | 'UNPAID' | 'PARTIAL' | 'PAID');
                setPage(1);
              }}
              options={statusFilterOptions}
              placeholder="همه وضعیت‌ها"
              isSearchable={false}
            />
            <SearchableSelect
              value={payerFilter}
              onChange={(value) => {
                setPayerFilter((value || 'all') as 'all' | 'COLLABORATOR');
                setPage(1);
              }}
              options={payerFilterOptions}
              placeholder="همه پرداخت‌کننده‌ها"
              isSearchable={false}
            />
          </div>

          {filteredInvoices.length === 0 ? (
            <EmptyState title="فاکتوری ثبت نشده است" description="ابتدا یک فاکتور جدید ایجاد کنید." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead>سفارش‌ها</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>پرداخت‌کننده</TableHead>
                    <TableHead>سررسید</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((invoice, idx) => (
                    <TableRow key={invoice.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{textFa(invoice.title)}</TableCell>
                      <TableCell>{(invoice.orders ?? []).map((order) => order.orderNumber).join('، ') || '-'}</TableCell>
                      <TableCell>
                        <div>{money(invoice.paidAmount)} / {money(invoice.amount)}</div>
                        <div className="text-xs text-muted-foreground">تخفیف: {money(invoice.discountAmount)}</div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const payerInfo = getPayerInfo(invoice);
                          return (
                            <div className="space-y-0.5">
                              <div className="text-xs text-muted-foreground">{payerInfo.typeLabel}</div>
                              <div className="font-medium">{payerInfo.name || '-'}</div>
                              <div className="text-xs text-muted-foreground">{payerInfo.phone || '-'}</div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{shamsiDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>
                          {INVOICE_STATUS.find((item) => item.value === invoice.status)?.label || invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{shamsiDate(invoice.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void openInvoiceDetail(invoice.id)}>
                              <Eye className="h-4 w-4" />
                              جزئیات
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(invoice)}>ویرایش</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`)}>
                              <Download className="h-4 w-4" />
                              دانلود PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteInvoiceId(invoice.id)}>
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={filteredInvoices.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orderOptions={orderOptions}
        getPayerOptions={buildPayerOptions}
        onSubmit={async (payload) => {
          if (!payload.orderIds?.length) {
            toast.error('برای ثبت فاکتور، انتخاب حداقل یک سفارش الزامی است.');
            return;
          }
          await createInvoice(payload as Record<string, unknown>);
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>ویرایش فاکتور</DialogTitle>
            <DialogDescription>اطلاعات فاکتور را به‌روزرسانی کنید.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">عنوان فاکتور</label>
                <Input placeholder="عنوان فاکتور (اختیاری)" value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">تخفیف (تومان)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={editForm.discountAmount} onChange={(e) => setEditForm((prev) => ({ ...prev, discountAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">مبلغ کل فاکتور (تومان)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 2100000" value={editForm.amount} onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">تاریخ سررسید پرداخت</label>
                <PersianDatePicker value={editForm.dueDate} onChange={(value) => setEditForm((prev) => ({ ...prev, dueDate: value ?? '' }))} placeholder="تاریخ سررسید پرداخت" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">وضعیت فعلی</label>
                <Input value={INVOICE_STATUS.find((item) => item.value === editForm.status)?.label || editForm.status} disabled />
              </div>
            </div>
            <Textarea placeholder="توضیحات" value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>انصراف</Button>
              <Button type="submit">ذخیره تغییرات</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={Boolean(deleteInvoiceId)}
        onOpenChange={(open) => {
          if (!open) setDeleteInvoiceId(null);
        }}
        title="حذف فاکتور"
        description="آیا از حذف این فاکتور مطمئن هستید؟"
        onConfirm={async () => {
          if (!deleteInvoiceId) return;
          await removeInvoice(deleteInvoiceId);
          setDeleteInvoiceId(null);
        }}
      />
    </section>
  );
}
