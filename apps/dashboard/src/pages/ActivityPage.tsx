import { useMemo, useState } from 'react';
import { useBestContext } from '../contexts/best-context';
import { fullName, shamsiDate } from '../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';

const PAGE_SIZE = 12;

export function ActivityPage() {
  const { activity } = useBestContext();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return activity.slice(start, start + PAGE_SIZE);
  }, [activity, page, totalPages]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>لاگ عملیات</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
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
            <Pagination page={Math.min(page, totalPages)} total={activity.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}