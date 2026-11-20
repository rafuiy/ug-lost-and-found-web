export const AdminStatsCards = ({ counts }) => {
  const ledgerCells = [
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      valueColor: 'text-ug-700',
    },
    {
      key: 'Lawas >30h',
      title: 'Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      valueColor: 'text-gold-ink',
    },
    {
      key: 'Selesai',
      title: 'Selesai Diserahkan',
      value: counts.selesai,
      subtitle: 'Serah terima selesai',
      valueColor: 'text-ok',
    },
    {
      key: 'Dibatalkan',
      title: 'Dibatalkan',
      value: counts.dibatalkan ?? 0,
      subtitle: 'Hasil revert selesai/ditolak',
      valueColor: 'text-ink-2',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_2.5fr]">
      {/* Left Zone: Primary Actionable Queue Overview */}
      <div className="rounded-[5px] border-[1.5px] border-ug-200 bg-ug-100/60 p-5 flex flex-col justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ug-700">
          Antrean Baru
        </span>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="text-4xl font-bold tabular-nums tracking-[-0.03em] text-ug-800">
            {counts.belumAda}
          </span>
          <span className="text-xs font-medium text-ink-2 text-right">
            Menunggu pencocokan dengan inventori fisik
          </span>
        </div>
      </div>

      {/* Right Zone: Unified 4-Column Counter Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[5px] border-[1.5px] border-line-strong bg-sheet divide-y sm:divide-y-0 sm:divide-x divide-line overflow-hidden">
        {ledgerCells.map((cell) => (
          <div key={cell.key} className="p-4 sm:p-5 flex flex-col justify-between bg-sheet">
            <span className="text-xs font-bold text-ink">{cell.title}</span>

            <div className="mt-3">
              <div
                className={`text-3xl font-bold tabular-nums tracking-[-0.03em] ${cell.valueColor}`}
              >
                {cell.value}
              </div>
              <div className="text-xs text-ink-3 mt-1">{cell.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
