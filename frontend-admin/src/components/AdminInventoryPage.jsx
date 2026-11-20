import React, { useState, useMemo } from 'react';
import {
  RiSearchLine,
  RiMapPinLine,
  RiCalendarLine,
  RiUserLine,
  RiArrowRightLine,
} from 'react-icons/ri';

export const AdminInventoryPage = ({ inventoryList, onSelectToMatch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          item.id.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.foundLocation.toLowerCase().includes(query) ||
          item.finderName.toLowerCase().includes(query) ||
          item.storageLocker.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [inventoryList, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Inventori Barang Temuan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Daftar barang fisik yang diserahkan penemu dan tersimpan di loker penyimpanan Loket D.
          </p>
        </div>

        <div className="text-xs flex items-center gap-2 text-slate-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl">
          <span>Kapasitas Loker:</span>
          <span className="font-mono font-bold text-[#3B1259]">14 / 30 Terpakai</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <RiSearchLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID Inventori, nama barang, atau loker..."
            className="w-full pl-10 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          {['ALL', 'Tersimpan', 'Diambil'].map((status) => {
            const count =
              status === 'ALL'
                ? inventoryList.length
                : inventoryList.filter((i) => i.status === status).length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'Semua' : status} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredInventory.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-purple-300 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-sm font-bold text-[#3B1259]">{item.id}</span>
                <span
                  className={`inline-flex items-center gap-2 text-xs font-semibold ${
                    item.status === 'Tersimpan' ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.status === 'Tersimpan' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  {item.status}
                </span>
              </div>

              <div className="flex gap-3.5 mb-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  <img
                    src={item.photoUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                  <span className="text-xs text-slate-500 block mt-0.5">{item.category}</span>
                  <span className="text-xs font-mono text-[#581C87] font-medium block mt-1">
                    {item.storageLocker}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <RiMapPinLine className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="line-clamp-1">{item.foundLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCalendarLine className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{item.foundDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiUserLine className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="line-clamp-1">Penemu: {item.finderName}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                "{item.notes}"
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">Internal Only</span>
              {item.status === 'Tersimpan' && onSelectToMatch && (
                <button
                  type="button"
                  onClick={() => onSelectToMatch(item.id)}
                  className="font-semibold text-[#3B1259] hover:text-[#581C87] inline-flex items-center gap-1 transition-colors"
                >
                  <span>Cocokkan Laporan</span>
                  <RiArrowRightLine className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
