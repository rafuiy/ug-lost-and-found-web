import { LuClock } from 'react-icons/lu';
import { StatusStamp } from './ui/Stamp';

const VALID_REPORT_STATUSES = new Set([
  'Belum Ada',
  'Perlu Verifikasi',
  'Selesai',
  'Ditolak',
]);

export const StatusBadge = ({ status }) => {
  if (!VALID_REPORT_STATUSES.has(status)) return null;
  return <StatusStamp status={status} size="sm" className="bg-sheet/80" />;
};

export const StaleBadge = ({ label = 'Lawas >30h' }) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-ink">
      <LuClock className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
};

export const CategoryBadge = ({ category }) => {
  return <span className="text-xs font-medium text-ink-3">{category}</span>;
};

const AUDIT_COLORS = {
  STATUS_UPDATE: 'text-ug-700',
  HANDOVER_EXECUTE: 'text-ok',
  REPORT_REJECT: 'text-danger',
  STALE_FLAGGED: 'text-gold-ink',
  INV_MATCH: 'text-ink',
};

export const AuditBadge = ({ action }) => {
  const colorClass = AUDIT_COLORS[action] || 'text-ink-2';
  return (
    <span className={`text-xs font-bold uppercase tracking-[0.06em] ${colorClass}`}>
      {action}
    </span>
  );
};
