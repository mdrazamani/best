import { ArrowRight, BellRing, Menu, Moon, RefreshCcw, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useBestContext } from '../../contexts/best-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { shamsiDate, textFa } from '../../lib/format';

export function AppHeader({
  onToggleSidebar,
  theme,
  onToggleTheme
}: {
  onToggleSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { reload, logout, notifications, canGoBack, goBack, openNotificationTarget, acknowledgeNotification } = useBestContext();
  const todayShamsi = useMemo(() => new Date().toLocaleDateString('fa-IR-u-ca-persian'), []);

  return (
    <header className="sticky top-1 z-[70] mb-4 rounded-lg border border-slate-300/80 bg-white p-3 shadow-[0_22px_40px_-28px_rgba(15,23,42,0.6)] backdrop-blur-md dark:border-slate-700/90 dark:bg-card sm:mb-6 sm:rounded-xl sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={onToggleSidebar} aria-label="باز کردن منو">
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">پنل مدیریت BEST</h1>
            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
              به نام خدا
              <span className="hidden sm:inline"> • {todayShamsi}</span>
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 lg:max-w-2xl">
          <Button
            variant="outline"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="بازگشت"
            className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => void reload()}
            aria-label="بروزرسانی داده‌ها"
            className="h-10 px-3 text-sm sm:h-11 sm:px-4"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">بروزرسانی</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label="تغییر تم"
            className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label="اعلان‌ها"
                className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11"
              >
                <BellRing className="h-4 w-4" />
                {notifications.length ? <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" /> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[340px]">
              {notifications.length === 0 ? (
                <DropdownMenuItem disabled>اعلان فعالی وجود ندارد</DropdownMenuItem>
              ) : (
                notifications.slice(0, 8).map((item) => (
                  <DropdownMenuItem key={item.id} className="flex-col items-start gap-1 py-2" onClick={() => openNotificationTarget(item)}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{textFa(item.title)}</span>
                      <Badge variant={item.level === 'critical' ? 'destructive' : 'warning'}>
                        {item.level === 'critical' ? 'فوری' : 'نزدیک'}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{textFa(item.description)}</p>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{shamsiDate(item.dueDate)}</span>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          acknowledgeNotification(item.id);
                        }}
                      >
                        خوانده‌ام
                      </button>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="destructive" onClick={logout} className="mr-auto h-10 px-3 text-sm sm:mr-0 sm:h-11 sm:px-4 sm:text-base">
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
