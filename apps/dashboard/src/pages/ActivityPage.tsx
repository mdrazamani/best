import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, shamsiDate } from '../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { Input } from '../components/ui/input';

const PAGE_SIZE = 12;

export function ActivityPage() {
  const { activity } = useBestContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredActivity = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activity.filter((item) => {
      const actor = fullName(item.actor).toLowerCase();
      const description = (item.description ?? '').toLowerCase();
      const entityType = item.entityType.toLowerCase();
      const action = item.action.toLowerCase();
      const matchesSearch = !q || actor.includes(q) || description.includes(q) || entityType.includes(q) || action.includes(q);
      const matchesEntity = entityFilter === 'all' || item.entityType === entityFilter;
      const matchesAction = actionFilter === 'all' || item.action === actionFilter;
      return matchesSearch && matchesEntity && matchesAction;
    });
  }, [activity, search, entityFilter, actionFilter]);

  const entityOptions = useMemo(() => Array.from(new Set(activity.map((item) => item.entityType))).sort(), [activity]);
  const actionOptions = useMemo(() => Array.from(new Set(activity.map((item) => item.action))).sort(), [activity]);

  const totalPages = Math.max(1, Math.ceil(filteredActivity.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredActivity.slice(start, start + PAGE_SIZE);
  }, [filteredActivity, page, totalPages]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">لاگ عملیات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pr-9" placeholder="جستجو: کاربر، نوع، عملیات، شرح" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">همه نوع‌ها</option>
            {entityOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">همه عملیات‌ها</option>
            {actionOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {filteredActivity.length === 0 ? (
          <EmptyState title="لاگی ثبت نشده است" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>زمان</TableHead>
                  <TableHead>کاربر</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>عملیات</TableHead>
                  <TableHead>شرح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item, idx) => (
                  <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                    <TableCell>{shamsiDate(item.createdAt)}</TableCell>
                    <TableCell>{fullName(item.actor)}</TableCell>
                    <TableCell>{item.entityType}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.description || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={Math.min(page, totalPages)} total={filteredActivity.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
