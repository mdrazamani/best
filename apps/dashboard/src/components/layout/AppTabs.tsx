import {
  Activity,
  Bell,
  ClipboardList,
  Grid2X2,
  HardDriveDownload,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  UserRound,
  Users2
} from 'lucide-react';
import { cn } from '../../lib/utils';

const TABS = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'orders', label: 'سفارشات', icon: ClipboardList },
  { key: 'invoices', label: 'فاکتورها', icon: Receipt },
  { key: 'collaborators', label: 'همکاران', icon: Users2 },
  { key: 'customers', label: 'مشتریان', icon: UserRound },
  { key: 'mesh', label: 'نوع توری', icon: Grid2X2 },
  { key: 'users', label: 'کاربران', icon: ShieldCheck },
  { key: 'backups', label: 'بکاپ', icon: HardDriveDownload },
  { key: 'notifications', label: 'اعلان‌ها', icon: Bell },
  { key: 'activity', label: 'گزارش عملیات', icon: Activity }
] as const;

export type AppTab = (typeof TABS)[number]['key'];

export function AppTabs({
  active,
  onChange,
  collapsed,
  onItemClick
}: {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  collapsed?: boolean;
  onItemClick?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {TABS.map((item) => {
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
    </nav>
  );
}
