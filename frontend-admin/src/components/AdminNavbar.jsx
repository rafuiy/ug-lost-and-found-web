import { useState } from 'react';
import {
  LuLogOut,
  LuArchive,
  LuClipboardList,
  LuClipboardCheck,
  LuClock,
  LuMenu,
  LuX,
} from 'react-icons/lu';

export const AdminNavbar = ({
  activeTab,
  onSelectTab,
  onLogoutClick,
  queueCount = 0,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      id: 'queue',
      label: 'Antrean Laporan',
      icon: <LuClipboardList className="size-4 shrink-0" aria-hidden="true" />,
      count: queueCount,
    },
    {
      id: 'inventory',
      label: 'Inventori Temuan',
      icon: <LuArchive className="size-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'handover',
      label: 'Serah Terima',
      icon: <LuClipboardCheck className="size-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: <LuClock className="size-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleSelect = (tab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="on-ug sticky top-0 z-40 w-full bg-ug-800 text-sheet border-b-2 border-ug-950 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand + Nav */}
          <div className="flex items-center gap-6 lg:gap-8 h-full">
            <button
              type="button"
              onClick={() => handleSelect('queue')}
              className="inline-flex items-center gap-2 rounded-[3px] text-left cursor-pointer"
            >
              <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-[15px] font-bold text-ug-950">
                UG
              </span>
              <span className="text-[15px] font-bold tracking-tight text-sheet">
                Lost&nbsp;&amp;&nbsp;Found
              </span>
              <span className="hidden sm:inline-block border-l border-sheet/30 pl-2.5 text-xs font-semibold text-sheet/75">
                Panel Loket
              </span>
            </button>

            <nav className="hidden md:flex items-stretch h-full gap-1" aria-label="Menu Admin">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 px-3 text-sm transition-colors cursor-pointer border-b-2 ${
                      isActive
                        ? 'border-gold text-gold font-bold'
                        : 'border-transparent text-sheet/80 hover:text-sheet font-semibold'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-[11px] font-bold text-ug-950 tabular-nums leading-none">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Petugas Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pr-3 border-r border-sheet/25">
              <div className="text-right">
                <div className="text-xs font-bold text-sheet leading-tight">
                  Budi Santoso
                </div>
                <div className="text-[11px] font-medium text-sheet/75 tabular-nums">
                  Loket D · ADM-04D
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogoutClick}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[5px] border-[1.5px] border-sheet/60 px-3 py-1.5 text-xs font-bold text-sheet hover:border-gold hover:text-gold transition-colors cursor-pointer"
            >
              <LuLogOut className="size-4" aria-hidden="true" />
              <span>Logout</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-[4px] text-sheet/80 hover:text-gold hover:bg-ug-900 cursor-pointer"
              aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            >
              {mobileOpen ? (
                <LuX className="size-5" aria-hidden="true" />
              ) : (
                <LuMenu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden bg-ug-900 border-t border-sheet/15 px-4 py-3 space-y-1 text-sheet">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between py-2.5 pr-3 text-sm transition-colors cursor-pointer border-l-2 ${
                  isActive
                    ? 'border-gold pl-2.5 text-gold font-bold'
                    : 'border-transparent pl-3 text-sheet/85 hover:text-sheet font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-[11px] font-bold text-ug-950 tabular-nums leading-none">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-2.5 mt-2 border-t border-sheet/15 flex items-center justify-between px-3 py-1">
            <span className="text-xs text-sheet/75 tabular-nums">
              Budi Santoso (ADM-04D)
            </span>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onLogoutClick();
              }}
              className="text-xs font-bold text-gold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <LuLogOut className="size-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
