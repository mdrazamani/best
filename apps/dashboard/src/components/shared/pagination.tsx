import { Button } from '../ui/button';

export function Pagination({
  page,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

  return (
    <div className="flex items-center justify-between gap-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">
        صفحه {page} از {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
          قبلی
        </Button>
        {pages.map((p) => (
          <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(p)}>
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
          بعدی
        </Button>
      </div>
    </div>
  );
}