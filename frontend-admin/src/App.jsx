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
import { AdminLoginPage } from './components/AdminLoginPage';
import { SecureFileModal } from './components/SecureFileModal';
import { JsonViewerModal } from './components/JsonViewerModal';
import { NotificationToast } from './components/NotificationToast';
import { Button } from './components/ui/Button';
import { clearStoredSession, getStoredSession } from './services/auth';
import { LuLogOut } from 'react-icons/lu';

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
  const [currentOfficer, setCurrentOfficer] = useState(() => getStoredSession());
  const [loginNotice, setLoginNotice] = useState('');
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

  useEffect(() => {
    if (!currentOfficer && window.location.pathname !== '/login') {
      window.history.replaceState({}, '', '/login');
    } else if (currentOfficer && window.location.pathname === '/login') {
      window.history.replaceState({}, '', ADMIN_TAB_PATHS.queue);
    }
  }, [currentOfficer]);

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
    actorName = currentOfficer?.name || 'Budi Santoso',
    actorId = currentOfficer?.id || 'ADM-04D'
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
      officer: `${currentOfficer?.name || 'Budi Santoso'} (${currentOfficer?.id || 'ADM-04D'})`,
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
      officer: `${currentOfficer?.name || 'Budi Santoso'} (${currentOfficer?.id || 'ADM-04D'})`,
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

  const handleLoginSuccess = (officer) => {
    setCurrentOfficer(officer);
    setLoginNotice('');
    setActiveTab('queue');
    if (window.location.pathname !== ADMIN_TAB_PATHS.queue) {
      window.history.pushState({}, '', ADMIN_TAB_PATHS.queue);
    }
    addToast('success', 'Sesi Dimulai', `Selamat bertugas, ${officer.name} (${officer.id}).`);
  };

  const handleConfirmLogout = () => {
    clearStoredSession();
    setIsLogoutModalOpen(false);
    setIsDrawerOpen(false);
    setSecureFileModal((prev) => ({ ...prev, isOpen: false }));
    setActiveJsonLog(null);
    setSelectedTicketCode(null);
    setCurrentOfficer(null);
    setLoginNotice('Sesi petugas telah diakhiri. Silakan masuk kembali untuk mengakses panel.');
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
    }
  };

  if (!currentOfficer) {
    return (
      <AdminLoginPage
        onLoginSuccess={handleLoginSuccess}
        sessionNotice={loginNotice}
      />
    );
  }

  const statsCounts = {
    belumAda: reports.filter((r) => r.status === 'Belum Ada').length,
    perluVerifikasi: reports.filter((r) => r.status === 'Perlu Verifikasi').length,
    lawas: reports.filter((r) => r.isStale).length,
    selesai: reports.filter((r) => r.status === 'Selesai').length,
  };

  return (
    <div className="min-h-svh bg-paper text-ink flex flex-col font-sans">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-ug-950"
      >
        Lewati ke konten
      </a>

      <AdminNavbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        queueCount={statsCounts.belumAda}
        officer={currentOfficer}
      />

      <main id="konten" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-line-strong">
              <div>
                <h1 className="text-2xl font-bold text-ink tracking-[-0.03em]">
                  Antrean Laporan Mahasiswa
                </h1>
                <p className="text-sm text-ink-2 mt-1">
                  Tinjau laporan masuk, cocokkan dengan inventori fisik, dan terbitkan undangan verifikasi loket.
                </p>
              </div>

              <span className="text-xs font-semibold text-ink-2 bg-sheet px-3 py-1.5 rounded-sm border-[1.5px] border-line-strong tabular-nums shrink-0">
                Shift Loket D · 08:00 - 16:00 WIB
              </span>
            </div>

            <AdminStatsCards counts={statsCounts} />

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
            key={handoverPreloadTicket || 'default'}
            reports={reports}
            inventoryList={inventoryList}
            initialTicketCode={handoverPreloadTicket}
            onCompleteHandover={handleCompleteHandover}
            onBackToQueue={() => handleSelectTab('queue')}
          />
        )}

        {activeTab === 'audit' && (
          <AdminAuditLogPage
            logs={auditLogs}
            onOpenJsonModal={(entry) => setActiveJsonLog(entry)}
          />
        )}
      </main>

      <footer className="border-t border-line-strong bg-sheet/70 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 px-4 sm:px-6 py-6 text-[13px] text-ink-3 md:flex-row md:items-baseline md:justify-between">
          <span className="font-bold text-ink">
            UG Lost &amp; Found — Panel Petugas Loket
          </span>
          <p>Layanan internal Universitas Gunadarma</p>
        </div>
      </footer>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ug-950/65">
          <div className="bg-sheet border-2 border-ink rounded-[5px] p-6 max-w-sm w-full shadow-[4px_4px_0_var(--color-ink)] space-y-4">
            <div className="flex items-start gap-3">
              <LuLogOut className="size-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-base font-bold text-ink">Konfirmasi Keluar</h3>
                <p className="text-xs text-ink-3 mt-0.5">
                  Sesi Petugas {currentOfficer.desk} ({currentOfficer.name})
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-2 bg-paper p-3.5 rounded-sm border border-line-strong leading-relaxed">
              Seluruh perubahan status dan log audit yang telah dieksekusi tersimpan aman.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLogoutModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                variant="ug"
                size="sm"
                onClick={handleConfirmLogout}
              >
                Keluar Sesi
              </Button>
            </div>
          </div>
        </div>
      )}

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
