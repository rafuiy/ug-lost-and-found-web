import React, { useState } from 'react';
import {
  RiLogoutBoxRLine,
  RiArchiveLine,
  RiFileList3Line,
  RiCheckboxMultipleLine,
  RiTimeLine,
  RiMenuLine,
  RiCloseLine,
} from 'react-icons/ri';

export const AdminNavbar = ({
  activeTab,
  onSelectTab,
  onLogoutClick,
  queueCount = 0,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'queue', label: 'Antrean Laporan', icon: <RiFileList3Line className="w-4 h-4" />, count: queueCount },
    { id: 'inventory', label: 'Inventori Temuan', icon: <RiArchiveLine className="w-4 h-4" /> },
    { id: 'handover', label: 'Serah Terima', icon: <RiCheckboxMultipleLine className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Log', icon: <RiTimeLine className="w-4 h-4" /> },
  ];

  const handleSelect = (tab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200/80 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand + Nav */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => handleSelect('queue')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-[#3B1259] text-white flex items-center justify-center font-extrabold text-sm tracking-tight">
                UG
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base tracking-tight block leading-none">
                  UG Lost &amp; Found
                </span>
                <span className="text-[11px] text-[#581C87] font-semibold block mt-0.5">
                  Panel Petugas Loket
                </span>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1" aria-label="Menu Admin">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#F3EEF8] text-[#3B1259] font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="font-mono text-xs font-bold text-[#581C87]">
                        ({item.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Petugas Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pr-3 border-r border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#F3EEF8] text-[#3B1259] flex items-center justify-center font-bold text-xs">
                BS
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  Budi Santoso
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Loket D • ADM-04D
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogoutClick}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
            >
              <RiLogoutBoxRLine className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            >
              {mobileOpen ? <RiCloseLine className="w-5 h-5" /> : <RiMenuLine className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-[#F3EEF8] text-[#3B1259] font-semibold' : 'text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs font-bold text-[#581C87]">{item.count}</span>
                )}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-3 py-1">
            <span className="text-xs text-slate-500 font-mono">Budi Santoso (ADM-04D)</span>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onLogoutClick();
              }}
              className="text-xs font-semibold text-rose-700 flex items-center gap-1"
            >
              <RiLogoutBoxRLine className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
