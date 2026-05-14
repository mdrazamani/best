import {
  Activity,
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
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              isActive ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}