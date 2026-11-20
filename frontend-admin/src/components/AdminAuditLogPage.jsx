import { useState, useMemo } from 'react';
import { AuditBadge } from './AdminBadges';
import { Button } from './ui/Button';
import { INPUT_CLASS } from './ui/styles';
import {
  LuShieldCheck,
  LuSearch,
  LuFilter,
  LuCalendar,
  LuCode,
  LuDownload,
  LuClock,
  LuCircleCheck,
} from 'react-icons/lu';

function parseWibTimestamp(ts) {
  if (!ts) return 0;
  const cleaned = ts.replace(' WIB', '').trim().replace(' ', 'T');
  const ms = Date.parse(cleaned);
  return Number.isNaN(ms) ? 0 : ms;
}

export const AdminAuditLogPage = ({ logs, onOpenJsonModal }) => {
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    if (logs.length === 0) return [];
    const refMs = logs.reduce((max, l) => Math.max(max, parseWibTimestamp(l.timestamp)), 0);
    const refDay = refMs ? new Date(refMs).toDateString() : '';

    return logs.filter((log) => {
      if (selectedAction !== 'ALL' && log.action !== selectedAction) {
        return false;
      }

      if (dateFilter !== 'ALL' && refMs) {
        const logMs = parseWibTimestamp(log.timestamp);
        if (logMs) {
          if (dateFilter === 'TODAY' && new Date(logMs).toDateString() !== refDay) {
            return false;
          }
          if (dateFilter === '7D' && refMs - logMs > 7 * 86400000) {
            return false;
          }
          if (dateFilter === '30D' && refMs - logMs > 30 * 86400000) {
            return false;
          }
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          log.actorId.toLowerCase().includes(query) ||
          log.actorName.toLowerCase().includes(query) ||
          log.ipAddress.toLowerCase().includes(query) ||
          log.targetTable.toLowerCase().includes(query) ||
          log.targetId.toLowerCase().includes(query) ||
          log.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [logs, selectedAction, dateFilter, searchQuery]);

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Petugas', 'Admin ID', 'Aksi', 'Target', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.actorName,
      l.actorId,
      l.action,
      l.targetTable,
      l.ipAddress,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ug-lost-found-audit-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-line-strong">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink tracking-[-0.03em]">
              Audit Trail &amp; Log Keamanan
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ug-700">
              <LuShieldCheck className="size-4" aria-hidden="true" />
              <span>Immutable Log · Read Only</span>
            </span>
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Rekam jejak seluruh mutasi status laporan, inventori, dan serah terima loket.
          </p>
        </div>

        <Button
          variant="outline"
          size="md"
          onClick={handleExportCsv}
          className="shrink-0"
        >
          <LuDownload className="size-4" aria-hidden="true" />
          <span>Ekspor CSV Audit</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <LuSearch
              className="size-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Admin ID, IP, atau Target ID..."
              className={`${INPUT_CLASS} h-10 pl-10`}
            />
          </div>

          <div className="flex items-center gap-2">
            <LuFilter className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              aria-label="Filter jenis aksi audit"
              className={`${INPUT_CLASS} h-10 font-semibold`}
            >
              <option value="ALL">ALL (Semua Aksi)</option>
              <option value="STATUS_UPDATE">STATUS_UPDATE</option>
              <option value="HANDOVER_EXECUTE">HANDOVER_EXECUTE</option>
              <option value="REPORT_REJECT">REPORT_REJECT</option>
              <option value="STALE_FLAGGED">STALE_FLAGGED</option>
              <option value="INV_MATCH">INV_MATCH</option>
              <option value="INV_CREATE">INV_CREATE</option>
              <option value="INV_UPDATE">INV_UPDATE</option>
              <option value="STALE_RESTORE">STALE_RESTORE</option>
              <option value="STATUS_REVERT">STATUS_REVERT</option>
              <option value="HANDOVER_VOID">HANDOVER_VOID</option>
              <option value="INV_DELETE">INV_DELETE</option>
              <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
              <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
              <option value="AUTH_LOGOUT">AUTH_LOGOUT</option>
              <option value="INVENTORY_CREATED">INVENTORY_CREATED</option>
              <option value="INVENTORY_UPDATED">INVENTORY_UPDATED</option>
              <option value="REPORT_CREATED">REPORT_CREATED</option>
              <option value="REPORT_STATUS_UPDATED">REPORT_STATUS_UPDATED</option>
              <option value="REPORT_REJECTED">REPORT_REJECTED</option>
              <option value="REPORT_NOTES_UPDATED">REPORT_NOTES_UPDATED</option>
              <option value="REPORT_RESTORED">REPORT_RESTORED</option>
              <option value="REPORT_FILE_ACCESSED">REPORT_FILE_ACCESSED</option>
              <option value="HANDOVER_COMPLETED">HANDOVER_COMPLETED</option>
              <option value="REPORT_MARKED_STALE">REPORT_MARKED_STALE</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <LuCalendar className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter rentang waktu audit"
              className={`${INPUT_CLASS} h-10 font-semibold`}
            >
              <option value="ALL">Rentang: Seluruh Rekam Jejak</option>
              <option value="TODAY">Hari Ini</option>
              <option value="7D">7 Hari Terakhir</option>
              <option value="30D">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-paper border-b-[1.5px] border-line-strong text-[11px] font-bold text-ink-2 uppercase tracking-[0.08em]">
                <th className="py-3.5 px-5 w-48">Timestamp (WIB)</th>
                <th className="py-3.5 px-4 w-48">Petugas / Aktor</th>
                <th className="py-3.5 px-4 w-44">Aksi</th>
                <th className="py-3.5 px-4 w-48">Target Tabel &amp; ID</th>
                <th className="py-3.5 px-4">Detail Payload</th>
                <th className="py-3.5 px-5 w-36">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-ink-3">
                    <LuClock className="size-6 text-ink-3 mx-auto mb-2" aria-hidden="true" />
                    <p className="font-bold text-ink">Tidak ada log audit yang sesuai filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const truncatedPayload = JSON.stringify(log.payload);
                  const isShort = truncatedPayload.length < 48;

                  return (
                    <tr key={log.id} className="hover:bg-ug-100/40 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap text-xs tabular-nums">
                        <span className="font-semibold text-ink">{log.timestamp}</span>
                        <div className="text-[11px] text-ink-3 mt-0.5">{log.id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-ink text-sm">{log.actorName}</div>
                        <div className="text-xs text-ug-700 font-bold tabular-nums mt-0.5">
                          {log.actorId}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <AuditBadge action={log.action} />
                      </td>

                      <td className="py-4 px-4 text-xs font-semibold text-ink tabular-nums whitespace-nowrap">
                        {log.targetTable}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <code
                            className="text-xs text-ink-2 truncate max-w-xs block font-mono"
                            title={truncatedPayload}
                          >
                            {isShort ? truncatedPayload : `${truncatedPayload.slice(0, 44)}...`}
                          </code>
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => onOpenJsonModal(log)}
                            className="shrink-0"
                          >
                            <LuCode className="size-4 text-ug-700" aria-hidden="true" />
                            <span>Lihat JSON</span>
                          </Button>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-xs font-medium text-ink-2 tabular-nums whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-paper border-t border-line-strong flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-2 tabular-nums">
          <div className="flex items-center gap-2">
            <LuCircleCheck className="size-4 text-ok shrink-0" aria-hidden="true" />
            <span>Audit Trail terverifikasi dan terkunci otomatis (append-only).</span>
          </div>
          <div className="text-[11px] font-semibold text-ink-3">
            {filteredLogs.length} Entries · Read-Only
          </div>
        </div>
      </div>
    </div>
  );
};
