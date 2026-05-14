import { FormEvent, useMemo, useState } from 'react';
import { Download, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { INVOICE_STATUS, money, shamsiDate } from '../lib/format';
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

export function InvoicesPage() {
  const { orders, invoices, createInvoice, removeInvoice, downloadProtected } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'UNPAID' | 'PARTIAL' | 'PAID'>('all');
  const [payerFilter, setPayerFilter] = useState<'all' | 'CUSTOMER' | 'COLLABORATOR'>('all');
  const [form, setForm] = useState({
    orderId: '',
    amount: '',
    paidAmount: '',
    status: 'UNPAID',
    payerType: 'CUSTOMER',
    payerId: '',
    dueDate: '',
    description: ''
  });

  const selectedOrder = useMemo(() => orders.find((item) => item.id === form.orderId), [orders, form.orderId]);

  const orderOptions = useMemo(() => orders.map((item) => ({ value: item.id, label: `${item.orderNumber} - ${item.customer ? `${item.customer.firstName ?? ''} ${item.customer.lastName ?? ''}` : ''}` })), [orders]);
  const statusFilterOptions = useMemo(() => [{ value: 'all', label: 'همه وضعیت‌ها' }, ...INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))], []);
  const payerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه پرداخت‌کننده‌ها' },
      { value: 'CUSTOMER', label: 'مشتری' },
      { value: 'COLLABORATOR', label: 'همکار' }
    ],
    []
  );

  const payerOptions = useMemo(() => {
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
  }, [selectedOrder]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((item) => {
      const invoiceNo = item.invoiceNumber.toLowerCase();
      const orderNo = item.order.orderNumber.toLowerCase();
      const matchesSearch = !q || invoiceNo.includes(q) || orderNo.includes(q);
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
    await createInvoice({
      orderId: form.orderId,
      amount: Number(form.amount || 0),
      paidAmount: Number(form.paidAmount || 0),
      status: form.status,
      payerType: form.payerType,
      payerId: form.payerId || undefined,
      dueDate: form.dueDate || undefined,
      description: form.description || undefined
    });

    setForm({ orderId: '', amount: '', paidAmount: '', status: 'UNPAID', payerType: 'CUSTOMER', payerId: '', dueDate: '', description: '' });
    setCreateOpen(false);
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
                  <SearchableSelect options={orderOptions} value={form.orderId} onChange={(value) => setForm((prev) => ({ ...prev, orderId: value }))} placeholder="انتخاب سفارش" />
                  <SearchableSelect options={INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))} value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} placeholder="وضعیت فاکتور" />
                  <Input placeholder="مبلغ کل" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
                  <Input placeholder="مبلغ پرداختی" value={form.paidAmount} onChange={(e) => setForm((prev) => ({ ...prev, paidAmount: e.target.value }))} />
                  <SearchableSelect
                    options={[
                      { value: 'CUSTOMER', label: 'پرداخت‌کننده: مشتری' },
                      { value: 'COLLABORATOR', label: 'پرداخت‌کننده: همکار' }
                    ]}
                    value={form.payerType}
                    onChange={(value) => setForm((prev) => ({ ...prev, payerType: value, payerId: '' }))}
                    placeholder="نوع پرداخت‌کننده"
                  />
                  <SearchableSelect options={payerOptions} value={form.payerId} onChange={(value) => setForm((prev) => ({ ...prev, payerId: value }))} placeholder="انتخاب شخص پرداخت‌کننده" />
                  <div className="md:col-span-2">
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
              <Input className="pr-9" placeholder="جستجو: شماره فاکتور یا سفارش" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={statusFilter}
              onChange={(value) => { setStatusFilter((value || 'all') as 'all' | 'UNPAID' | 'PARTIAL' | 'PAID'); setPage(1); }}
              options={statusFilterOptions}
              placeholder="همه وضعیت‌ها"
              isSearchable={false}
            />
            <SearchableSelect
              value={payerFilter}
              onChange={(value) => { setPayerFilter((value || 'all') as 'all' | 'CUSTOMER' | 'COLLABORATOR'); setPage(1); }}
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
                      <TableCell>{invoice.order.orderNumber}</TableCell>
                      <TableCell>{money(invoice.paidAmount)} / {money(invoice.amount)}</TableCell>
                      <TableCell>{invoice.payerType === 'COLLABORATOR' ? 'همکار' : 'مشتری'}</TableCell>
                      <TableCell>{shamsiDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'PARTIAL' ? 'warning' : 'outline'}>
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
                            <DropdownMenuItem onClick={() => void downloadProtected(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}>
                              <Download className="ml-2 h-4 w-4" />
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
    </section>
  );
}
