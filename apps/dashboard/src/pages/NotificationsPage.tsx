import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useBestContext } from '../contexts/best-context';
import { shamsiDate, textFa } from '../lib/format';
import { EmptyState } from '../components/shared/empty-state';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { SearchableSelect } from '../components/ui/searchable-select';

export function NotificationsPage() {
  const { notifications, openNotificationTarget, acknowledgeNotification } = useBestContext();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const filteredNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((item) => {
      const matchesSearch =
        !q ||
        textFa(item.title).toLowerCase().includes(q) ||
        textFa(item.description).toLowerCase().includes(q) ||
        shamsiDate(item.dueDate).toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || item.level === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [notifications, search, levelFilter]);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">اعلان‌های سررسید</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-3">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو در اعلان‌ها" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <SearchableSelect
              value={levelFilter}
              onChange={(value) => setLevelFilter((value || 'all') as 'all' | 'critical' | 'warning')}
              options={[
                { value: 'all', label: 'همه اولویت‌ها' },
                { value: 'critical', label: 'فوری' },
                { value: 'warning', label: 'نزدیک' }
              ]}
              placeholder="انتخاب اولویت"
              isSearchable={false}
            />
          </div>

          {filteredNotifications.length === 0 ? (
            <EmptyState title="اعلان فعالی وجود ندارد" description="سررسید نزدیک برای فاکتور یا سفارش ثبت نشده است." />
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-300/70 bg-card p-4 dark:border-slate-700/80">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${item.level === 'critical' ? 'text-destructive' : 'text-amber-500'}`} />
                      <p className="font-semibold">{textFa(item.title)}</p>
                    </div>
                    <Badge variant={item.level === 'critical' ? 'destructive' : 'warning'}>
                      {item.level === 'critical' ? 'فوری' : 'نزدیک'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{textFa(item.description)}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    <span>{shamsiDate(item.dueDate)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openNotificationTarget(item)}>
                      رفتن به صفحه مربوطه
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => acknowledgeNotification(item.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                      خوانده‌ام
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
