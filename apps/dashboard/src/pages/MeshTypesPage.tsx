import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { money, shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/shared/empty-state';
import { ConfirmActionDialog } from '../components/shared/confirm-action-dialog';
import { Pagination } from '../components/shared/pagination';
import { Badge } from '../components/ui/badge';
import { SearchableSelect } from '../components/ui/searchable-select';

const PAGE_SIZE = 10;

const toNumber = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePriceInput = (value: number) => {
  const safe = Math.max(value, 0);
  return Number.isFinite(safe) ? String(safe) : '0';
};

export function MeshTypesPage() {
  const { meshTypes, createMeshType, updateMeshType, removeMeshType } = useBestContext();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteMeshTypeId, setDeleteMeshTypeId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ title: '', description: '', unitPrice: '', isDefault: false });

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه وضعیت‌ها' },
      { value: 'active', label: 'فعال' },
      { value: 'inactive', label: 'غیرفعال' }
    ],
    []
  );

  const filteredMeshTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meshTypes.filter((item) => {
      const matchesSearch = !q || item.title.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [meshTypes, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMeshTypes.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredMeshTypes.slice(start, start + PAGE_SIZE);
  }, [filteredMeshTypes, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createMeshType({
      title: form.title,
      description: form.description || undefined,
      isActive: true,
      unitPrice: toNumber(form.unitPrice),
      isDefault: form.isDefault
    });
    setForm({ title: '', description: '', unitPrice: '', isDefault: false });
    setOpen(false);
  };

  const commitUnitPrice = async (meshTypeId: string, currentUnitPrice: number) => {
    const draft = priceDrafts[meshTypeId];
    if (draft === undefined) return;

    const nextValue = toNumber(draft);
    if (nextValue === Number(currentUnitPrice ?? 0)) {
      setPriceDrafts((prev) => ({ ...prev, [meshTypeId]: normalizePriceInput(nextValue) }));
      return;
    }

    setSavingId(meshTypeId);
    try {
      await updateMeshType(meshTypeId, { unitPrice: nextValue });
      setPriceDrafts((prev) => ({ ...prev, [meshTypeId]: normalizePriceInput(nextValue) }));
    } finally {
      setSavingId(null);
    }
  };

  const makeDefault = async (meshTypeId: string) => {
    setSavingId(meshTypeId);
    try {
      await updateMeshType(meshTypeId, { isDefault: true, isActive: true });
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (meshTypeId: string, nextValue: boolean) => {
    setSavingId(meshTypeId);
    try {
      await updateMeshType(meshTypeId, { isActive: nextValue });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">نوع توری</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                نوع توری جدید
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تعریف نوع توری</DialogTitle>
                <DialogDescription>عنوان، قیمت واحد (تومان) و وضعیت پیش‌فرض را مشخص کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <Input placeholder="عنوان" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                <Input type="number" min="0" step="0.01" placeholder="قیمت واحد (تومان)" value={form.unitPrice} onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))} />
                <Textarea placeholder="توضیح" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
                  پیش‌فرض باشد
                </label>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>انصراف</Button>
                  <Button type="submit">ثبت</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Input className="pr-3" placeholder="جستجو بر اساس عنوان یا توضیح" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value || 'all') as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
              options={statusFilterOptions}
              placeholder="همه وضعیت‌ها"
              isSearchable={false}
            />
          </div>

          {filteredMeshTypes.length === 0 ? (
            <EmptyState title="نوع توری ثبت نشده است" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>عنوان</TableHead>
                    <TableHead>قیمت واحد</TableHead>
                    <TableHead>پیش‌فرض</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => {
                    const priceDraft = priceDrafts[item.id] ?? String(Number(item.unitPrice ?? 0));
                    const isSavingRow = savingId === item.id;

                    return (
                      <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                        <TableCell className="font-medium">
                          <div>{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.description || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[220px]">
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={priceDraft}
                                className="pl-16"
                                disabled={isSavingRow}
                                onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                onBlur={() => void commitUnitPrice(item.id, Number(item.unitPrice ?? 0))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void commitUnitPrice(item.id, Number(item.unitPrice ?? 0));
                                  }
                                }}
                              />
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">تومان</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">ذخیره خودکار با خروج از فیلد یا Enter</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.isDefault ? (
                            <Badge variant="success" className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              پیش‌فرض فعلی
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" disabled={isSavingRow} onClick={() => void makeDefault(item.id)}>
                              تنظیم به پیش‌فرض
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.isActive}
                              onChange={(e) => void toggleActive(item.id, e.target.checked)}
                              disabled={isSavingRow}
                            />
                            <Badge variant={item.isActive ? 'success' : 'outline'}>{item.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                          </label>
                        </TableCell>
                        <TableCell>{shamsiDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteMeshTypeId(item.id)}>
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
              <Pagination page={Math.min(page, totalPages)} total={filteredMeshTypes.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={Boolean(deleteMeshTypeId)}
        onOpenChange={(open) => {
          if (!open) setDeleteMeshTypeId(null);
        }}
        title="حذف نوع توری"
        description="آیا از حذف این نوع توری مطمئن هستید؟"
        onConfirm={async () => {
          if (!deleteMeshTypeId) return;
          await removeMeshType(deleteMeshTypeId);
          setDeleteMeshTypeId(null);
        }}
      />
    </section>
  );
}
