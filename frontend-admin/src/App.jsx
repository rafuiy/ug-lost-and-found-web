import { useState, useEffect } from 'react';
import {
  INITIAL_REPORTS,
  INITIAL_INVENTORY,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import { AdminNavbar } from './components/AdminNavbar';
import { AdminStatsCards } from './components/AdminStatsCards';
import { AdminReportQueue } from './components/AdminReportQueue';
import { AdminReviewDrawer } from './components/AdminReviewDrawer';
import { AdminHandoverPage } from './components/AdminHandoverPage';
import { AdminAuditLogPage } from './components/AdminAuditLogPage';
import { AdminInventoryPage } from './components/AdminInventoryPage';
import { SecureFileModal } from './components/SecureFileModal';
import { JsonViewerModal } from './components/JsonViewerModal';
import { NotificationToast } from './components/NotificationToast';
import { RiLogoutBoxRLine } from 'react-icons/ri';

const ADMIN_TAB_PATHS = {
  queue: '/antrean',
  inventory: '/inventori',
  handover: '/serah-terima',
  audit: '/audit',
};

function parseAdminTabFromPath(pathname) {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/inventori') return 'inventory';
  if (path === '/serah-terima') return 'handover';
  if (path === '/audit' || path === '/audit-log') return 'audit';
  return 'queue';
}

export function App() {
  const [activeTab, setActiveTab] = useState(() =>
    parseAdminTabFromPath(window.location.pathname)
  );
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [inventoryList, setInventoryList] = useState(INITIAL_INVENTORY);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [toasts, setToasts] = useState([]);

  const [activeFilterTab, setActiveFilterTab] = useState('Semua');
  const [selectedTicketCode, setSelectedTicketCode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [handoverPreloadTicket, setHandoverPreloadTicket] = useState('');
  const [activeJsonLog, setActiveJsonLog] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [secureFileModal, setSecureFileModal] = useState({
    isOpen: false,
    title: '',
    fileUrl: '',
    fileType: 'ktm',
    studentName: undefined,
    studentNpm: undefined,
    ticketCode: undefined,
  });

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(parseAdminTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    const targetPath = ADMIN_TAB_PATHS[tab];
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToast = (type, title, message) => {
    const newToast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const appendAuditLog = (
    action,
    targetTable,
    targetId,
    payload,
    actorName = 'Budi Santoso',
    actorId = 'ADM-04D'
  ) => {
    const now = new Date();
    const formattedTimestamp = now.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';

    const newLog = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: formattedTimestamp,
      actorName,
      actorId,
      action,
      targetTable,
      targetId,
      payload,
      ipAddress: '10.24.110.15',
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const selectedReport = selectedTicketCode
    ? reports.find((r) => r.ticketCode === selectedTicketCode) || null
    : null;

  const handleReviewReport = (report) => {
    setSelectedTicketCode(report.ticketCode);
    setIsDrawerOpen(true);
  };

  const handleOpenSecureFile = (title, url, type) => {
    if (!selectedReport) return;
    setSecureFileModal({
      isOpen: true,
      title,
      fileUrl: url,
      fileType: type,
      studentName: selectedReport.reporterName,
      studentNpm: selectedReport.reporterNpm,
      ticketCode: selectedReport.ticketCode,
    });
  };

  const handleIssueInvitation = (reportCode, matchedInventoryId, notes) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              status: 'Perlu Verifikasi',
              matchedInventoryId: matchedInventoryId || r.matchedInventoryId,
              adminNotes: notes || r.adminNotes,
            }
          : r
      )
    );

    appendAuditLog('STATUS_UPDATE', `reports: ${reportCode}`, reportCode, {
      action: 'ISSUE_VERIFICATION_INVITATION',
      ticket_code: reportCode,
      previous_status: target?.status || 'Belum Ada',
      new_status: 'Perlu Verifikasi',
      matched_inventory_id: matchedInventoryId,
      dispatched_to: target?.reporterEmail,
      loket_desk: 'Loket D Margonda',
    });

    addToast(
      'success',
      'Undangan Loket Diterbitkan',
      `Status tiket ${reportCode} kini 'Perlu Verifikasi'. Email dikirim ke ${target?.reporterEmail}.`
    );
  };

  const handleRejectReport = (reportCode, reason) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              status: 'Ditolak',
              adminNotes: `Alasan Ditolak: ${reason}`,
              publicRejectReason: reason,
            }
          : r
      )
    );

    appendAuditLog('REPORT_REJECT', `reports: ${reportCode}`, reportCode, {
      action: 'REJECT_TICKET',
      ticket_code: reportCode,
      previous_status: target?.status || 'Belum Ada',
      new_status: 'Ditolak',
      reason,
      officer: 'Budi Santoso (ADM-04D)',
    });

    addToast('warning', 'Laporan Ditolak', `Tiket ${reportCode} telah ditolak.`);
  };

  const handleSaveNotes = (reportCode, notes) => {
    setReports((prev) =>
      prev.map((r) => (r.ticketCode === reportCode ? { ...r, adminNotes: notes } : r))
    );
    addToast('info', 'Catatan Disimpan', `Catatan internal tiket ${reportCode} diperbarui.`);
  };

  const handleCompleteHandover = (params) => {
    let matchedInvId;
    setReports((prev) =>
      prev.map((r) => {
        if (r.ticketCode === params.ticketCode) {
          matchedInvId = r.matchedInventoryId;
          return {
            ...r,
            status: 'Selesai',
            adminNotes: `${r.adminNotes ? r.adminNotes + ' | ' : ''}Serah terima selesai kepada ${
              params.recipientName
            } (${params.recipientNpm}). Catatan: ${params.notes}`,
          };
        }
        return r;
      })
    );

    if (matchedInvId) {
      setInventoryList((prev) =>
        prev.map((inv) =>
          inv.id === matchedInvId
            ? {
                ...inv,
                status: 'Diambil',
                notes: `${inv.notes} [DIAMBIL pada ${new Date().toLocaleDateString('id-ID')} oleh ${
                  params.recipientName
                }]`,
              }
            : inv
        )
      );
    }

    appendAuditLog('HANDOVER_EXECUTE', `reports: ${params.ticketCode}`, params.ticketCode, {
      action: 'PHYSICAL_HANDOVER',
      ticket_code: params.ticketCode,
      recipient_name: params.recipientName,
      recipient_npm: params.recipientNpm,
      matched_inventory_id: matchedInvId || 'N/A',
      officer_notes: params.notes,
      ktm_verified_physically: true,
      secret_feature_proven: true,
      photo_evidence_uploaded: true,
      officer: 'Budi Santoso (ADM-04D)',
      desk: 'Loket D Margonda',
    });

    addToast(
      'success',
      'Serah Terima Sukses',
      `Tiket ${params.ticketCode} resmi 'Selesai' & inventori diubah menjadi 'Diambil'.`
    );
  };

  const handleGoToHandoverFromDrawer = (ticketCode) => {
    setIsDrawerOpen(false);
    setHandoverPreloadTicket(ticketCode);
    handleSelectTab('handover');
  };

  const handleSelectToMatchFromInventory = (inventoryId) => {
    const matched = reports.find((r) => r.matchedInventoryId === inventoryId);
    if (matched) {
      setSelectedTicketCode(matched.ticketCode);
      setIsDrawerOpen(true);
      handleSelectTab('queue');
    } else {
      handleSelectTab('queue');
      addToast(
        'info',
        'Pilih Pengaduan',
        `Silakan pilih laporan di antrean untuk mencocokkan dengan ${inventoryId}.`
      );
    }
  };

  const statsCounts = {
    belumAda: reports.filter((r) => r.status === 'Belum Ada').length,
    perluVerifikasi: reports.filter((r) => r.status === 'Perlu Verifikasi').length,
    lawas: reports.filter((r) => r.isStale).length,
    selesai: reports.filter((r) => r.status === 'Selesai').length,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-700 flex flex-col font-sans">
      <AdminNavbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        queueCount={statsCounts.belumAda}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Antrean Laporan Mahasiswa
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Tinjau laporan masuk, cocokkan dengan inventori fisik, dan terbitkan undangan verifikasi loket.
                </p>
              </div>

              <span className="text-xs text-slate-500 font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                Shift Loket D • 08:00 - 16:00 WIB
              </span>
            </div>

            <AdminStatsCards
              activeFilter={activeFilterTab}
              onFilterSelect={(filter) => setActiveFilterTab(filter)}
              counts={statsCounts}
            />

            <AdminReportQueue
              reports={reports}
              onReviewReport={handleReviewReport}
              activeFilterTab={activeFilterTab}
              onFilterTabChange={setActiveFilterTab}
            />
          </div>
        )}

        {activeTab === 'inventory' && (
          <AdminInventoryPage
            inventoryList={inventoryList}
            onSelectToMatch={handleSelectToMatchFromInventory}
          />
        )}

        {activeTab === 'handover' && (
          <AdminHandoverPage
            reports={reports}
            inventoryList={inventoryList}
            initialTicketCode={handoverPreloadTicket}
            onCompleteHandover={handleCompleteHandover}
            onBackToQueue={() => handleSelectTab('queue')}
          />
        )}

        {activeTab === 'audit' && (
          <AdminAuditLogPage logs={auditLogs} onOpenJsonModal={(entry) => setActiveJsonLog(entry)} />
        )}
      </main>

      <AdminReviewDrawer
        report={selectedReport}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        inventoryList={inventoryList}
        onIssueInvitation={handleIssueInvitation}
        onRejectReport={(code, reason) => {
          handleRejectReport(code, reason);
          setIsDrawerOpen(false);
        }}
        onSaveNotes={handleSaveNotes}
        onOpenSecureFile={handleOpenSecureFile}
        onGoToHandover={handleGoToHandoverFromDrawer}
      />

      <SecureFileModal
        isOpen={secureFileModal.isOpen}
        onClose={() => setSecureFileModal((prev) => ({ ...prev, isOpen: false }))}
        title={secureFileModal.title}
        fileUrl={secureFileModal.fileUrl}
        fileType={secureFileModal.fileType}
        studentName={secureFileModal.studentName}
        studentNpm={secureFileModal.studentNpm}
        ticketCode={secureFileModal.ticketCode}
      />

      <JsonViewerModal entry={activeJsonLog} onClose={() => setActiveJsonLog(null)} />

      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <RiLogoutBoxRLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Keluar</h3>
                <p className="text-xs text-slate-500">
                  Sesi Petugas Loket D (Budi Santoso)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 leading-relaxed">
              Seluruh perubahan status dan log audit yang telah dieksekusi tersimpan aman.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  addToast('info', 'Sesi Diakhiri', 'Logout berhasil dari Panel Petugas Loket.');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3B1259] hover:bg-[#581C87] rounded-xl transition-colors"
              >
                Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
