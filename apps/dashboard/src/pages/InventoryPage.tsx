import { FormEvent, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Boxes, History, MoreHorizontal, PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, shamsiDate } from '../lib/format';
import { InventoryItem } from '../types/models';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';

const PAGE_SIZE = 10;

const toInt = (value: string) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const logTypeLabel = (type: string) => (type === 'INCREASE' ? 'افزایش' : 'کاهش');

function InventoryAdjustDialog({
  item,
  open,
  onOpenChange
}: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adjustInventoryItem } = useBestContext();
  const [form, setForm] = useState({ type: 'INCREASE' as 'INCREASE' | 'DECREASE', amount: '', note: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    await adjustInventoryItem(item.id, {
      type: form.type,
      amount: Math.max(1, toInt(form.amount)),
      note: form.note || undefined
    });
    setForm({ type: 'INCREASE', amount: '', note: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>انبارگردانی {item?.name ?? ''}</DialogTitle>
          <DialogDescription>موجودی فعلی: {item?.quantity ?? 0} عدد. تغییرات این آیتم همان‌جا در لاگ ثبت می‌شود.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 rounded-2xl border bg-secondary/30 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.type === 'INCREASE' ? 'default' : 'outline'}
                onClick={() => setForm((prev) => ({ ...prev, type: 'INCREASE' }))}
                className="justify-center"
              >
                <ArrowUpCircle className="h-4 w-4" />
                افزایش
              </Button>
              <Button
                type="button"
                variant={form.type === 'DECREASE' ? 'destructive' : 'outline'}
                onClick={() => setForm((prev) => ({ ...prev, type: 'DECREASE' }))}
                className="justify-center"
              >
                <ArrowDownCircle className="h-4 w-4" />
                کاهش
              </Button>
            </div>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="تعداد"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
            <Textarea
              placeholder="یادداشت اختیاری"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                انصراف
              </Button>
              <Button type="submit">ثبت تغییر</Button>
            </DialogFooter>
          </div>
          <div className="max-h-[24rem] space-y-3 overflow-y-auto rounded-2xl border p-4">
            <div className="flex items-center gap-2 font-bold">
              <History className="h-4 w-4 text-primary" />
              لاگ تغییرات
            </div>
            {!item?.logs?.length ? (
              <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">هنوز تغییری ثبت نشده است.</div>
            ) : (
              item.logs.map((log) => (
                <div key={log.id} className="rounded-xl border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={log.type === 'INCREASE' ? 'success' : 'warning'}>{logTypeLabel(log.type)}</Badge>
                    <span className="text-xs text-muted-foreground">{shamsiDate(log.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {log.amount} عدد، از {log.beforeQty} به {log.afterQty}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">توسط {fullName(log.actor)}</div>
                  {log.note ? <div className="mt-2 rounded-lg bg-muted/50 px-2 py-1 text-xs">{log.note}</div> : null}
                </div>
              ))
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryPage() {
  const { inventoryItems, createInventoryItem, removeInventoryItem } = useBestContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: '', quantity: '' });

  const totalQuantity = useMemo(() => inventoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [inventoryItems]);
  const lowStockCount = useMemo(() => inventoryItems.filter((item) => item.quantity <= 5).length, [inventoryItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventoryItems.filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [inventoryItems, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page, totalPages]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    await createInventoryItem({
      name: form.name,
      quantity: toInt(form.quantity)
    });
    setForm({ name: '', quantity: '' });
    setCreateOpen(false);
  };

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustOpen(true);
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-extrabold">انبارداری</CardTitle>
            <CardDescription>ثبت ساده موجودی، انبارگردانی و مشاهده لاگ تغییرات هر آیتم.</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                افزودن آیتم
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>افزودن آیتم جدید</DialogTitle>
                <DialogDescription>نام کالا و تعداد اولیه را وارد کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitCreate} className="space-y-4">
                <Input placeholder="نام آیتم" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="تعداد اولیه"
                  value={form.quantity}
                  onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  required
                />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit">ثبت آیتم</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-10"
              placeholder="جستجو در نام آیتم‌ها"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState title="آیتمی در انبار ثبت نشده است" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>تعداد</TableHead>
                    <TableHead>آخرین تغییر</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[120px]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item) => {
                    const lastLog = item.logs?.[0];
                    return (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => openAdjust(item)}>
                        <TableCell>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-xs text-muted-foreground">ثبت توسط {fullName(item.createdBy)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.quantity <= 5 ? 'warning' : 'secondary'} className="text-sm">
                            {item.quantity} عدد
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lastLog ? (
                            <div className="space-y-1">
                              <Badge variant={lastLog.type === 'INCREASE' ? 'success' : 'warning'}>{logTypeLabel(lastLog.type)}</Badge>
                              <div className="text-xs text-muted-foreground">
                                {lastLog.amount} عدد توسط {fullName(lastLog.actor)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{shamsiDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); openAdjust(item); }}>
                              انبارگردانی
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="عملیات بیشتر" onClick={(event) => event.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void removeInventoryItem(item.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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

      <InventoryAdjustDialog
        item={selectedItem}
        open={adjustOpen}
        onOpenChange={(value) => {
          setAdjustOpen(value);
          if (!value) setSelectedItem(null);
        }}
      />
    </section>
  );
}
