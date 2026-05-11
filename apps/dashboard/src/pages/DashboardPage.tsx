import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';
import { money } from '../lib/format';

export function DashboardPage() {
  const { dashboard } = useBestContext();
  if (!dashboard) return null;

  const items = [
    ['کل سفارشات', dashboard.totalOrders],
    ['سفارشات امروز', dashboard.ordersToday],
    ['در حال انجام', dashboard.processingOrders],
    ['مبلغ کل فروش', money(dashboard.totalSales)],
    ['دریافت شده', money(dashboard.receivedAmount)],
    ['باقی‌مانده', money(dashboard.remainingAmount)],
    ['فاکتور پرداخت نشده', dashboard.unpaidInvoices]
  ];

  return (
    <section className="stats-grid">
      {items.map(([label, value]) => (
        <Panel key={String(label)}>
          <div className="stat">
            <span>{label}</span>
            <strong>{value as any}</strong>
          </div>
        </Panel>
      ))}
    </section>
  );
}
