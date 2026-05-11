import { LayoutDashboard, ClipboardList, Receipt, Users2, UserRound, Grid2X2, ShieldCheck, HardDriveDownload, Activity } from 'lucide-react';

const TABS = [
  { key: 'dashboard', label: '\u062f\u0627\u0634\u0628\u0648\u0631\u062f', icon: LayoutDashboard },
  { key: 'orders', label: '\u0633\u0641\u0627\u0631\u0634\u0627\u062a', icon: ClipboardList },
  { key: 'invoices', label: '\u0641\u0627\u06a9\u062a\u0648\u0631\u0647\u0627', icon: Receipt },
  { key: 'collaborators', label: '\u0647\u0645\u06a9\u0627\u0631\u0627\u0646', icon: Users2 },
  { key: 'customers', label: '\u0645\u0634\u062a\u0631\u06cc\u0627\u0646', icon: UserRound },
  { key: 'mesh', label: '\u0646\u0648\u0639 \u062a\u0648\u0631\u06cc', icon: Grid2X2 },
  { key: 'users', label: '\u06a9\u0627\u0631\u0628\u0631\u0627\u0646', icon: ShieldCheck },
  { key: 'backups', label: '\u0628\u06a9\u0627\u067e', icon: HardDriveDownload },
  { key: 'activity', label: '\u06af\u0632\u0627\u0631\u0634 \u0639\u0645\u0644\u06cc\u0627\u062a', icon: Activity }
] as const;

export type AppTab = (typeof TABS)[number]['key'];

export function AppTabs({ active, onChange, onItemClick }: { active: AppTab; onChange: (tab: AppTab) => void; onItemClick?: () => void }) {
  return (
    <nav className="sidebar-nav">
      {TABS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            className={`sidebar-link ${active === item.key ? 'active' : ''}`}
            onClick={() => {
              onChange(item.key);
              onItemClick?.();
            }}
            type="button"
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
