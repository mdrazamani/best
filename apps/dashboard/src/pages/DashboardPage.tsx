import { useMemo } from 'react';
import { Activity, CircleDollarSign, FileWarning, HandCoins, ReceiptText, ShoppingBag, Timer } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LoadingTable } from '../components/shared/loading-table';
import { useBestContext } from '../contexts/best-context';
import { fullName, invoiceStatusLabel, money, orderStageLabel, shamsiDate } from '../lib/format';

export function DashboardPage() {
  const { dashboard, loading, orders, invoices, openOrderDetail, navigateToTab } = useBestContext();

  const latestOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [orders]
  );

  const latestInvoices = useMemo(
    () => [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [invoices]
  );

  if (!dashboard && loading) {
    return <LoadingTable rows={5} />;
  }

  if (!dashboard) {
    return null;
  }

  const statItems = [
    { label: 'کل سفارشات', value: dashboard.totalOrders, icon: ShoppingBag },
    { label: 'سفارشات امروز', value: dashboard.ordersToday, icon: Activity },
    { label: 'در حال انجام', value: dashboard.processingOrders, icon: Timer },
    { label: 'کل فروش', value: money(dashboard.totalSales), icon: CircleDollarSign },
    { label: 'دریافت شده', value: money(dashboard.receivedAmount), icon: HandCoins },
    { label: 'باقی مانده', value: money(dashboard.remainingAmount), icon: ReceiptText },
    { label: 'فاکتور پرداخت نشده', value: dashboard.unpaidInvoices, icon: FileWarning }
  ];

  const orderBadgeVariant = (stage?: string): 'secondary' | 'warning' | 'success' | 'destructive' => {
    if (stage === 'CANCELLED') return 'destructive';
    if (stage === 'DELIVERED') return 'success';
    if (stage === 'IN_PROGRESS' || stage === 'STARTED') return 'warning';
    return 'secondary';
  };

  const invoiceBadgeVariant = (status?: string): 'success' | 'warning' | 'outline' => {
    if (status === 'PAID') return 'success';
    if (status === 'PARTIAL') return 'warning';
    return 'outline';
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="group border-slate-300/70 bg-gradient-to-br from-card via-slate-50/75 to-slate-100/80 hover:-translate-y-0.5 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  {item.label}
                  <span className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary/20">
                    <Icon className="h-4 w-4" />
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[1.65rem] font-extrabold tracking-tight">{item.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-300/70 bg-gradient-to-b from-card to-slate-50/60 dark:from-slate-900 dark:to-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">آخرین سفارش‌ها</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigateToTab('orders')}>
              مشاهده همه
            </Button>
          </CardHeader>
          <CardContent>
            {latestOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
            ) : (
              <div className="divide-y rounded-lg border border-slate-200/80 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/50">
                {latestOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="flex w-full flex-col gap-2 p-3 text-right transition-colors hover:bg-primary/5"
                    onClick={() => {
                      void openOrderDetail(order.id);
                      navigateToTab('orders');
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-primary">{order.orderNumber}</p>
                      <Badge variant={orderBadgeVariant(order.stage)}>{orderStageLabel(order.stage)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fullName(order.customer)} • {shamsiDate(order.createdAt)}</p>
                    <p className="text-sm font-semibold">
                      {money(Number(order.paymentSummary?.paidAmount ?? 0))} / {money(Number(order.paymentSummary?.total ?? 0))}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-300/70 bg-gradient-to-b from-card to-slate-50/60 dark:from-slate-900 dark:to-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">آخرین فاکتورها</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigateToTab('invoices')}>
              مشاهده همه
            </Button>
          </CardHeader>
          <CardContent>
            {latestInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز فاکتوری ثبت نشده است.</p>
            ) : (
              <div className="divide-y rounded-lg border border-slate-200/80 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/50">
                {latestInvoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className="flex w-full flex-col gap-2 p-3 text-right transition-colors hover:bg-primary/5"
                    onClick={() => {
                      void openOrderDetail(invoice.order.id);
                      navigateToTab('orders');
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-primary">{invoice.invoiceNumber}</p>
                      <Badge variant={invoiceBadgeVariant(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">سفارش {invoice.order.orderNumber} • {shamsiDate(invoice.createdAt)}</p>
                    <p className="text-sm font-semibold">{money(Number(invoice.paidAmount ?? 0))} / {money(Number(invoice.amount ?? 0))}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
