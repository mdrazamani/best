import { FormEvent, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { Badge } from '../components/ui/badge';

const PAGE_SIZE = 10;

export function MeshTypesPage() {
  const { meshTypes, createMeshType } = useBestContext();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: '', description: '' });

  const totalPages = Math.max(1, Math.ceil(meshTypes.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return meshTypes.slice(start, start + PAGE_SIZE);
  }, [meshTypes, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createMeshType({ ...form, isActive: true });
    setForm({ title: '', description: '' });
    setOpen(false);
  };

  return (
    <section>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>نوع توری</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                نوع توری جدید
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تعریف نوع توری</DialogTitle>
                <DialogDescription>عنوان و توضیح نوع توری را وارد کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <Input placeholder="عنوان" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                <Textarea placeholder="توضیح" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit">ثبت</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {meshTypes.length === 0 ? (
            <EmptyState title="نوع توری ثبت نشده است" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>عنوان</TableHead>
                    <TableHead>توضیح</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => (
                    <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? 'success' : 'outline'}>{item.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={meshTypes.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}