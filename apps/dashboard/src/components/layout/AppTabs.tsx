import {
  Activity,
  Bell,
  ClipboardList,
  Factory,
  Grid2X2,
  HardDriveDownload,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  UserRound,
  Users2,
  Warehouse
} from 'lucide-react';
import { cn } from '../../lib/utils';

const TABS = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'orders', label: 'سفارشات', icon: ClipboardList },
  { key: 'invoices', label: 'فاکتورها', icon: Receipt },
  { key: 'collaborators', label: 'همکاران', icon: Users2 },
  { key: 'customers', label: 'مشتریان', icon: UserRound },
  { key: 'mesh', label: 'نوع توری', icon: Grid2X2 },
  { key: 'warehouse', label: 'انبارداری', icon: Warehouse },
  { key: 'users', label: 'کاربران', icon: ShieldCheck },
  { key: 'backups', label: 'بکاپ', icon: HardDriveDownload },
  { key: 'notifications', label: 'اعلان‌ها', icon: Bell },
  { key: 'activity', label: 'گزارش عملیات', icon: Activity }
] as const;

const DISABLED_TABS = [
  { key: 'production', label: 'تولید', icon: Factory },
  { key: 'settings', label: 'تنظیمات', icon: Settings }
] as const;

export type AppTab = (typeof TABS)[number]['key'];

export function AppTabs({
  active,
  onChange,
  collapsed,
  visibleTabs,
  onItemClick,
  onDisabledItemClick
}: {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  collapsed?: boolean;
  visibleTabs?: AppTab[];
  onItemClick?: () => void;
  onDisabledItemClick?: (label: string) => void;
}) {
  const visible = visibleTabs?.length ? TABS.filter((item) => visibleTabs.includes(item.key)) : TABS;

  return (
    <nav className="space-y-1">
      {visible.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onChange(item.key);
              onItemClick?.();
            }}
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-soft ring-1 ring-primary/40'
                : 'text-slate-700 hover:-translate-y-0.5 hover:bg-secondary/80 hover:text-foreground dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
              collapsed && 'mx-auto w-11 justify-center gap-0 px-0 py-2.5'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </button>
        );
      })}

      <div className="mt-2 space-y-1 border-t border-slate-200/80 pt-2 dark:border-slate-700/80">
        {DISABLED_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              aria-disabled="true"
              onClick={() => onDisabledItemClick?.(item.label)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg bg-slate-100/80 px-3 py-2.5 text-base font-semibold text-slate-400 dark:bg-slate-800/50 dark:text-slate-500',
                collapsed && 'mx-auto w-11 justify-center gap-0 px-0 py-2.5'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
