const TABS = [
  ['dashboard', '\u062f\u0627\u0634\u0628\u0648\u0631\u062f'],
  ['orders', '\u0633\u0641\u0627\u0631\u0634\u0627\u062a'],
  ['invoices', '\u0641\u0627\u06a9\u062a\u0648\u0631\u0647\u0627'],
  ['collaborators', '\u0647\u0645\u06a9\u0627\u0631\u0627\u0646'],
  ['customers', '\u0645\u0634\u062a\u0631\u06cc\u0627\u0646'],
  ['mesh', '\u0646\u0648\u0639 \u062a\u0648\u0631\u06cc'],
  ['users', '\u06a9\u0627\u0631\u0628\u0631\u0627\u0646'],
  ['backups', '\u0628\u06a9\u0627\u067e'],
  ['activity', '\u06af\u0632\u0627\u0631\u0634 \u0639\u0645\u0644\u06cc\u0627\u062a']
] as const;

export type AppTab = (typeof TABS)[number][0];

export function AppTabs({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav className="tabs">
      {TABS.map(([key, label]) => (
        <button key={key} className={active === key ? 'active' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </nav>
  );
}
