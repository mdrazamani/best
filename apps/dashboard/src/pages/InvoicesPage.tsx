import { FormEvent, useMemo, useState } from 'react';
import { Download, MoreHorizontal, Plus } from 'lucide-react';
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

const PAGE_SIZE = 10;

export function InvoicesPage() {
  const { orders, invoices, createInvoice, downloadProtected } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ orderId: '', amount: '', paidAmount: '', status: 'UNPAID', description: '' });

  const orderOptions = useMemo(
    () => orders.map((item) => ({ value: item.id, label: `${item.orderNumber}` })),
    [orders]
  );

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return invoices.slice(start, start + PAGE_SIZE);
  }, [invoices, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createInvoice({
      orderId: form.orderId,
      amount: Number(form.amount || 0),
      paidAmount: Number(form.paidAmount || 0),
      status: form.status,
      description: form.description || undefined
    });
    setForm({ orderId: '', amount: '', paidAmount: '', status: 'UNPAID', description: '' });
    setCreateOpen(false);
  };

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>مدیریت فاکتورها</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                ثبت فاکتور
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ثبت فاکتور جدید</DialogTitle>
                <DialogDescription>اطلاعات فاکتور را کامل کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <SearchableSelect options={orderOptions} value={form.orderId} onChange={(value) => setForm((prev) => ({ ...prev, orderId: value }))} placeholder="انتخاب سفارش" />
                  <SearchableSelect options={INVOICE_STATUS.map((item) => ({ value: item.value, label: item.label }))} value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} placeholder="وضعیت فاکتور" />
                  <Input placeholder="مبلغ" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
                  <Input placeholder="مبلغ پرداختی" value={form.paidAmount} onChange={(e) => setForm((prev) => ({ ...prev, paidAmount: e.target.value }))} />
                </div>
                <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit">ذخیره فاکتور</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState title="فاکتوری ثبت نشده است" description="ابتدا یک فاکتور جدید ایجاد کنید." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>مبلغ</TableHead>
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
                      <TableCell>
                        {money(invoice.paidAmount)} / {money(invoice.amount)}
                      </TableCell>
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={invoices.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}