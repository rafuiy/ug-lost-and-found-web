import { useState, useMemo } from 'react';
import { StatusBadge, StaleBadge } from './AdminBadges';
import { Button } from './ui/Button';
import { INPUT_CLASS } from './ui/styles';
import {
  LuSearch,
  LuFilter,
  LuCalendar,
  LuChevronDown,
  LuEye,
  LuClock,
  LuRefreshCw,
} from 'react-icons/lu';

const STATUS_TABS = [
  'Semua',
  'Belum Ada',
  'Perlu Verifikasi',
  'Selesai',
  'Ditolak',
  'Dibatalkan',
];

function parseReportDateMs(reportedAt) {
  if (!reportedAt) return 0;
  const match = reportedAt
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return 0;
  const [, day, month, year, hour = '00', minute = '00'] = match;
  const ms = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:00`);
  return Number.isNaN(ms) ? 0 : ms;
}

function formatWibTime(date) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
    .format(date)
    .replace('.', ':');
}

export const AdminReportQueue = ({
  reports,
  onReviewReport,
  activeFilterTab,
  onFilterTabChange,
  dateRangeFilter: controlledDateRange,
  onDateRangeFilterChange,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [internalDateRange, setInternalDateRange] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(() => formatWibTime(new Date()));

  const dateRangeFilter =
    controlledDateRange !== undefined ? controlledDateRange : internalDateRange;
  const setDateRangeFilter = onDateRangeFilterChange || setInternalDateRange;

  const handleRefresh = async () => {
    await onRefresh?.();
    setLastUpdated(formatWibTime(new Date()));
  };

  const categories = useMemo(() => {
    const list = Array.from(new Set(reports.map((r) => r.category)));
    return ['ALL', ...list];
  }, [reports]);

  const filteredReports = useMemo(() => {
    const refMs = reports.reduce(
      (max, r) => Math.max(max, parseReportDateMs(r.reportedAt)),
      0
    );
    const refDay = refMs ? new Date(refMs).toDateString() : '';

    return reports.filter((item) => {
      if (activeFilterTab !== 'Semua' && item.status !== activeFilterTab) return false;

      if (dateRangeFilter === 'STALE') {
        if (!item.isStale) return false;
      } else if (dateRangeFilter !== 'ALL' && refMs) {
        const itemMs = parseReportDateMs(item.reportedAt);
        if (itemMs) {
          if (dateRangeFilter === 'TODAY' && new Date(itemMs).toDateString() !== refDay) {
            return false;
          }
          if (
            dateRangeFilter === '7D' &&
            (item.isStale || refMs - itemMs > 7 * 86400000)
          ) {
            return false;
          }
          if (
            dateRangeFilter === '30D' &&
            (item.isStale || refMs - itemMs > 30 * 86400000)
          ) {
            return false;
          }
        }
      }

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
  }, [reports, activeFilterTab, dateRangeFilter, selectedCategory, searchQuery]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const hasActiveFilter =
    activeFilterTab !== 'Semua' ||
    dateRangeFilter !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    trimmedQuery !== '';

  const handleResetFilters = () => {
    onFilterTabChange('Semua');
    setDateRangeFilter('ALL');
    setSelectedCategory('ALL');
    setSearchQuery('');
  };

  return (
    <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 sm:p-5 border-b border-line-strong bg-paper/70 space-y-3">
        {/* Row 1: Search, Category, Stale Toggle */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <LuSearch
              className="size-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode tiket, nama pelapor, atau NPM..."
              className={`${INPUT_CLASS} h-10 pl-10 ${searchQuery ? 'pr-16' : ''}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
              >
                Hapus
              </button>
            )}
          </div>

          <div className="relative shrink-0 md:w-56">
            <LuFilter
              className="size-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter kategori barang"
              className={`${INPUT_CLASS} h-10 appearance-none pl-9 pr-9 font-semibold cursor-pointer`}
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
            <LuChevronDown
              className="size-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          <div className="relative shrink-0 md:w-56">
            <LuCalendar
              className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                dateRangeFilter === 'STALE' ? 'text-gold-ink' : 'text-ink-3'
              }`}
              aria-hidden="true"
            />
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              aria-label="Filter rentang waktu laporan"
              className={`${INPUT_CLASS} h-10 appearance-none pl-9 pr-9 font-semibold cursor-pointer ${
                dateRangeFilter === 'STALE'
                  ? 'border-gold-ink bg-gold-wash text-gold-ink font-bold'
                  : ''
              }`}
            >
              <option value="ALL">Rentang: Semua Waktu</option>
              <option value="TODAY">Rentang: Hari Ini</option>
              <option value="7D">Rentang: 7 Hari Terakhir</option>
              <option value="30D">Rentang: 30 Hari Terakhir</option>
              <option value="STALE">Rentang: Lawas (&gt;30 Hari)</option>
            </select>
            <LuChevronDown
              className={`size-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                dateRangeFilter === 'STALE' ? 'text-gold-ink' : 'text-ink-3'
              }`}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Row 2: Mutually Exclusive Status Tabs & Reset */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-[4px] border-[1.5px] border-line-strong bg-paper p-1 overflow-x-auto max-w-full text-xs">
            {STATUS_TABS.map((statusKey) => {
              const isActive = activeFilterTab === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => onFilterTabChange(statusKey)}
                  className={`px-3 py-1.5 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-ug-950 text-sheet font-bold'
                      : 'text-ink-2 hover:text-ink font-semibold'
                  }`}
                >
                  {statusKey}
                </button>
              );
            })}
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-ug-700 hover:text-ug-900 underline decoration-2 underline-offset-4 cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-paper border-b-[1.5px] border-line-strong text-[11px] font-bold text-ink-2 uppercase tracking-[0.08em]">
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
              filteredReports.map((row) => {
                const isActionable =
                  row.status === 'Belum Ada' || row.status === 'Perlu Verifikasi';
                const showNpmMatch =
                  Boolean(trimmedQuery) &&
                  row.reporterNpm.toLowerCase().includes(trimmedQuery);
                return (
                  <tr key={row.ticketCode} className="hover:bg-ug-100/40 transition-colors">
                    <td className="py-4 px-5 font-bold tabular-nums tracking-[0.02em] text-ug-800 whitespace-nowrap">
                      {row.ticketCode}
                    </td>

                    <td className="py-4 px-4 text-xs font-medium tabular-nums text-ink-2 whitespace-nowrap">
                      {row.reportedAt}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-ink">{row.reporterName}</div>
                      {showNpmMatch && (
                        <div className="text-xs font-semibold tabular-nums text-ug-700 mt-0.5">
                          NPM {row.reporterNpm}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-ink line-clamp-1">{row.itemName}</div>
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
                      {isActionable ? (
                        <Button variant="outline" size="sm" onClick={() => onReviewReport(row)}>
                          <LuEye className="size-4" aria-hidden="true" />
                          <span>Tinjau</span>
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReviewReport(row)}
                          className="inline-flex items-center justify-center h-8 px-3 rounded-[5px] text-xs font-semibold text-ink-3 hover:text-ink hover:bg-paper transition-colors cursor-pointer"
                        >
                          Detail
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
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
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-3 tabular-nums">
          <span>Loket D Margonda · Diperbarui: {lastUpdated} WIB</span>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Segarkan waktu pembaruan"
            title="Segarkan"
            className="inline-flex items-center justify-center size-7 rounded-[4px] border border-line-strong bg-sheet text-ink-2 hover:border-ink hover:text-ink transition-colors cursor-pointer"
          >
            <LuRefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
