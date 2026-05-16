import { FormEvent, useMemo, useState } from 'react';
import { Download, MoreHorizontal, Plus, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useBestContext } from '../contexts/best-context';
import { INVOICE_STATUS, fullName, invoiceStatusBadgeVariant, money, shamsiDate, textFa } from '../lib/format';
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

const emptyInvoiceForm = {
  title: '',
  orderId: '',
  amount: '',
  discountAmount: '',
  extraAmount: '',
  paidAmount: '',
  status: 'UNPAID',
  payerType: 'CUSTOMER',
  payerId: '',
  dueDate: '',
  description: ''
} as const;

type InvoiceFormState = {
  title: string;
  orderId: string;
  amount: string;
  discountAmount: string;
  extraAmount: string;
  paidAmount: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payerType: 'CUSTOMER' | 'COLLABORATOR';
  payerId: string;
  dueDate: string;
  description: string;
};

export function InvoicesPage() {
  const { orders, invoices, createInvoice, updateInvoice, removeInvoice, downloadProtected } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'UNPAID' | 'PARTIAL' | 'PAID'>('all');
  const [payerFilter, setPayerFilter] = useState<'all' | 'CUSTOMER' | 'COLLABORATOR'>('all');
  const [form, setForm] = useState<InvoiceFormState>({ ...emptyInvoiceForm });
  const [editForm, setEditForm] = useState<InvoiceFormState>({ ...emptyInvoiceForm });

  const selectedCreateOrder = useMemo(() => orders.find((item) => item.id === form.orderId), [orders, form.orderId]);
  const selectedEditOrder = useMemo(() => orders.find((item) => item.id === editForm.orderId), [orders, editForm.orderId]);

  const orderOptions = useMemo(
    () => orders.map((item) => ({ value: item.id, label: `${item.orderNumber} - ${item.customer ? `${item.customer.firstName ?? ''} ${item.customer.lastName ?? ''}` : ''}` })),
    [orders]
  );
  const editingOrderOptions = useMemo(
    () => (selectedEditOrder ? [{ value: selectedEditOrder.id, label: `${selectedEditOrder.orderNumber} - ${fullName(selectedEditOrder.customer)}` }] : []),
    [selectedEditOrder]
  );
  const statusFilterOptions = useMemo(() => [{ value: 'all', label: 'همه وضعیت‌ها' }, ...INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))], []);
  const payerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه پرداخت‌کننده‌ها' },
      { value: 'CUSTOMER', label: 'مشتری' },
      { value: 'COLLABORATOR', label: 'همکار' }
    ],
    []
  );

  const buildPayerOptions = (selectedOrder?: (typeof orders)[number]) => {
    if (!selectedOrder) return [];
    const options = [] as Array<{ value: string; label: string }>;

    if (selectedOrder.customer) {
      options.push({
        value: selectedOrder.customer.id,
        label: `مشتری: ${selectedOrder.customer.firstName ?? ''} ${selectedOrder.customer.lastName ?? ''}`
      });
    }

    if (selectedOrder.collaborator) {
      options.push({
        value: selectedOrder.collaborator.id,
        label: `همکار: ${selectedOrder.collaborator.firstName ?? ''} ${selectedOrder.collaborator.lastName ?? ''}`
      });
    }

    return options;
  };

  const createPayerOptions = useMemo(() => buildPayerOptions(selectedCreateOrder), [selectedCreateOrder]);
  const editPayerOptions = useMemo(() => buildPayerOptions(selectedEditOrder), [selectedEditOrder]);

  const getPayerInfo = (invoice: (typeof invoices)[number]) => {
    const payerType = invoice.payerType === 'COLLABORATOR' ? 'COLLABORATOR' : 'CUSTOMER';
    const typeLabel = payerType === 'COLLABORATOR' ? 'همکار' : 'مشتری';
    const payerRecord = payerType === 'COLLABORATOR' ? invoice.order?.collaborator : invoice.order?.customer;
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
      const orderNo = item.order.orderNumber.toLowerCase();
      const invoiceTitle = (item.title ?? '').toLowerCase();
      const orderTitle = (item.order?.title ?? '').toLowerCase();
      const customerPhone = (item.order?.customer?.phone ?? '').toLowerCase();
      const collaboratorPhone = (item.order?.collaborator?.phone ?? '').toLowerCase();
      const payerInfo = getPayerInfo(item);
      const matchesSearch =
        !q ||
        invoiceNo.includes(q) ||
        orderNo.includes(q) ||
        invoiceTitle.includes(q) ||
        orderTitle.includes(q) ||
        payerInfo.typeLabel.toLowerCase().includes(q) ||
        (payerInfo.name || '').toLowerCase().includes(q) ||
        payerInfo.phone.toLowerCase().includes(q) ||
        customerPhone.includes(q) ||
        collaboratorPhone.includes(q);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const effectivePayer = item.payerType ?? 'CUSTOMER';
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.orderId.trim()) {
      toast.error('برای ثبت فاکتور، انتخاب سفارش الزامی است.');
      return;
    }
    await createInvoice({
      title: form.title || undefined,
      orderId: form.orderId,
      amount: Number(form.amount || 0),
      discountAmount: Number(form.discountAmount || 0),
      extraAmount: Number(form.extraAmount || 0),
      paidAmount: Number(form.paidAmount || 0),
      status: form.status,
      payerType: form.payerType,
      payerId: form.payerId || undefined,
      dueDate: form.dueDate || undefined,
      description: form.description || undefined
    });

    setForm({ ...emptyInvoiceForm });
    setCreateOpen(false);
  };

  const openEdit = (invoice: (typeof invoices)[number]) => {
    const payerId = invoice.payerId ?? (invoice.payerType === 'COLLABORATOR' ? invoice.order?.collaborator?.id : invoice.order?.customer?.id) ?? '';
    setEditingInvoiceId(invoice.id);
    setEditForm({
      title: invoice.title ?? '',
      orderId: invoice.order.id,
      amount: String(Number(invoice.amount ?? 0)),
      discountAmount: String(Number(invoice.discountAmount ?? 0)),
      extraAmount: String(Number(invoice.extraAmount ?? 0)),
      paidAmount: String(Number(invoice.paidAmount ?? 0)),
      status: invoice.status,
      payerType: invoice.payerType ?? 'CUSTOMER',
      payerId,
      dueDate: invoice.dueDate ?? '',
      description: invoice.description ?? ''
    });
    setEditOpen(true);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingInvoiceId) return;
    if (!editForm.orderId.trim()) {
      toast.error('انتخاب سفارش الزامی است.');
      return;
    }

    await updateInvoice(editingInvoiceId, {
      title: editForm.title || undefined,
      amount: Number(editForm.amount || 0),
      discountAmount: Number(editForm.discountAmount || 0),
      extraAmount: Number(editForm.extraAmount || 0),
      paidAmount: Number(editForm.paidAmount || 0),
      status: editForm.status,
      payerType: editForm.payerType,
      payerId: editForm.payerId || undefined,
      dueDate: editForm.dueDate || undefined,
      description: editForm.description || undefined
    });

    setEditOpen(false);
    setEditingInvoiceId(null);
    setEditForm({ ...emptyInvoiceForm });
  };

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">مدیریت فاکتورها</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                ثبت فاکتور
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
              <DialogHeader>
                <DialogTitle>ثبت فاکتور جدید</DialogTitle>
                <DialogDescription>اطلاعات فاکتور را کامل کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">عنوان فاکتور</label>
                    <Input placeholder="عنوان فاکتور (اختیاری)" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">سفارش</label>
                    <SearchableSelect options={orderOptions} value={form.orderId} onChange={(value) => setForm((prev) => ({ ...prev, orderId: value }))} placeholder="انتخاب سفارش" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">وضعیت فاکتور</label>
                    <SearchableSelect options={INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))} value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value as InvoiceFormState['status'] }))} placeholder="وضعیت فاکتور" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">تخفیف (ریال)</label>
                    <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={form.discountAmount} onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">مبلغ کل فاکتور (ریال)</label>
                    <Input type="number" min="0" step="0.01" placeholder="مثال: 2100000" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">مالیات ارزش افزوده (ریال)</label>
                    <Input type="number" min="0" step="0.01" placeholder="مثال: 200000" value={form.extraAmount} onChange={(e) => setForm((prev) => ({ ...prev, extraAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">مبلغ پرداختی (ریال)</label>
                    <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={form.paidAmount} onChange={(e) => setForm((prev) => ({ ...prev, paidAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">نوع فاکتور</label>
                    <SearchableSelect
                      options={[
                        { value: 'CUSTOMER', label: 'نوع فاکتور: مشتری' },
                        { value: 'COLLABORATOR', label: 'نوع فاکتور: همکار' }
                      ]}
                      value={form.payerType}
                      onChange={(value) => setForm((prev) => ({ ...prev, payerType: value as InvoiceFormState['payerType'], payerId: '' }))}
                      placeholder="نوع فاکتور"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">پرداخت‌کننده</label>
                    <SearchableSelect options={createPayerOptions} value={form.payerId} onChange={(value) => setForm((prev) => ({ ...prev, payerId: value }))} placeholder="انتخاب شخص پرداخت‌کننده" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">تاریخ سررسید پرداخت</label>
                    <PersianDatePicker value={form.dueDate} onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value ?? '' }))} placeholder="تاریخ سررسید پرداخت" />
                  </div>
                </div>
                <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
                  <Button type="submit">ذخیره فاکتور</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder="جستجو: شماره فاکتور/سفارش، نام یا شماره تلفن مشتری/همکار"
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
                setPayerFilter((value || 'all') as 'all' | 'CUSTOMER' | 'COLLABORATOR');
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
                    <TableHead>شماره سفارش</TableHead>
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
                      <TableCell>{invoice.order.orderNumber}</TableCell>
                      <TableCell>
                        <div>{money(invoice.paidAmount)} / {money(invoice.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          افزوده: {money(invoice.extraAmount)} | تخفیف: {money(invoice.discountAmount)}
                        </div>
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
                            <DropdownMenuItem onClick={() => openEdit(invoice)}>ویرایش</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}>
                              <Download className="h-4 w-4" />
                              دانلود PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeInvoice(invoice.id)}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>ویرایش فاکتور</DialogTitle>
            <DialogDescription>اطلاعات فاکتور را به‌روز کنید.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">عنوان فاکتور</label>
                <Input placeholder="عنوان فاکتور (اختیاری)" value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">سفارش</label>
                <SearchableSelect options={editingOrderOptions} value={editForm.orderId} onChange={(value) => setEditForm((prev) => ({ ...prev, orderId: value }))} placeholder="سفارش" disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">وضعیت فاکتور</label>
                <SearchableSelect options={INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))} value={editForm.status} onChange={(value) => setEditForm((prev) => ({ ...prev, status: value as InvoiceFormState['status'] }))} placeholder="وضعیت فاکتور" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">تخفیف (ریال)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={editForm.discountAmount} onChange={(e) => setEditForm((prev) => ({ ...prev, discountAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">مبلغ کل فاکتور (ریال)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 2100000" value={editForm.amount} onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">مالیات ارزش افزوده (ریال)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 200000" value={editForm.extraAmount} onChange={(e) => setEditForm((prev) => ({ ...prev, extraAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">مبلغ پرداختی (ریال)</label>
                <Input type="number" min="0" step="0.01" placeholder="مثال: 100000" value={editForm.paidAmount} onChange={(e) => setEditForm((prev) => ({ ...prev, paidAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">نوع فاکتور</label>
                <SearchableSelect
                  options={[
                    { value: 'CUSTOMER', label: 'نوع فاکتور: مشتری' },
                    { value: 'COLLABORATOR', label: 'نوع فاکتور: همکار' }
                  ]}
                  value={editForm.payerType}
                  onChange={(value) => setEditForm((prev) => ({ ...prev, payerType: value as InvoiceFormState['payerType'], payerId: '' }))}
                  placeholder="نوع فاکتور"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">پرداخت‌کننده</label>
                <SearchableSelect options={editPayerOptions} value={editForm.payerId} onChange={(value) => setEditForm((prev) => ({ ...prev, payerId: value }))} placeholder="انتخاب شخص پرداخت‌کننده" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">تاریخ سررسید پرداخت</label>
                <PersianDatePicker value={editForm.dueDate} onChange={(value) => setEditForm((prev) => ({ ...prev, dueDate: value ?? '' }))} placeholder="تاریخ سررسید پرداخت" />
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
    </section>
  );
}
