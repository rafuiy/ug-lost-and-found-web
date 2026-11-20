export const AdminStatsCards = ({
  counts,
  activeFilterTab = 'Semua',
  onlyStale = false,
  onSelectStatus,
  onToggleStale,
}) => {
  const cards = [
    {
      key: 'Belum Ada',
      title: 'Belum Ada',
      value: counts.belumAda,
      subtitle: 'Menunggu pencocokan',
      dotColor: 'bg-ug-700',
      valueColor: 'text-ug-800',
      activeRing: 'border-ug-800 bg-ug-100/70 ring-1 ring-ug-700',
      isActive: activeFilterTab === 'Belum Ada',
      onClick: () =>
        onSelectStatus?.(activeFilterTab === 'Belum Ada' ? 'Semua' : 'Belum Ada'),
    },
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      dotColor: 'bg-ug-500',
      valueColor: 'text-ug-700',
      activeRing: 'border-ug-800 bg-ug-100/70 ring-1 ring-ug-700',
      isActive: activeFilterTab === 'Perlu Verifikasi',
      onClick: () =>
        onSelectStatus?.(
          activeFilterTab === 'Perlu Verifikasi' ? 'Semua' : 'Perlu Verifikasi'
        ),
    },
    {
      key: 'Lawas >30h',
      title: 'Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      dotColor: 'bg-gold-ink',
      valueColor: 'text-gold-ink',
      activeRing: 'border-gold-ink bg-gold-wash ring-1 ring-gold-ink',
      isActive: onlyStale,
      onClick: () => onToggleStale?.(),
    },
    {
      key: 'Selesai',
      title: 'Selesai',
      value: counts.selesai,
      subtitle: 'Serah terima tuntas',
      dotColor: 'bg-ok',
      valueColor: 'text-ok',
      activeRing: 'border-ok bg-ok-wash/60 ring-1 ring-ok',
      isActive: activeFilterTab === 'Selesai',
      onClick: () => onSelectStatus?.(activeFilterTab === 'Selesai' ? 'Semua' : 'Selesai'),
    },
    {
      key: 'Ditolak',
      title: 'Ditolak',
      value: counts.ditolak ?? 0,
      subtitle: 'Laporan tidak valid',
      dotColor: 'bg-danger',
      valueColor: 'text-danger',
      activeRing: 'border-danger bg-danger-wash/60 ring-1 ring-danger',
      isActive: activeFilterTab === 'Ditolak',
      onClick: () => onSelectStatus?.(activeFilterTab === 'Ditolak' ? 'Semua' : 'Ditolak'),
    },
    {
      key: 'Dibatalkan',
      title: 'Dibatalkan',
      value: counts.dibatalkan ?? 0,
      subtitle: 'Hasil revert status',
      dotColor: 'bg-ink-3',
      valueColor: 'text-ink-2',
      activeRing: 'border-ink bg-paper ring-1 ring-ink',
      isActive: activeFilterTab === 'Dibatalkan',
      onClick: () =>
        onSelectStatus?.(activeFilterTab === 'Dibatalkan' ? 'Semua' : 'Dibatalkan'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          aria-pressed={card.isActive}
          onClick={card.onClick}
          className={`rounded-[5px] border-[1.5px] p-4 flex flex-col justify-between text-left transition-all cursor-pointer ${
            card.isActive
              ? card.activeRing
              : 'border-line-strong bg-sheet hover:border-ink-2 hover:bg-paper/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-bold text-ink truncate">{card.title}</span>
            <span
              className={`size-2 rounded-full shrink-0 ${card.dotColor}`}
              aria-hidden="true"
            />
          </div>

          <div className="mt-3">
            <div
              className={`text-3xl font-bold tabular-nums tracking-[-0.03em] leading-none ${card.valueColor}`}
            >
              {card.value}
            </div>
            <div className="text-[11px] font-medium text-ink-3 mt-1.5 truncate">
              {card.subtitle}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
