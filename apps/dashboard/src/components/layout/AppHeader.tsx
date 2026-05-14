import { useMemo, useState } from 'react';
import { Bell, ChevronRight, LogOut, Menu, Moon, Sun, UserCircle2 } from 'lucide-react';
import { useBestContext } from '../../contexts/best-context';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { textFa } from '../../lib/format';

type AppHeaderProps = {
  onToggleSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function AppHeader({ onToggleSidebar, theme, onToggleTheme }: AppHeaderProps) {
  const { canGoBack, goBack, notifications, acknowledgeNotification, openNotificationTarget, session, logout } = useBestContext();
  const [profileOpen, setProfileOpen] = useState(false);

  const todayShamsi = useMemo(
    () =>
      new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(new Date()),
    []
  );

  return (
    <header className="mb-4 rounded-xl border border-slate-300/90 bg-white px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-card sm:px-4">
      <div className="flex items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={onToggleSidebar} aria-label="باز کردن منو">
            <Menu className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="min-w-[2.25rem] px-2 sm:min-w-[6.5rem] sm:px-3"
            disabled={!canGoBack}
            onClick={goBack}
            aria-label="بازگشت"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="hidden sm:inline">بازگشت</span>
          </Button>

          <Button variant="outline" size="icon" onClick={onToggleTheme} aria-label="تغییر پوسته">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="اعلان‌ها">
                <Bell className="h-4 w-4" />
                {notifications.length ? (
                  <span className="absolute -left-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[min(24rem,calc(100vw-1.25rem))] sm:w-[24rem]">
              <DropdownMenuLabel>اعلان‌های اخیر</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">اعلان جدیدی ندارید.</div>
              ) : (
                notifications.slice(0, 6).map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="flex cursor-pointer flex-col items-start gap-1 py-2"
                    onClick={() => {
                      acknowledgeNotification(item.id);
                      openNotificationTarget(item);
                    }}
                  >
                    <span className="text-sm font-semibold">{textFa(item.title)}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{textFa(item.description)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div onMouseEnter={() => setProfileOpen(true)} onMouseLeave={() => setProfileOpen(false)}>
            <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="پروفایل">
                  <UserCircle2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="space-y-1">
                  <div className="text-xs text-muted-foreground">کاربر وارد شده</div>
                  <div className="text-sm font-bold">{session?.username ?? '-'}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-w-0 text-left">
          <p className="truncate text-base font-extrabold tracking-tight text-foreground sm:text-2xl">پنل مدیریت بست</p>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">به نام خدا | {todayShamsi}</p>
        </div>
      </div>
    </header>
  );
}

