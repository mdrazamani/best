import { Activity, CircleDollarSign, FileWarning, HandCoins, ReceiptText, ShoppingBag, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useBestContext } from '../contexts/best-context';
import { money } from '../lib/format';
import { LoadingTable } from '../components/shared/loading-table';

export function DashboardPage() {
  const { dashboard, loading } = useBestContext();

  if (!dashboard && loading) {
    return <LoadingTable rows={5} />;
  }

  if (!dashboard) {
    return null;
  }

  const items = [
    { label: 'کل سفارشات', value: dashboard.totalOrders, icon: ShoppingBag },
    { label: 'سفارشات امروز', value: dashboard.ordersToday, icon: Activity },
    { label: 'در حال انجام', value: dashboard.processingOrders, icon: Timer },
    { label: 'کل فروش', value: money(dashboard.totalSales), icon: CircleDollarSign },
    { label: 'دریافت شده', value: money(dashboard.receivedAmount), icon: HandCoins },
    { label: 'باقی مانده', value: money(dashboard.remainingAmount), icon: ReceiptText },
    { label: 'فاکتور پرداخت نشده', value: dashboard.unpaidInvoices, icon: FileWarning }
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-slate-200/80 bg-gradient-to-br from-card to-slate-50/60 dark:to-slate-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {item.label}
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-extrabold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}