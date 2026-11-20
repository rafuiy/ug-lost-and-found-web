import { LuArrowRight } from 'react-icons/lu';

export const AdminStatsCards = ({ activeFilter, onFilterSelect, counts }) => {
  const isQueueActive = activeFilter === 'Belum Ada';

  const ledgerCells = [
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      valueColor: 'text-ug-700',
      activeBg: 'bg-ug-100',
    },
    {
      key: 'Lawas >30h',
      title: 'Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      valueColor: 'text-gold-ink',
      activeBg: 'bg-gold-wash',
    },
    {
      key: 'Selesai',
      title: 'Selesai Diserahkan',
      value: counts.selesai,
      subtitle: 'Handover terverifikasi',
      valueColor: 'text-ok',
      activeBg: 'bg-ok-wash',
    },
  ];

  const handleToggle = (key) => {
    if (!onFilterSelect) return;
    onFilterSelect(activeFilter === key ? 'Semua' : key);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_2fr]">
      {/* Left Zone: Primary Actionable Queue */}
      <button
        type="button"
        onClick={() => handleToggle('Belum Ada')}
        aria-pressed={isQueueActive}
        className={`rounded-[5px] border-2 p-5 text-left flex flex-col justify-between transition-colors cursor-pointer ${
          isQueueActive
            ? 'border-ug-800 bg-ug-100 shadow-[4px_4px_0_var(--color-ug-800)]'
            : 'border-ink bg-sheet shadow-[4px_4px_0_var(--color-ink)] hover:bg-ug-100/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ug-700">
            Antrean Baru
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-2">
            <span>{isQueueActive ? 'Filter aktif' : 'Tampilkan'}</span>
            <LuArrowRight className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="text-4xl font-bold tabular-nums tracking-[-0.03em] text-ink">
            {counts.belumAda}
          </span>
          <span className="text-xs font-medium text-ink-2 text-right">
            Menunggu pencocokan dengan inventori fisik
          </span>
        </div>
      </button>

      {/* Right Zone: Unified 3-Column Counter Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-[5px] border-2 border-ink bg-sheet divide-y sm:divide-y-0 sm:divide-x divide-line-strong overflow-hidden">
        {ledgerCells.map((cell) => {
          const isActive = activeFilter === cell.key;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => handleToggle(cell.key)}
              aria-pressed={isActive}
              className={`p-4 sm:p-5 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                isActive ? cell.activeBg : 'bg-sheet hover:bg-paper'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-xs font-bold text-ink">{cell.title}</span>
                {isActive ? (
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ug-800">
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3">
                    <span>Filter</span>
                    <LuArrowRight className="size-4" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div
                  className={`text-3xl font-bold tabular-nums tracking-[-0.03em] ${cell.valueColor}`}
                >
                  {cell.value}
                </div>
                <div className="text-xs text-ink-3 mt-1">{cell.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
