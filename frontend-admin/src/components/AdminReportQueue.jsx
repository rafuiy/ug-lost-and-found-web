import { useState, useMemo } from 'react';
import { StatusBadge, StaleBadge, CategoryBadge } from './AdminBadges';
import { Button } from './ui/Button';
import { INPUT_CLASS } from './ui/styles';
import { LuSearch, LuFilter, LuEye, LuClock } from 'react-icons/lu';

export const AdminReportQueue = ({
  reports,
  onReviewReport,
  activeFilterTab,
  onFilterTabChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = useMemo(() => {
    const list = Array.from(new Set(reports.map((r) => r.category)));
    return ['ALL', ...list];
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      if (activeFilterTab === 'Belum Ada' && item.status !== 'Belum Ada') return false;
      if (activeFilterTab === 'Perlu Verifikasi' && item.status !== 'Perlu Verifikasi') return false;
      if (activeFilterTab === 'Selesai' && item.status !== 'Selesai') return false;
      if (activeFilterTab === 'Lawas >30h' && !item.isStale) return false;

      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          item.ticketCode.toLowerCase().includes(query) ||
          item.reporterName.toLowerCase().includes(query) ||
          item.reporterNpm.toLowerCase().includes(query) ||
          item.itemName.toLowerCase().includes(query) ||
          item.lostLocation.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [reports, activeFilterTab, selectedCategory, searchQuery]);

  const counts = {
    all: reports.length,
    belumAda: reports.filter((r) => r.status === 'Belum Ada').length,
    perluVerifikasi: reports.filter((r) => r.status === 'Perlu Verifikasi').length,
    lawas: reports.filter((r) => r.isStale).length,
    selesai: reports.filter((r) => r.status === 'Selesai').length,
  };

  return (
    <div className="rounded-[5px] border-2 border-ink bg-sheet shadow-[6px_6px_0_var(--color-ink)] overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 sm:p-5 border-b-2 border-dotted border-line-strong bg-paper/50 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search & Category */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative flex-1">
              <LuSearch
                className="size-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode tiket, nama pelapor, atau NPM..."
                className={`${INPUT_CLASS} h-10 pl-10 ${searchQuery ? 'pr-14' : ''}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LuFilter className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter kategori barang"
                className={`${INPUT_CLASS} h-10 w-auto font-semibold`}
              >
                <option value="ALL">Semua Kategori</option>
                {categories
                  .filter((c) => c !== 'ALL')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Right: Filter Tabs */}
          <div className="flex items-center gap-1 rounded-[4px] border-[1.5px] border-line-strong bg-paper p-1 overflow-x-auto text-xs shrink-0">
            {[
              { key: 'Semua', label: `Semua (${counts.all})` },
              { key: 'Belum Ada', label: `Belum Ada (${counts.belumAda})` },
              { key: 'Perlu Verifikasi', label: `Perlu Verifikasi (${counts.perluVerifikasi})` },
              { key: 'Lawas >30h', label: `Lawas >30h (${counts.lawas})` },
              { key: 'Selesai', label: `Selesai (${counts.selesai})` },
            ].map((tab) => {
              const isActive = activeFilterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onFilterTabChange(tab.key)}
                  className={`px-3 py-1.5 rounded-[3px] transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                    isActive
                      ? 'bg-ug-800 text-sheet font-bold'
                      : 'text-ink-2 hover:text-ink font-semibold'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-paper border-b-2 border-ink text-[11px] font-bold text-ink-2 uppercase tracking-[0.08em]">
              <th className="py-3.5 px-5 w-32">Kode Tiket</th>
              <th className="py-3.5 px-4 w-40">Tanggal Lapor</th>
              <th className="py-3.5 px-4">Pelapor</th>
              <th className="py-3.5 px-4">Barang</th>
              <th className="py-3.5 px-4">Lokasi Hilang</th>
              <th className="py-3.5 px-4 w-48">Status</th>
              <th className="py-3.5 px-5 text-right w-36">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-ink-3">
                  <LuClock className="size-6 text-ink-3 mx-auto mb-2" aria-hidden="true" />
                  <p className="font-bold text-ink text-sm">
                    Tidak ada pengaduan yang sesuai kriteria.
                  </p>
                  <p className="text-xs text-ink-3 mt-1">
                    Coba sesuaikan kata kunci pencarian atau tab filter.
                  </p>
                </td>
              </tr>
            ) : (
              filteredReports.map((row) => (
                <tr key={row.ticketCode} className="hover:bg-ug-100/40 transition-colors">
                  <td className="py-4 px-5 font-bold tabular-nums tracking-[0.02em] text-ug-800 whitespace-nowrap">
                    {row.ticketCode}
                  </td>

                  <td className="py-4 px-4 text-xs font-medium tabular-nums text-ink-2 whitespace-nowrap">
                    {row.reportedAt}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-bold text-ink">{row.reporterName}</div>
                    <div className="text-xs font-medium tabular-nums text-ink-2 mt-0.5">
                      NPM {row.reporterNpm}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-semibold text-ink line-clamp-1">{row.itemName}</div>
                    <div className="mt-0.5">
                      <CategoryBadge category={row.category} />
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs text-ink-2 max-w-xs">
                    <div className="line-clamp-2" title={row.lostLocation}>
                      {row.lostLocation}
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-2">
                      <StatusBadge status={row.status} />
                      {row.isStale && <StaleBadge />}
                    </div>
                  </td>

                  <td className="py-4 px-5 text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReviewReport(row)}
                    >
                      <LuEye className="size-4" aria-hidden="true" />
                      <span>Review</span>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-paper border-t border-line-strong flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-2 tabular-nums">
        <div>
          Menampilkan <span className="font-bold text-ink">{filteredReports.length}</span> dari{' '}
          <span className="font-bold text-ink">{reports.length}</span> laporan
        </div>
        <div className="text-[11px] font-semibold text-ink-3">
          Loket D Margonda · Sync Realtime (WIB)
        </div>
      </div>
    </div>
  );
};
