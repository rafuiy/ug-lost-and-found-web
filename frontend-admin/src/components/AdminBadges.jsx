import { LuClock } from 'react-icons/lu';

const STATUS_STYLES = {
  'Belum Ada': 'bg-paper border-line-strong text-ink-2',
  'Perlu Verifikasi': 'bg-ug-100 border-ug-200 text-ug-800',
  Selesai: 'bg-ok-wash border-ok/30 text-ok',
  Ditolak: 'bg-danger-wash border-danger/30 text-danger',
  Dibatalkan: 'bg-paper border-ink-3/40 text-ink-2',
  Tersimpan: 'bg-gold-wash border-gold-ink/35 text-gold-ink',
  Diambil: 'bg-ok-wash border-ok/30 text-ok',
};

export const StatusBadge = ({ status, className = '' }) => {
  const toneClass = STATUS_STYLES[status];
  if (!toneClass) return null;

  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-2.5 py-1 text-xs font-semibold leading-none tracking-[0.01em] whitespace-nowrap ${toneClass} ${className}`}
    >
      {status}
    </span>
  );
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
  INV_CREATE: 'text-ug-700',
  INV_UPDATE: 'text-ug-800',
  STALE_RESTORE: 'text-ug-700',
  STATUS_REVERT: 'text-gold-ink',
  HANDOVER_VOID: 'text-danger',
  INV_DELETE: 'text-danger',
  AUTH_LOGIN_SUCCESS: 'text-ok',
  AUTH_LOGIN_FAILED: 'text-danger',
  AUTH_LOGOUT: 'text-ink-2',
  INVENTORY_CREATED: 'text-ug-700',
  INVENTORY_UPDATED: 'text-ug-800',
  INVENTORY_DELETED: 'text-danger',
  REPORT_CREATED: 'text-ug-700',
  REPORT_REOPENED: 'text-ug-700',
  REPORT_STATUS_UPDATED: 'text-ug-700',
  REPORT_REJECTED: 'text-danger',
  REPORT_NOTES_UPDATED: 'text-ink-2',
  REPORT_RESTORED: 'text-ug-700',
  REPORT_FILE_ACCESSED: 'text-gold-ink',
  HANDOVER_COMPLETED: 'text-ok',
  REPORT_MARKED_STALE: 'text-gold-ink',
};

export const AuditBadge = ({ action }) => {
  const colorClass = AUDIT_COLORS[action] || 'text-ink-2';
  return (
    <span className={`text-xs font-bold uppercase tracking-[0.06em] ${colorClass}`}>
      {action}
    </span>
  );
};
