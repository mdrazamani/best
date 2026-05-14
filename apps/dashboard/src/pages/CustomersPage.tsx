import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Eye, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, invoiceStatusLabel, money, orderStageLabel, shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Badge } from '../components/ui/badge';

const PAGE_SIZE = 10;

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
    navigateToTab
  } = useBestContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'with_referrer' | 'without_referrer'>('all');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', address: '', description: '', referredByCollaboratorId: '' });

  const collaboratorOptions = useMemo(
    () => [{ value: '', label: '???? ????' }, ...collaborators.map((item) => ({ value: item.id, label: fullName(item) }))],
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createCustomer({ ...form, referredByCollaboratorId: form.referredByCollaboratorId || undefined });
    setForm({ firstName: '', lastName: '', phone: '', address: '', description: '', referredByCollaboratorId: '' });
    setCreateOpen(false);
  };

  const showDetail = async (id: string) => {
    await openCustomerDetail(id);
  };

  const detail = customerDetail;

  if (detail) {
    const orders = Array.isArray(detail.orders) ? detail.orders : [];
    const invoices = Array.isArray(detail.invoices) ? detail.invoices : [];
    const collaboratorsInDetail = Array.isArray(detail.collaborators) ? detail.collaborators : [];

    return (
      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-extrabold">?????? ?????</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{fullName(detail)} - ????? ???: {shamsiDate(detail.createdAt)}</p>
            </div>
            <Button variant="outline" onClick={closeCustomerDetail}>
              <ArrowRight className="h-4 w-4" />
              ?????? ?? ????
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">?? ???????</p>
              <p className="mt-1 text-lg font-bold">{detail.summary?.totalOrders ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">????? ?????? ?????</p>
              <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalInvoiced ?? 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">??? ???????</p>
              <p className="mt-1 text-lg font-bold">{money(detail.summary?.totalPaid ?? 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">???? ?????????</p>
              <p className="mt-1 text-lg font-bold text-destructive">{money(detail.summary?.totalRemaining ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">????????</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <EmptyState title="?????? ???? ??? ????? ??? ???? ???" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>????? ?????</TableHead>
                    <TableHead>?????</TableHead>
                    <TableHead>?????</TableHead>
                    <TableHead>????</TableHead>
                    <TableHead>????? ???</TableHead>
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
                      <TableCell>{orderStageLabel(order.stage)}</TableCell>
                      <TableCell>{money(Number(order.totalPrice ?? 0))}</TableCell>
                      <TableCell>{shamsiDate(order.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">????????? ?????</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyState title="??????? ???? ??? ????? ??? ???? ???" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>????? ??????</TableHead>
                    <TableHead>????? ?????</TableHead>
                    <TableHead>?????</TableHead>
                    <TableHead>??????? / ??</TableHead>
                    <TableHead>??????</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: any, idx: number) => (
                    <TableRow key={invoice.id ?? idx} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{invoice.invoiceNumber ?? '-'}</TableCell>
                      <TableCell>
                        {invoice.order?.id ? (
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
                        ) : (invoice.order?.orderNumber ?? '-')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'PARTIAL' ? 'warning' : 'outline'}>{invoiceStatusLabel(invoice.status)}</Badge>
                      </TableCell>
                      <TableCell>{money(Number(invoice.paidAmount ?? 0))} / {money(Number(invoice.amount ?? 0))}</TableCell>
                      <TableCell>{shamsiDate(invoice.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">???????? ?????</CardTitle>
          </CardHeader>
          <CardContent>
            {collaboratorsInDetail.length === 0 ? (
              <EmptyState title="????? ?????? ???? ?????" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>???</TableHead>
                    <TableHead>????? ????</TableHead>
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
          <CardTitle className="text-2xl font-extrabold">???????</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                ????? ????
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>??? ?????</DialogTitle>
                <DialogDescription>??????? ????? ?? ???? ????.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input placeholder="???" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                  <Input placeholder="??? ????????" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                  <Input placeholder="?????" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  <Input placeholder="????" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
                  <SearchableSelect className="md:col-span-2" options={collaboratorOptions} value={form.referredByCollaboratorId} onChange={(value) => setForm((prev) => ({ ...prev, referredByCollaboratorId: value }))} placeholder="???? (?????)" />
                </div>
                <Textarea placeholder="???????" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>??????</Button>
                  <Button type="submit">???</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="????? ?? ???? ???? ????? ?? ????" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={referralFilter}
              onChange={(value) => { setReferralFilter(value as 'all' | 'with_referrer' | 'without_referrer'); setPage(1); }}
              options={[
                { value: 'all', label: '??? ????????' },
                { value: 'with_referrer', label: '????? ????' },
                { value: 'without_referrer', label: '???? ????' }
              ]}
              placeholder="????? ????"
              isSearchable={false}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState title="????? ???? ???" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>???</TableHead>
                    <TableHead>?????</TableHead>
                    <TableHead>????</TableHead>
                    <TableHead>????? ?????</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => (
                    <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{fullName(item)}</TableCell>
                      <TableCell>{item.phone || '-'}</TableCell>
                      <TableCell>{fullName(item.referredByCollaborator || undefined)}</TableCell>
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
                              ??????
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeCustomer(item.id)}>
                              <Trash2 className="ml-2 h-4 w-4" />
                              ??? (???)
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
    </section>
  );
}
