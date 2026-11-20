import {
  LuInbox,
  LuShieldCheck,
  LuClock,
  LuCircleCheck,
  LuCircleX,
  LuRotateCcw,
} from 'react-icons/lu';

function LedgerCellButton({ cell }) {
  const Icon = cell.icon;
  return (
    <button
      type="button"
      aria-pressed={cell.isActive}
      onClick={cell.onClick}
      className={`p-3.5 sm:p-4 flex flex-col justify-between text-left transition-colors cursor-pointer min-w-0 ${
        cell.isActive ? cell.activeBg : 'bg-sheet hover:bg-paper/80'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 w-full">
        <span className="text-xs font-bold text-ink truncate">{cell.title}</span>
        <Icon className={`size-3.5 shrink-0 ${cell.valueColor}`} aria-hidden="true" />
      </div>

      <div className="mt-2.5">
        <div
          className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-[-0.03em] leading-none ${cell.valueColor}`}
        >
          {cell.value}
        </div>
        <div className="text-[11px] font-medium text-ink-3 mt-1.5 truncate">
          {cell.subtitle}
        </div>
      </div>
    </button>
  );
}

export const AdminStatsCards = ({
  counts,
  activeFilterTab = 'Semua',
  onlyStale = false,
  onSelectStatus,
  onToggleStale,
}) => {
  const totalReports =
    (counts.belumAda || 0) +
    (counts.perluVerifikasi || 0) +
    (counts.selesai || 0) +
    (counts.ditolak || 0) +
    (counts.dibatalkan || 0);

  const isQueueActive = activeFilterTab === 'Belum Ada';

  const toggleStatus = (key) =>
    onSelectStatus?.(activeFilterTab === key ? 'Semua' : key);

  const actionableCells = [
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      icon: LuShieldCheck,
      valueColor: 'text-ug-700',
      activeBg: 'bg-ug-100/70 ring-2 ring-inset ring-ug-700',
      isActive: activeFilterTab === 'Perlu Verifikasi',
      onClick: () => toggleStatus('Perlu Verifikasi'),
    },
    {
      key: 'Lawas >30h',
      title: 'Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      icon: LuClock,
      valueColor: 'text-gold-ink',
      activeBg: 'bg-gold-wash ring-2 ring-inset ring-gold-ink',
      isActive: onlyStale,
      onClick: () => onToggleStale?.(),
    },
  ];

  const archiveCells = [
    {
      key: 'Selesai',
      title: 'Selesai',
      value: counts.selesai,
      subtitle: 'Diserahkan',
      icon: LuCircleCheck,
      valueColor: 'text-ok',
      activeBg: 'bg-ok-wash/60 ring-2 ring-inset ring-ok',
      isActive: activeFilterTab === 'Selesai',
      onClick: () => toggleStatus('Selesai'),
    },
    {
      key: 'Ditolak',
      title: 'Ditolak',
      value: counts.ditolak ?? 0,
      subtitle: 'Tidak valid',
      icon: LuCircleX,
      valueColor: 'text-danger',
      activeBg: 'bg-danger-wash/60 ring-2 ring-inset ring-danger',
      isActive: activeFilterTab === 'Ditolak',
      onClick: () => toggleStatus('Ditolak'),
    },
    {
      key: 'Dibatalkan',
      title: 'Dibatalkan',
      value: counts.dibatalkan ?? 0,
      subtitle: 'Hasil revert',
      icon: LuRotateCcw,
      valueColor: 'text-ink-2',
      activeBg: 'bg-paper ring-2 ring-inset ring-ink',
      isActive: activeFilterTab === 'Dibatalkan',
      onClick: () => toggleStatus('Dibatalkan'),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1.35fr_1.8fr] gap-4">
      {/* Zone 1: Dark Hero Card — Antrean Baru (Belum Ada) */}
      <button
        type="button"
        aria-pressed={isQueueActive}
        onClick={() => toggleStatus('Belum Ada')}
        className={`on-ug rounded-[5px] border-[1.5px] border-ug-950 bg-ug-950 text-sheet p-5 flex flex-col justify-between text-left shadow-[3px_3px_0_var(--color-ink)] transition-all cursor-pointer ${
          isQueueActive ? 'ring-2 ring-gold ring-offset-2 ring-offset-paper' : 'hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ug-200">
            <LuInbox className="size-3.5 text-gold shrink-0" aria-hidden="true" />
            <span>Antrean Baru</span>
          </span>
          <span className="rounded-[3px] bg-gold px-2 py-0.5 text-[11px] font-bold text-ug-950 tabular-nums">
            Total: {totalReports} Tiket
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4 w-full">
          <span className="text-4xl font-bold tabular-nums tracking-[-0.03em] leading-none text-gold">
            {counts.belumAda}
          </span>
          <span className="text-xs font-medium text-ug-200/85 text-right leading-snug">
            Belum Ada · menunggu pencocokan
          </span>
        </div>
      </button>

      {/* Zone 2: Tindak Lanjut Loket */}
      <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet overflow-hidden flex flex-col">
        <div className="bg-paper/80 border-b border-line-strong px-4 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
          <span>Tindak Lanjut Loket</span>
          <span className="tabular-nums text-ink-3">Aktif</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line flex-1">
          {actionableCells.map((cell) => (
            <LedgerCellButton key={cell.key} cell={cell} />
          ))}
        </div>
      </div>

      {/* Zone 3: Arsip & Status Akhir */}
      <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet overflow-hidden flex flex-col">
        <div className="bg-paper/80 border-b border-line-strong px-4 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
          <span>Arsip &amp; Status Akhir</span>
          <span className="tabular-nums text-ink-3">Selesai / Tutup</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line flex-1">
          {archiveCells.map((cell) => (
            <LedgerCellButton key={cell.key} cell={cell} />
          ))}
        </div>
      </div>
    </div>
  );
};
