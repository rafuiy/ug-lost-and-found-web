import { useState, useMemo } from 'react';
import { StatusStamp } from './ui/Stamp';
import { Button } from './ui/Button';
import { INPUT_CLASS } from './ui/styles';
import {
  LuSearch,
  LuMapPin,
  LuCalendar,
  LuUser,
  LuArrowRight,
} from 'react-icons/lu';

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line-strong">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-[-0.03em]">
            Inventori Barang Temuan
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Daftar barang fisik yang diserahkan penemu dan tersimpan di loker penyimpanan Loket D.
          </p>
        </div>

        <div className="text-xs flex items-center gap-2 text-ink-2 bg-sheet border-[1.5px] border-line-strong px-3.5 py-2 rounded-[4px] shrink-0">
          <span>Kapasitas Loker:</span>
          <span className="font-bold text-ug-800 tabular-nums">14 / 30 Terpakai</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <LuSearch
            className="size-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID Inventori, nama barang, atau loker..."
            className={`${INPUT_CLASS} h-10 pl-10`}
          />
        </div>

        <div className="flex items-center gap-1 rounded-[4px] border-[1.5px] border-line-strong bg-paper p-1 text-xs">
          {['ALL', 'Tersimpan', 'Diambil'].map((status) => {
            const count =
              status === 'ALL'
                ? inventoryList.length
                : inventoryList.filter((i) => i.status === status).length;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-[3px] transition-colors tabular-nums cursor-pointer ${
                  isActive
                    ? 'bg-ug-950 text-sheet font-bold'
                    : 'text-ink-2 hover:text-ink font-semibold'
                }`}
              >
                {status === 'ALL' ? 'Semua' : status} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Dossier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredInventory.map((item) => {
          const isStored = item.status === 'Tersimpan';
          return (
            <div
              key={item.id}
              className={`rounded-[5px] p-5 flex flex-col justify-between ${
                isStored
                  ? 'border-[1.5px] border-ink/85 bg-sheet shadow-[3px_3px_0_var(--color-ink)]'
                  : 'border-[1.5px] border-line bg-paper/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-sm font-bold text-ug-800 tabular-nums">{item.id}</span>
                  <StatusStamp status={item.status} size="sm" className="bg-sheet/80" />
                </div>

                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-20 rounded-[4px] bg-paper border-[1.5px] border-line-strong overflow-hidden shrink-0">
                    <img
                      src={item.photoUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-ink line-clamp-1">{item.title}</h3>
                    <span className="text-xs font-medium text-ink-3 block mt-0.5">
                      {item.category}
                    </span>
                    <span className="bg-ug-100 text-ug-800 px-2 py-0.5 rounded-[3px] text-xs font-bold inline-block mt-1.5 tabular-nums">
                      {item.storageLocker}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-ink-2 bg-paper p-3 rounded-[4px] border border-line">
                  <div className="flex items-center gap-2">
                    <LuMapPin className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">{item.foundLocation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LuCalendar className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums font-medium">{item.foundDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LuUser className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">Penemu: {item.finderName}</span>
                  </div>
                </div>

                <p className="text-xs text-ink-2 mt-3 line-clamp-2 leading-relaxed">
                  &ldquo;{item.notes}&rdquo;
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-dotted border-line-strong flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-3 font-medium">Internal Only</span>
                {isStored && onSelectToMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectToMatch(item.id)}
                  >
                    <span>Cocokkan Laporan</span>
                    <LuArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
