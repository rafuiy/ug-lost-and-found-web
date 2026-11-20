import React, { useState, useMemo } from 'react';
import { AuditBadge } from './AdminBadges';
import {
  RiShieldCheckLine,
  RiSearchLine,
  RiFilter3Line,
  RiCalendarLine,
  RiCodeSSlashLine,
  RiDownload2Line,
  RiTimeLine,
  RiCheckboxCircleLine,
} from 'react-icons/ri';

export const AdminAuditLogPage = ({ logs, onOpenJsonModal }) => {
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAction !== 'ALL' && log.action !== selectedAction) {
        return false;
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
  }, [logs, selectedAction, searchQuery]);

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Audit Trail &amp; Log Keamanan
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B1259]">
              <RiShieldCheckLine className="w-4 h-4 text-amber-600" />
              <span>Immutable Log • Read Only</span>
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Rekam jejak seluruh mutasi status laporan, inventori, dan serah terima loket.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 transition-colors shrink-0"
        >
          <RiDownload2Line className="w-3.5 h-3.5 text-slate-500" />
          <span>Ekspor CSV Audit</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <RiSearchLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Admin ID, IP, atau Target ID..."
              className="w-full pl-10 pr-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <RiFilter3Line className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
            >
              <option value="ALL">ALL (Semua Aksi)</option>
              <option value="STATUS_UPDATE">STATUS_UPDATE</option>
              <option value="HANDOVER_EXECUTE">HANDOVER_EXECUTE</option>
              <option value="REPORT_REJECT">REPORT_REJECT</option>
              <option value="STALE_FLAGGED">STALE_FLAGGED</option>
              <option value="INV_MATCH">INV_MATCH</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <RiCalendarLine className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
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
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5 w-48">Timestamp (WIB)</th>
                <th className="py-3.5 px-4 w-48">Petugas / Aktor</th>
                <th className="py-3.5 px-4 w-44">Aksi</th>
                <th className="py-3.5 px-4 w-48">Target Tabel &amp; ID</th>
                <th className="py-3.5 px-4">Detail Payload</th>
                <th className="py-3.5 px-5 w-36 font-mono">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <RiTimeLine className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">Tidak ada log audit yang sesuai filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const truncatedPayload = JSON.stringify(log.payload);
                  const isShort = truncatedPayload.length < 48;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap font-mono text-xs">
                        <span className="text-slate-800">{log.timestamp}</span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{log.id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 text-sm">{log.actorName}</div>
                        <div className="font-mono text-xs text-[#3B1259] font-medium mt-0.5">
                          {log.actorId}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <AuditBadge action={log.action} />
                      </td>

                      <td className="py-4 px-4 font-mono text-xs font-medium text-slate-800 whitespace-nowrap">
                        {log.targetTable}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <code
                            className="text-xs text-slate-600 truncate max-w-xs block font-mono"
                            title={truncatedPayload}
                          >
                            {isShort ? truncatedPayload : `${truncatedPayload.slice(0, 44)}...`}
                          </code>
                          <button
                            type="button"
                            onClick={() => onOpenJsonModal(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors shrink-0"
                          >
                            <RiCodeSSlashLine className="w-3.5 h-3.5 text-[#3B1259]" />
                            <span>Lihat JSON</span>
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-5 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <RiCheckboxCircleLine className="w-4 h-4 text-emerald-600" />
            <span>Audit Trail terverifikasi dan terkunci otomatis (append-only).</span>
          </div>
          <div className="font-mono text-[11px]">{filteredLogs.length} Entries • Read-Only</div>
        </div>
      </div>
    </div>
  );
};
