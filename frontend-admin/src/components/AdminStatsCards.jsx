export const AdminStatsCards = ({
  counts,
  activeFilterTab = 'Semua',
  onlyStale = false,
  onSelectStatus,
  onToggleStale,
}) => {
  const ledgerCells = [
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      valueColor: 'text-ug-700',
      isActive: activeFilterTab === 'Perlu Verifikasi',
      onClick: () => onSelectStatus?.(activeFilterTab === 'Perlu Verifikasi' ? 'Semua' : 'Perlu Verifikasi'),
    },
    {
      key: 'Lawas >30h',
      title: 'Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      valueColor: 'text-gold-ink',
      isActive: onlyStale,
      onClick: () => onToggleStale?.(),
    },
    {
      key: 'Selesai',
      title: 'Selesai Diserahkan',
      value: counts.selesai,
      subtitle: 'Serah terima selesai',
      valueColor: 'text-ok',
      isActive: activeFilterTab === 'Selesai',
      onClick: () => onSelectStatus?.(activeFilterTab === 'Selesai' ? 'Semua' : 'Selesai'),
    },
    {
      key: 'Dibatalkan',
      title: 'Dibatalkan',
      value: counts.dibatalkan ?? 0,
      subtitle: 'Hasil revert selesai/ditolak',
      valueColor: 'text-ink-2',
      isActive: activeFilterTab === 'Dibatalkan',
      onClick: () => onSelectStatus?.(activeFilterTab === 'Dibatalkan' ? 'Semua' : 'Dibatalkan'),
    },
  ];

  const isQueueActive = activeFilterTab === 'Belum Ada';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_2.5fr]">
      {/* Left Zone: Primary Actionable Queue Overview */}
      <button
        type="button"
        aria-pressed={isQueueActive}
        onClick={() => onSelectStatus?.(isQueueActive ? 'Semua' : 'Belum Ada')}
        className={`rounded-[5px] border-[1.5px] p-5 flex flex-col justify-between text-left transition-colors cursor-pointer ${
          isQueueActive
            ? 'border-ug-800 bg-ug-100 ring-1 ring-ug-700'
            : 'border-ug-200 bg-ug-100/60 hover:border-ug-700'
        }`}
      >
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ug-700">
          Antrean Baru
        </span>

        <div className="mt-4 flex items-baseline justify-between gap-4 w-full">
          <span className="text-4xl font-bold tabular-nums tracking-[-0.03em] text-ug-800">
            {counts.belumAda}
          </span>
          <span className="text-xs font-medium text-ink-2 text-right">
            Menunggu pencocokan dengan inventori fisik
          </span>
        </div>
      </button>

      {/* Right Zone: Unified 4-Column Counter Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[5px] border-[1.5px] border-line-strong bg-sheet divide-y sm:divide-y-0 sm:divide-x divide-line overflow-hidden">
        {ledgerCells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            aria-pressed={cell.isActive}
            onClick={cell.onClick}
            className={`p-4 sm:p-5 flex flex-col justify-between text-left transition-colors cursor-pointer ${
              cell.isActive ? 'bg-ug-100/60 ring-2 ring-inset ring-ug-700' : 'bg-sheet hover:bg-paper/80'
            }`}
          >
            <span className="text-xs font-bold text-ink">{cell.title}</span>

            <div className="mt-3">
              <div
                className={`text-3xl font-bold tabular-nums tracking-[-0.03em] ${cell.valueColor}`}
              >
                {cell.value}
              </div>
              <div className="text-xs text-ink-3 mt-1">{cell.subtitle}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
