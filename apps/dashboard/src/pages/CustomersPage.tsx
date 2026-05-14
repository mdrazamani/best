import { FormEvent, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Plus } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, money } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';

const PAGE_SIZE = 10;

export function CustomersPage() {
  const { customers, customerDetail, createCustomer, loadCustomerDetail } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', address: '', description: '' });

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return customers.slice(start, start + PAGE_SIZE);
  }, [customers, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createCustomer(form);
    setForm({ firstName: '', lastName: '', phone: '', address: '', description: '' });
    setCreateOpen(false);
  };

  const showDetail = async (id: string) => {
    await loadCustomerDetail(id);
    setDetailOpen(true);
  };

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>مشتریان</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                مشتری جدید
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ثبت مشتری</DialogTitle>
                <DialogDescription>اطلاعات مشتری را وارد کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input placeholder="نام" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                  <Input placeholder="نام خانوادگی" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                  <Input placeholder="شماره" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  <Input placeholder="آدرس" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit">ثبت</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <EmptyState title="مشتری ثبت نشده است" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>شماره</TableHead>
                    <TableHead>تعداد سفارش</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => (
                    <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{fullName(item)}</TableCell>
                      <TableCell>{item.phone || '-'}</TableCell>
                      <TableCell>{item._count?.orders || 0}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void showDetail(item.id)}>
                              <Eye className="ml-2 h-4 w-4" />
                              مشاهده
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={customers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>جزئیات مشتری</DialogTitle>
          </DialogHeader>
          {customerDetail ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{fullName(customerDetail)}</p>
              <p>جمع سفارشات: {money(customerDetail.summary.totalOrderAmount)}</p>
              <p>مبلغ دریافت شده: {money(customerDetail.summary.totalReceived)}</p>
              <p>طلب باقی مانده: {money(customerDetail.summary.totalRemaining)}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}