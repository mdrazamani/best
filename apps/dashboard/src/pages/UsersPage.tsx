import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { fullName, permissionLabel } from '../lib/format';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { SearchableSelect } from '../components/ui/searchable-select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/shared/empty-state';
import { Pagination } from '../components/shared/pagination';
import { Badge } from '../components/ui/badge';

const PAGE_SIZE = 10;

export function UsersPage() {
  const { users, roles, permissions, createUser, removeUser, updateRolePermissions } = useBestContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'DISABLED'>('all');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    roleKey: 'manager'
  });

  const editableRoles = useMemo(() => roles.filter((role) => role.key !== 'super_admin'), [roles]);
  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.key, label: role.name })), [roles]);
  const roleFilterOptions = useMemo(() => [{ value: 'all', label: 'همه نقش‌ها' }, ...roleOptions], [roleOptions]);
  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'همه وضعیت‌ها' },
      { value: 'ACTIVE', label: 'فعال' },
      { value: 'DISABLED', label: 'غیرفعال' }
    ],
    []
  );

  const [selectedRoleKey, setSelectedRoleKey] = useState('manager');

  const selectedRolePermissionKeys = useMemo(() => {
    const role = roles.find((item) => item.key === selectedRoleKey);
    return new Set((role?.rolePermissions ?? []).map((item) => item.permission.key));
  }, [roles, selectedRoleKey]);

  const [pendingPermissionKeys, setPendingPermissionKeys] = useState<string[]>([]);

  useEffect(() => {
    setPendingPermissionKeys([]);
  }, [selectedRoleKey]);

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      const name = fullName(user).toLowerCase();
      const username = user.username.toLowerCase();
      const roleKeys = (user.userRoles ?? []).map((entry) => entry.role?.key).filter(Boolean) as string[];
      const matchesSearch = !q || name.includes(q) || username.includes(q);
      const matchesRole = roleFilter === 'all' || roleKeys.includes(roleFilter);
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page, totalPages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createUser(form);
    setForm({ firstName: '', lastName: '', username: '', password: '', roleKey: 'manager' });
    setCreateOpen(false);
  };

  const saveRolePermissions = async () => {
    await updateRolePermissions(selectedRoleKey, pendingPermissionKeys);
    setPendingPermissionKeys([]);
  };

  const effectivePermissionSet = pendingPermissionKeys.length ? new Set(pendingPermissionKeys) : selectedRolePermissionKeys;

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl font-extrabold">کاربران سیستم</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                کاربر جدید
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تعریف کاربر مدیریتی</DialogTitle>
                <DialogDescription>برای کاربر جدید نقش مناسب انتخاب کنید.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input required placeholder="نام" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                  <Input required placeholder="نام خانوادگی" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                  <Input required placeholder="نام کاربری" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
                  <Input required minLength={6} type="password" placeholder="رمز عبور" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
                  <SearchableSelect options={roleOptions} value={form.roleKey} onChange={(value) => setForm((prev) => ({ ...prev, roleKey: value }))} placeholder="انتخاب نقش" className="md:col-span-2" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
                  <Button type="submit">ثبت کاربر</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" placeholder="جستجو: نام یا نام کاربری" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <SearchableSelect
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value || 'all');
                setPage(1);
              }}
              options={roleFilterOptions}
              placeholder="همه نقش‌ها"
              isSearchable={false}
            />
            <SearchableSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value || 'all') as 'all' | 'ACTIVE' | 'DISABLED');
                setPage(1);
              }}
              options={statusFilterOptions}
              placeholder="همه وضعیت‌ها"
              isSearchable={false}
            />
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState title="کاربری وجود ندارد" description="با دکمه کاربر جدید شروع کنید." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>نام کاربری</TableHead>
                    <TableHead>نقش‌ها</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item, idx) => (
                    <TableRow key={item.id} className={idx % 2 ? 'bg-muted/10' : ''}>
                      <TableCell>{fullName(item)}</TableCell>
                      <TableCell className="font-medium">{item.username}</TableCell>
                      <TableCell>{item.userRoles?.map((role) => role.role?.name).join('، ') || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'outline'}>{item.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedUserId(item.id); setViewOpen(true); }}>
                              <Eye className="ml-2 h-4 w-4" />
                              مشاهده
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeUser(item.id)}>
                              <Trash2 className="ml-2 h-4 w-4" />
                              حذف 
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={Math.min(page, totalPages)} total={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">تنظیم دسترسی نقش‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchableSelect
            options={editableRoles.map((role) => ({ value: role.key, label: role.name }))}
            value={selectedRoleKey}
            onChange={setSelectedRoleKey}
            placeholder="انتخاب نقش"
          />

          <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-auto rounded-lg border p-3 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={effectivePermissionSet.has(permission.key)}
                  onChange={(e) => {
                    const current = new Set(effectivePermissionSet);
                    if (e.target.checked) current.add(permission.key);
                    else current.delete(permission.key);
                    setPendingPermissionKeys(Array.from(current));
                  }}
                />
                <span className="truncate">{permissionLabel(permission.key)}</span>
              </label>
            ))}
          </div>

          <Button className="w-full" onClick={() => void saveRolePermissions()}>ذخیره دسترسی‌ها</Button>
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>جزئیات کاربر</DialogTitle>
          </DialogHeader>
          {selectedUser ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">نام:</span> {fullName(selectedUser)}</p>
              <p><span className="font-semibold">نام کاربری:</span> {selectedUser.username}</p>
              <p><span className="font-semibold">نقش‌ها:</span> {selectedUser.userRoles?.map((role) => role.role?.name).join('، ') || '-'}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
