import React from 'react';
import {
  RiInboxArchiveLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiArrowRightLine,
  RiTimeLine,
} from 'react-icons/ri';

export const AdminStatsCards = ({ activeFilter, onFilterSelect, counts }) => {
  const cards = [
    {
      key: 'Belum Ada',
      title: 'Antrean Baru',
      value: counts.belumAda,
      subtitle: 'Menunggu pencocokan',
      icon: <RiInboxArchiveLine className="w-5 h-5" />,
      iconBg: 'bg-purple-100 text-[#3B1259]',
      valueColor: 'text-slate-900',
      activeRing: 'border-[#3B1259] ring-1 ring-[#3B1259]',
    },
    {
      key: 'Perlu Verifikasi',
      title: 'Perlu Verifikasi',
      value: counts.perluVerifikasi,
      subtitle: 'Diundang ke loket',
      icon: <RiAlertLine className="w-5 h-5" />,
      iconBg: 'bg-amber-100 text-amber-800',
      valueColor: 'text-amber-700',
      activeRing: 'border-amber-600 ring-1 ring-amber-600',
    },
    {
      key: 'Lawas >30h',
      title: 'Laporan Lawas (>30h)',
      value: counts.lawas,
      subtitle: 'Perlu tinjauan ulang',
      icon: <RiTimeLine className="w-5 h-5" />,
      iconBg: 'bg-orange-100 text-orange-800',
      valueColor: 'text-orange-700',
      activeRing: 'border-orange-600 ring-1 ring-orange-600',
    },
    {
      key: 'Selesai',
      title: 'Selesai Diserahkan',
      value: counts.selesai,
      subtitle: 'Handover terverifikasi',
      icon: <RiCheckboxCircleLine className="w-5 h-5" />,
      iconBg: 'bg-emerald-100 text-emerald-800',
      valueColor: 'text-emerald-700',
      activeRing: 'border-emerald-600 ring-1 ring-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onFilterSelect && onFilterSelect(isActive ? 'Semua' : card.key)}
            className={`text-left bg-white border rounded-2xl p-5 shadow-sm transition-colors flex flex-col justify-between ${
              isActive ? card.activeRing : 'border-slate-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-start justify-between w-full">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                {card.icon}
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                <span>Filter</span>
                <RiArrowRightLine className="w-3 h-3" />
              </span>
            </div>

            <div className="mt-4">
              <div className={`text-3xl font-bold font-mono tracking-tight ${card.valueColor}`}>
                {card.value}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-1">{card.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.subtitle}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
