import React from 'react';
import { RiTimeLine } from 'react-icons/ri';

export const StatusBadge = ({ status }) => {
  switch (status) {
    case 'Belum Ada':
      return (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          Belum Ada
        </span>
      );
    case 'Perlu Verifikasi':
      return (
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          Perlu Verifikasi
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          Selesai
        </span>
      );
    case 'Ditolak':
      return (
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
          Ditolak
        </span>
      );
    default:
      return null;
  }
};

export const StaleBadge = ({ label = 'Lawas >30h' }) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700">
      <RiTimeLine className="w-3.5 h-3.5 text-orange-600 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
};

export const CategoryBadge = ({ category }) => {
  return <span className="text-xs text-slate-500">{category}</span>;
};

export const AuditBadge = ({ action }) => {
  switch (action) {
    case 'STATUS_UPDATE':
      return <span className="text-xs font-mono font-semibold text-blue-700">STATUS_UPDATE</span>;
    case 'HANDOVER_EXECUTE':
      return <span className="text-xs font-mono font-semibold text-emerald-700">HANDOVER_EXECUTE</span>;
    case 'REPORT_REJECT':
      return <span className="text-xs font-mono font-semibold text-rose-700">REPORT_REJECT</span>;
    case 'STALE_FLAGGED':
      return <span className="text-xs font-mono font-semibold text-orange-700">STALE_FLAGGED</span>;
    case 'INV_MATCH':
      return <span className="text-xs font-mono font-semibold text-purple-800">INV_MATCH</span>;
    default:
      return <span className="text-xs font-mono font-semibold text-slate-700">{action}</span>;
  }
};
