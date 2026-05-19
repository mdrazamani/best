import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Eye, FileText, MoreHorizontal, Plus, Search, Trash2, User, Users } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, invoiceStatusBadgeVariant, invoiceStatusLabel, money, orderStageBadgeVariant, orderStageLabel, shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Badge } from '../components/ui/badge';
import { CreateCustomerDialog } from '../components/modals/CreateCustomerDialog';

const PAGE_SIZE = 10;
const ORDER_STAGE_OPTIONS = [
  { value: 'RECEIVED', label: 'دریافت شده' },
  { value: 'IN_PROGRESS', label: 'در حال انجام' },
  { value: 'READY_IN_WAREHOUSE', label: 'آماده در انبار' },
  { value: 'DELIVERED', label: 'تحویل داده شده' },
  { value: 'CANCELLED', label: 'لغو شده' }
] as const;
export function CustomersPage() {
  const {
    customers,
    collaborators,
    customerDetail,
    createCustomer,
    removeCustomer,
    openCustomerDetail,
    closeCustomerDetail,
    openCollaboratorDetail,
    openOrderDetail,
    updateOrder,
    navigateToTab
  } = useBestContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'with_referrer' | 'without_referrer'>('all');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const collaboratorOptions = useMemo(
    () => [{ value: '', label: 'بدون معرف' }, ...collaborators.map((item) => ({ value: item.id, label: fullName(item) }))],
    [collaborators]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((item) => {
      const name = fullName(item).toLowerCase();
      const phone = (item.phone ?? '').toLowerCase();
      const referrer = fullName(item.referredByCollaborator ?? undefined).toLowerCase();
      const matchesSearch = !q || name.includes(q) || phone.includes(q) || referrer.includes(q);
      const hasReferrer = Boolean(item.referredByCollaborator);
      const matchesRef = referralFilter === 'all' || (referralFilter === 'with_referrer' ? hasReferrer : !hasReferrer);
      return matchesSearch && matchesRef;
    });
  }, [customers, search, referralFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page, totalPages]);

  const showDetail = async (id: string) => {
    await openCustomerDetail(id);
  };

  const detail = customerDetail;
  const detailId = detail?.id as string | undefined;

  const saveOrderStage = async (orderId: string, nextStage: string) => {
    if (!detailId) return;
    setSavingOrderId(orderId);
    try {
      await updateOrder(orderId, { stage: nextStage });
      await openCustomerDetail(detailId);
    } finally {
      setSavingOrderId(null);
    }
  };

  if (detail) {
    const orders = Array.isArray(detail.orders) ? detail.orders : [];
    const invoices = Array.isArray(detail.invoices) ? detail.invoices : [];
    const collaboratorsInDetail = Array.isArray(detail.collaborators) ? detail.collaborators : [];

    return (
      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-extrabold">
                <User className="h-6 w-6 text-muted-foreground" />
                جزئیات مشتری
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{fullName(detail)} - تاریخ ثبت: {shamsiDate(detail.createdAt)}</p>
              <p className="text-[11px] text-muted-foreground sm:text-xs">تمام مبالغ در این صفحه به تومان هستند.</p>
            </div>
            <Button variant="outline" onClick={closeCustomerDetail}>
              <ArrowRight className="h-4 w-4" />
              بازگشت به لیست
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تعداد سفارش‌ها</p>
                <p className="mt-1 text-lg font-bold">{detail.summary?.totalOrders ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مجموع مبلغ فاکتورها</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalOrderAmount ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ فاکتورهای مشتری</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalInvoiced ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مبلغ پرداخت‌شده</p>
                <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalPaid ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مانده</p>
                <p className="mt-1 text-lg font-bold text-destructive">{money(detail.summary?.totalRemaining ?? 0)}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-semibold">موبایل:</span> {detail.phone || '-'}</p>
              <p><span className="font-semibold">آدرس:</span> {detail.address || '-'}</p>
              <p><span className="font-semibold">معرف:</span> {fullName(detail.referredByCollaborator || undefined)}</p>
              <p><span className="font-semibold">توضیحات:</span> {detail.description || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              سفارشات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <EmptyState title="هنوز سفارشی برای این مشتری ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>همکار</TableHead>
                    <TableHead>مرحله</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead>بروزرسانی مرحله</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any, idx: number) => (
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
                        {order.collaborator?.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openCollaboratorDetail(order.collaborator.id);
                              navigateToTab('collaborators');
                            }}
                          >
                            {fullName(order.collaborator)}
                          </button>
                        ) : fullName(order.collaborator)}
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
                                void saveOrderStage(order.id, value);
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <FileText className="h-5 w-5 text-muted-foreground" />
              فاکتورهای مشتری
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyState title="هنوز فاکتوری برای این مشتری ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره فاکتور</TableHead>
                    <TableHead>شماره سفارش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>پرداختی / کل</TableHead>
                    <TableHead>سررسید</TableHead>
                    <TableHead>مانده</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: any, idx: number) => (
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
                      <TableCell>{money(Math.max(Number(invoice.amount ?? 0) - Number(invoice.paidAmount ?? 0), 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Users className="h-5 w-5 text-muted-foreground" />
              همکاران مرتبط
            </CardTitle>
          </CardHeader>
          <CardContent>
            {collaboratorsInDetail.length === 0 ? (
              <EmptyState title="هیچ همکاری برای این مشتری ثبت نشده است" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>شماره تماس</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaboratorsInDetail.map((collab: any, idx: number) => (
                    <TableRow key={collab.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>
                        {collab.id ? (
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => {
                              void openCollaboratorDetail(collab.id);
                              navigateToTab('collaborators');
                            }}
                          >
                            {fullName(collab)}
                          </button>
                        ) : fullName(collab)}
                      </TableCell>
                      <TableCell>{collab.phone ?? '-'}</TableCell>
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
    <section>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">مشتریان</CardTitle>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            ثبت مشتری
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو در نام، موبایل، معرف" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={referralFilter}
              onChange={(value) => { setReferralFilter(value as 'all' | 'with_referrer' | 'without_referrer'); setPage(1); }}
              options={[
                { value: 'all', label: 'همه مشتریان' },
                { value: 'with_referrer', label: 'دارای معرف' },
                { value: 'without_referrer', label: 'بدون معرف' }
              ]}
              placeholder="فیلتر معرف"
              isSearchable={false}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState title="مشتری‌ای پیدا نشد" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>موبایل</TableHead>
                    <TableHead>معرف</TableHead>
                    <TableHead>تعداد سفارش</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => (
                    <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => void showDetail(item.id)}>
                          {fullName(item)}
                        </button>
                      </TableCell>
                      <TableCell>{item.phone || '-'}</TableCell>
                      <TableCell>{fullName(item.referredByCollaborator || undefined)}</TableCell>
                      <TableCell>{item._count?.orders || 0}</TableCell>
                      <TableCell>{shamsiDate(item.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void showDetail(item.id)}>
                              <Eye className="h-4 w-4" />
                              مشاهده
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeCustomer(item.id)}>
                              <Trash2 className="h-4 w-4" />
                              حذف 
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={filteredItems.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <CreateCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        referrerOptions={collaboratorOptions.filter((item) => item.value)}
        onSubmit={async (payload) => {
          await createCustomer(payload as Record<string, unknown>);
        }}
      />
    </section>
  );
}


