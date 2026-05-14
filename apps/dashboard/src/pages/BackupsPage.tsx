import { useEffect, useMemo, useState } from 'react';
import { Download, MoreHorizontal, Play, Save } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { shamsiDate } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const PAGE_SIZE = 8;

export function BackupsPage() {
  const { backups, backupInterval, updateBackupSettings, runBackup, downloadProtected } = useBestContext();
  const [intervalInput, setIntervalInput] = useState(String(backupInterval));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setIntervalInput(String(backupInterval));
  }, [backupInterval]);

  const totalPages = Math.max(1, Math.ceil(backups.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return backups.slice(start, start + PAGE_SIZE);
  }, [backups, page, totalPages]);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>تنظیمات بکاپ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input value={intervalInput} onChange={(e) => setIntervalInput(e.target.value)} placeholder="دقیقه" className="md:w-56" />
          <Button variant="secondary" onClick={() => void updateBackupSettings(Number(intervalInput || 1440))}>
            <Save className="h-4 w-4" />
            ذخیره زمان بندی
          </Button>
          <Button onClick={() => void runBackup()}>
            <Play className="h-4 w-4" />
            اجرای بکاپ دستی
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست بکاپ ها</CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <EmptyState title="بکاپی موجود نیست" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>فایل ها</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((backup, idx) => (
                    <TableRow key={backup.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{shamsiDate(backup.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={backup.status === 'SUCCESS' ? 'success' : backup.status === 'FAILED' ? 'destructive' : 'outline'}>{backup.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {backup.excelFiles?.length ? backup.excelFiles.join('، ') : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void downloadProtected(`/backups/${backup.id}/sql`)}>
                              <Download className="ml-2 h-4 w-4" />
                              دریافت SQL
                            </DropdownMenuItem>
                            {backup.excelFiles?.map((file) => (
                              <DropdownMenuItem key={file} onClick={() => void downloadProtected(`/backups/${backup.id}/excel?file=${encodeURIComponent(file)}`, file)}>
                                <Download className="ml-2 h-4 w-4" />
                                {file}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={backups.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}