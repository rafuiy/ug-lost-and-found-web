import { STALE_LABEL } from '../../data/statuses'
import { formatDateTime } from '../../utils/format'
import { Stamp, StatusStamp } from './Stamp'

// The product's one physical artifact, reused on the hero, the submit result and tracking.
export function Ticket({ code, status, isStale = false, reportedAt, className = '' }) {
  return (
    <div className={`relative flex rounded-md border-2 border-ug-950 bg-gold text-ug-950 shadow-[6px_6px_0_var(--color-ug-950)] ${className}`}>
      <div className="min-w-0 flex-1 px-4 pb-4 pt-3 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Tiket kehilangan</p>
        <p className="mt-3 whitespace-nowrap font-bold leading-none tracking-[0.02em] tabular-nums text-[clamp(1.6rem,7vw,2.5rem)] lg:text-[clamp(1.75rem,2.6vw,2.5rem)]">
          {code}
        </p>
        <p className="mt-3 border-t-2 border-dotted border-ug-950/40 pt-2 text-xs font-medium">
          Dilaporkan <time dateTime={reportedAt}>{formatDateTime(reportedAt)}</time>
        </p>
      </div>

      <div aria-hidden="true" className="my-2 border-l-2 border-dashed border-ug-950/50" />

      <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 px-2 py-3 sm:w-36">
        <span className="sr-only">Status:</span>
        <StatusStamp status={status} tone="ink" rotate={-8} wrap className="max-w-full self-center max-sm:px-2 max-sm:text-[11px]" />
        {isStale && <Stamp tone="ink" size="sm" rotate={3}>{STALE_LABEL}</Stamp>}
      </div>
    </div>
  )
}
