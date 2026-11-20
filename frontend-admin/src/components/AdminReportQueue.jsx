import React, { useState, useMemo } from 'react';
import { StatusBadge, StaleBadge, CategoryBadge } from './AdminBadges';
import { RiSearchLine, RiFilter3Line, RiEyeLine, RiTimeLine } from 'react-icons/ri';

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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search & Category */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative flex-1">
              <RiSearchLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode tiket, nama pelapor, atau NPM..."
                className="w-full pl-10 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700 focus:border-purple-700"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <RiFilter3Line className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
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
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto text-xs shrink-0">
            {[
              { key: 'Semua', label: `Semua (${counts.all})` },
              { key: 'Belum Ada', label: `Belum Ada (${counts.belumAda})` },
              { key: 'Perlu Verifikasi', label: `Perlu Verifikasi (${counts.perluVerifikasi})` },
              { key: 'Lawas >30h', label: `Lawas >30h (${counts.lawas})` },
              { key: 'Selesai', label: `Selesai (${counts.selesai})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFilterTabChange(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeFilterTab === tab.key
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-5 w-32">Kode Tiket</th>
              <th className="py-3.5 px-4 w-40">Tanggal Lapor</th>
              <th className="py-3.5 px-4">Pelapor</th>
              <th className="py-3.5 px-4">Barang</th>
              <th className="py-3.5 px-4">Lokasi Hilang</th>
              <th className="py-3.5 px-4 w-48">Status</th>
              <th className="py-3.5 px-5 text-right w-36">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-500">
                  <RiTimeLine className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700 text-sm">
                    Tidak ada pengaduan yang sesuai kriteria.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Coba sesuaikan kata kunci pencarian atau tab filter.
                  </p>
                </td>
              </tr>
            ) : (
              filteredReports.map((row) => (
                <tr key={row.ticketCode} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-5 font-mono font-bold text-[#3B1259] whitespace-nowrap">
                    {row.ticketCode}
                  </td>

                  <td className="py-4 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {row.reportedAt}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{row.reporterName}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">
                      NPM {row.reporterNpm}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-medium text-slate-900 line-clamp-1">{row.itemName}</div>
                    <div className="mt-0.5">
                      <CategoryBadge category={row.category} />
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs text-slate-600 max-w-xs">
                    <div className="line-clamp-2" title={row.lostLocation}>
                      {row.lostLocation}
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={row.status} />
                      {row.isStale && <StaleBadge />}
                    </div>
                  </td>

                  <td className="py-4 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onReviewReport(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
                    >
                      <RiEyeLine className="w-3.5 h-3.5 text-[#3B1259]" />
                      <span>Review Rincian</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Menampilkan <span className="font-semibold text-slate-800">{filteredReports.length}</span> dari{' '}
          <span className="font-semibold text-slate-800">{reports.length}</span> laporan
        </div>
        <div className="font-mono text-[11px]">
          Loket D Margonda • Sync Realtime (WIB)
        </div>
      </div>
    </div>
  );
};
