import { BellRing, Menu, Moon, RefreshCcw, Search, Sun } from 'lucide-react';
import { useBestContext } from '../../contexts/best-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function AppHeader({
  onToggleSidebar,
  theme,
  onToggleTheme
}: {
  onToggleSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { session, search, setSearch, reload, logout } = useBestContext();

  return (
    <header className="sticky top-0 z-30 mb-6 rounded-xl border bg-card/95 p-4 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={onToggleSidebar} aria-label="باز کردن منو">
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">پنل مدیریت BEST</h1>
            <p className="text-sm text-muted-foreground">کاربر فعال: {session?.username ?? '-'}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 lg:max-w-2xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pr-9" placeholder="جستجو در اطلاعات..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCcw className="h-4 w-4" />
            بروزرسانی
          </Button>
          <Button variant="outline" size="icon" onClick={onToggleTheme} aria-label="تغییر تم">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="icon" aria-label="اعلان‌ها">
            <BellRing className="h-4 w-4" />
          </Button>
          <Button variant="destructive" onClick={logout}>
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}