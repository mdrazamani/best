import { FormEvent, useMemo, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
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

const PAGE_SIZE = 10;

export function OrdersPage() {
  const { customers, collaborators, meshTypes, orders, createOrder, updateOrder } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageOrderId, setStageOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    customerId: '',
    collaboratorId: '',
    workType: 'NEW_CONSTRUCTION',
    meshTypeId: '',
    totalPrice: '',
    description: ''
  });

  const [selectedStage, setSelectedStage] = useState('RECEIVED');

  const customerOptions = useMemo(
    () => customers.map((item) => ({ value: item.id, label: fullName(item) })),
    [customers]
  );
  const collaboratorOptions = useMemo(
    () => [{ value: '', label: 'بدون همکار' }, ...collaborators.map((item) => ({ value: item.id, label: fullName(item) }))],
    [collaborators]
  );
  const meshOptions = useMemo(
    () => meshTypes.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.title })),
    [meshTypes]
  );

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return orders.slice(start, start + PAGE_SIZE);
  }, [orders, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createOrder({
      customerId: form.customerId,
      collaboratorId: form.collaboratorId || null,
      workType: form.workType,
      meshTypeId: form.meshTypeId,
      totalPrice: Number(form.totalPrice || 0),
      description: form.description || undefined
    });
    setForm({ customerId: '', collaboratorId: '', workType: 'NEW_CONSTRUCTION', meshTypeId: '', totalPrice: '', description: '' });
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>مدیریت سفارشات</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                ثبت سفارش
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ثبت سفارش جدید</DialogTitle>
                <DialogDescription>اطلاعات سفارش را وارد کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <SearchableSelect options={customerOptions} value={form.customerId} onChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))} placeholder="انتخاب مشتری" />
                  <SearchableSelect options={collaboratorOptions} value={form.collaboratorId} onChange={(value) => setForm((prev) => ({ ...prev, collaboratorId: value }))} placeholder="انتخاب همکار" />
                  <SearchableSelect options={WORK_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={form.workType} onChange={(value) => setForm((prev) => ({ ...prev, workType: value }))} placeholder="نوع سفارش" />
                  <SearchableSelect options={meshOptions} value={form.meshTypeId} onChange={(value) => setForm((prev) => ({ ...prev, meshTypeId: value }))} placeholder="نوع توری" />
                  <Input placeholder="قیمت کل" value={form.totalPrice} onChange={(e) => setForm((prev) => ({ ...prev, totalPrice: e.target.value }))} />
                </div>
                <Textarea placeholder="توضیحات" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit">ذخیره سفارش</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
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
                    <TableHead>تاریخ</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((order, idx) => (
                    <TableRow key={order.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{fullName(order.customer)}</TableCell>
                      <TableCell>{fullName(order.collaborator || undefined)}</TableCell>
                      <TableCell>
                        {WORK_TYPES.find((item) => item.value === order.workType)?.label} / {order.meshType?.title || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ORDER_STAGES.find((item) => item.value === order.stage)?.label ?? order.stage}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{order.paymentSummary.percent}%</div>
                        <div className="font-medium">
                          {money(order.paymentSummary.paidAmount)} / {money(order.paymentSummary.total)}
                        </div>
                      </TableCell>
                      <TableCell>{shamsiDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openStageDialog(order.id, order.stage)}>
                              تغییر مرحله
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={orders.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
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
          <SearchableSelect
            options={ORDER_STAGES.map((item) => ({ value: item.value, label: item.label }))}
            value={selectedStage}
            onChange={setSelectedStage}
            placeholder="انتخاب مرحله"
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setStageOpen(false)}>
              انصراف
            </Button>
            <Button type="button" onClick={() => void saveStage()}>
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}