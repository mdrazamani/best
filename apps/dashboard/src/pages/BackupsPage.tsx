import { useEffect, useMemo, useState } from 'react';
import { Download, MoreHorizontal, Play, Save, Search } from 'lucide-react';
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
import { SearchableSelect } from '../components/ui/searchable-select';

const PAGE_SIZE = 8;

export function BackupsPage() {
  const { backups, backupInterval, updateBackupSettings, runBackup, downloadProtected } = useBestContext();
  const [intervalInput, setIntervalInput] = useState(String(backupInterval));
  const [runningBackup, setRunningBackup] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'SUCCESS' | 'FAILED' | 'PENDING'>('all');
  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه وضعیت‌ها' },
      { value: 'SUCCESS', label: 'موفق' },
      { value: 'FAILED', label: 'ناموفق' },
      { value: 'PENDING', label: 'در حال انجام' }
    ],
    []
  );

  useEffect(() => {
    setIntervalInput(String(backupInterval));
  }, [backupInterval]);

  const filteredBackups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return backups.filter((backup) => {
      const matchesSearch =
        !q ||
        backup.id.toLowerCase().includes(q) ||
        shamsiDate(backup.createdAt).toLowerCase().includes(q) ||
        backup.excelFiles.some((file) => file.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'all' || backup.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [backups, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBackups.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredBackups.slice(start, start + PAGE_SIZE);
  }, [filteredBackups, page, totalPages]);

  const runAndDownloadBackup = async () => {
    setRunningBackup(true);
    try {
      const result = await runBackup();
      if (result?.backupId) {
        await downloadProtected(`/backups/${result.backupId}/archive`, `backup-${result.backupId}.zip`);
      }
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">تنظیمات بکاپ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="space-y-1 md:w-56">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">بازه اجرای خودکار بکاپ</span>
              <Badge variant="secondary" className="text-[10px]">دقیقه</Badge>
            </div>
            <Input
              value={intervalInput}
              onChange={(e) => setIntervalInput(e.target.value)}
              inputMode="numeric"
              placeholder="مثلا 1440"
            />
          </div>
          <Button variant="secondary" onClick={() => void updateBackupSettings(Number(intervalInput || 1440))}>
            <Save className="h-4 w-4" />
            ذخیره بازه زمانی
          </Button>
          <Button onClick={() => void runAndDownloadBackup()} disabled={runningBackup}>
            <Play className="h-4 w-4" />
            {runningBackup ? 'در حال تهیه بکاپ...' : 'اجرای دستی بکاپ و دریافت ZIP'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">آرشیو فایل‌های بکاپ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-3">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو: شناسه بکاپ، تاریخ، نام فایل" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value || 'all') as 'all' | 'SUCCESS' | 'FAILED' | 'PENDING');
                setPage(1);
              }}
              options={statusFilterOptions}
              placeholder="همه وضعیت‌ها"
              isSearchable={false}
            />
          </div>

          {filteredBackups.length === 0 ? (
            <EmptyState title="هنوز بکاپی تولید نشده است" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>تاریخ تولید</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>فایل‌های اکسل</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((backup, idx) => (
                    <TableRow key={backup.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{shamsiDate(backup.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={backup.status === 'SUCCESS' ? 'success' : backup.status === 'FAILED' ? 'destructive' : 'outline'}>
                          {backup.status}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => void downloadProtected(`/backups/${backup.id}/archive`, `backup-${backup.id}.zip`)}>
                              <Download className="ml-2 h-4 w-4" />
                              دانلود ZIP کامل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void downloadProtected(`/backups/${backup.id}/sql`, `backup-${backup.id}.sql`)}>
                              <Download className="ml-2 h-4 w-4" />
                              دانلود SQL
                            </DropdownMenuItem>
                            {backup.excelFiles?.map((file) => (
                              <DropdownMenuItem
                                key={file}
                                onClick={() => void downloadProtected(`/backups/${backup.id}/excel?file=${encodeURIComponent(file)}`, file)}
                              >
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
              <Pagination page={Math.min(page, totalPages)} total={filteredBackups.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
