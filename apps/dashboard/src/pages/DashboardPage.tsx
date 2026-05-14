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
    </section>
  );
}
