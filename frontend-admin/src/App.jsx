import { useState, useEffect, useCallback } from 'react';
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
import {
  clearStoredSession,
  getStoredSession,
  isHighPrivilegeOfficer,
  logoutOfficer,
} from './services/auth';
import {
  createHandover,
  createInventory,
  deleteInventory,
  fetchAuditLogs,
  fetchInventories,
  fetchReportDetailWithFiles,
  fetchReports,
  restoreStaleReport,
  updateInventory,
  updateReportNotes,
  updateReportStatus,
} from './services/adminApi';
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
  const [reports, setReports] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [apiReportCounts, setApiReportCounts] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [activeFilterTab, setActiveFilterTab] = useState('Semua');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
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

  const isHighPrivilege = isHighPrivilegeOfficer(currentOfficer);
  const effectiveTab = activeTab === 'audit' && !isHighPrivilege ? 'queue' : activeTab;

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
    } else if (
      currentOfficer &&
      !isHighPrivilege &&
      (window.location.pathname === '/audit' || window.location.pathname === '/audit-log')
    ) {
      window.history.replaceState({}, '', ADMIN_TAB_PATHS.queue);
    }
  }, [currentOfficer, isHighPrivilege]);

  const handleSelectTab = (tab) => {
    const nextTab = tab === 'audit' && !isHighPrivilege ? 'queue' : tab;
    setActiveTab(nextTab);
    const targetPath = ADMIN_TAB_PATHS[nextTab];
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToast = useCallback((type, title, message) => {
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
  }, []);

  const refreshAdminData = useCallback(async () => {
    if (!currentOfficer) return;
    const tasks = [fetchReports(), fetchInventories()];
    if (isHighPrivilege) {
      tasks.push(fetchAuditLogs());
    }
    const [reportsRes, inventoriesRes, auditRes] = await Promise.allSettled(tasks);

    if (reportsRes.status === 'fulfilled') {
      setReports(reportsRes.value.rows);
      setApiReportCounts(reportsRes.value.counts);
    }
    if (inventoriesRes.status === 'fulfilled') {
      setInventoryList(inventoriesRes.value);
    }
    if (isHighPrivilege && auditRes?.status === 'fulfilled') {
      setAuditLogs(auditRes.value);
    }
  }, [currentOfficer, isHighPrivilege]);

  useEffect(() => {
    if (!currentOfficer) return;
    let active = true;
    const loadInitial = async () => {
      try {
        await refreshAdminData();
      } catch (err) {
        if (active) {
          addToast('error', 'Gagal Memuat Data API', err?.message || 'Tidak dapat memuat data backend.');
        }
      }
    };
    loadInitial();
    return () => {
      active = false;
    };
  }, [currentOfficer, refreshAdminData, addToast]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setIsLogoutModalOpen(false);
      setIsDrawerOpen(false);
      setSecureFileModal((prev) => ({ ...prev, isOpen: false }));
      setActiveJsonLog(null);
      setSelectedTicketCode(null);
      setApiReportCounts(null);
      setReports([]);
      setInventoryList([]);
      setAuditLogs([]);
      setCurrentOfficer(null);
      setLoginNotice('Sesi Anda telah berakhir. Silakan login kembali.');
      if (window.location.pathname !== '/login') {
        window.history.pushState({}, '', '/login');
      }
    };
    window.addEventListener('uglf:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('uglf:unauthorized', handleUnauthorized);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const selectedReport = selectedTicketCode
    ? reports.find((r) => r.ticketCode === selectedTicketCode) || null
    : null;

  const ensureReportDetailLoaded = useCallback(
    async (ticketCode) => {
      if (!ticketCode) return null;
      try {
        const detail = await fetchReportDetailWithFiles(ticketCode);
        setReports((prev) =>
          prev.map((r) => (r.ticketCode === ticketCode ? { ...r, ...detail } : r))
        );
        return detail;
      } catch (err) {
        addToast('error', 'Gagal Memuat Detail', err?.message || 'Tidak dapat memuat detail tiket.');
        return null;
      }
    },
    [addToast]
  );

  const handleReviewReport = async (report) => {
    setSelectedTicketCode(report.ticketCode);
    setIsDrawerOpen(true);

    if (!report.detailLoaded) {
      await ensureReportDetailLoaded(report.ticketCode);
    }
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

  const handleIssueInvitation = async (reportCode, matchedInventoryId, notes) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    try {
      await updateReportStatus(reportCode, {
        status: 'Perlu Verifikasi',
        matchedInventoryId,
        adminNotes: notes,
      });
      await refreshAdminData();
      addToast(
        'success',
        'Undangan Loket Diterbitkan',
        `Status tiket ${reportCode} kini 'Perlu Verifikasi'. Email dikirim ke ${
          target?.reporterEmail || 'pelapor'
        }.`
      );
    } catch (err) {
      addToast('error', 'Gagal Menerbitkan Undangan', err?.message || 'Gagal memperbarui status.');
    }
  };

  const handleRejectReport = async (reportCode, reason) => {
    try {
      await updateReportStatus(reportCode, {
        status: 'Ditolak',
        rejectionReason: reason,
      });
      await refreshAdminData();
      addToast('warning', 'Laporan Ditolak', `Tiket ${reportCode} telah ditolak.`);
    } catch (err) {
      addToast('error', 'Gagal Menolak Laporan', err?.message || 'Gagal menolak laporan.');
    }
  };

  const handleRestoreStaleReport = async (reportCode) => {
    try {
      await restoreStaleReport(reportCode);
      await refreshAdminData();
      addToast(
        'success',
        'Laporan Lawas Dipulihkan',
        `Tiket ${reportCode} dikembalikan ke antrean aktif.`
      );
    } catch (err) {
      addToast('error', 'Gagal Memulihkan Laporan', err?.message || 'Aksi gagal diproses.');
    }
  };

  const handleRevertToUnmatched = async (reportCode, reason) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    try {
      const nextNotes = `${
        target?.adminNotes ? target.adminNotes + ' | ' : ''
      }Verifikasi loket gagal (${reason}) — dikembalikan ke Belum Ada.`;
      await updateReportStatus(reportCode, {
        status: 'Belum Ada',
        matchedInventoryId: '',
        adminNotes: nextNotes,
      });
      await refreshAdminData();
      addToast(
        'warning',
        'Dikembalikan ke Belum Ada',
        `Tiket ${reportCode} dikembalikan ke antrean. Inventori tetap Tersimpan.`
      );
    } catch (err) {
      addToast('error', 'Gagal Mengembalikan Tiket', err?.message || 'Transisi status ditolak.');
    }
  };

  const handleReopenRejectedReport = async (reportCode, { reason }) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    try {
      await updateReportStatus(reportCode, {
        status: 'Dibatalkan',
        cancelReason: reason,
        includeResubmitLink: true,
        adminNotes: `${
          target?.adminNotes ? target.adminNotes + ' | ' : ''
        }Status Ditolak dibatalkan menjadi Dibatalkan (${reason}).`,
      });
      await refreshAdminData();
      addToast(
        'success',
        'Status Ditolak → Dibatalkan',
        `Tiket ${reportCode} diubah menjadi Dibatalkan & tautan ajukan ulang telah dikirim ke email pelapor.`
      );
    } catch (err) {
      addToast(
        'error',
        'Gagal Membatalkan Status Ditolak',
        err?.message || 'Gagal memproses pembatalan status Ditolak.'
      );
    }
  };

  const handleVoidHandover = async (
    reportCode,
    { reason, restoreInventory = true, includeResubmitLink = true }
  ) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    try {
      await updateReportStatus(reportCode, {
        status: 'Dibatalkan',
        cancelReason: reason,
        restoreInventory,
        includeResubmitLink,
        adminNotes: `${
          target?.adminNotes ? target.adminNotes + ' | ' : ''
        }Status Selesai dibatalkan menjadi Dibatalkan (${reason}).`,
      });
      await refreshAdminData();
      addToast(
        'warning',
        'Status Selesai → Dibatalkan',
        `Tiket ${reportCode} diubah menjadi Dibatalkan${
          restoreInventory ? ' & inventori dikembalikan ke Tersimpan' : ''
        }.`
      );
    } catch (err) {
      addToast(
        'error',
        'Gagal Membatalkan Status Selesai',
        err?.message || 'Gagal memproses pembatalan status Selesai.'
      );
    }
  };

  const handleSaveNotes = async (reportCode, notes) => {
    try {
      await updateReportNotes(reportCode, { adminNotes: notes });
      setReports((prev) =>
        prev.map((r) => (r.ticketCode === reportCode ? { ...r, adminNotes: notes } : r))
      );
      addToast('info', 'Catatan Disimpan', `Catatan internal tiket ${reportCode} diperbarui.`);
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Catatan', err?.message || 'Gagal menyimpan catatan.');
    }
  };

  const handleCompleteHandover = async (params) => {
    const target = reports.find((r) => r.ticketCode === params.ticketCode);
    if (!target || target.status !== 'Perlu Verifikasi') {
      addToast(
        'error',
        'Serah Terima Ditolak',
        'Hanya tiket berstatus Perlu Verifikasi yang dapat diserahterimakan.'
      );
      return false;
    }

    try {
      await createHandover(params);
      await refreshAdminData();
      addToast(
        'success',
        'Serah Terima Sukses',
        `Tiket ${params.ticketCode} resmi 'Selesai' & inventori diubah menjadi 'Diambil'.`
      );
      return true;
    } catch (err) {
      addToast('error', 'Serah Terima Gagal', err?.message || 'Gagal memproses serah terima.');
      return false;
    }
  };

  const handleGoToHandoverFromDrawer = (ticketCode) => {
    setIsDrawerOpen(false);
    setHandoverPreloadTicket(ticketCode);
    handleSelectTab('handover');
  };

  const handleSelectToMatchFromInventory = (inventoryId) => {
    const matched = reports.find((r) => r.matchedInventoryId === inventoryId);
    if (matched) {
      handleSelectTab('queue');
      handleReviewReport(matched);
    } else {
      handleSelectTab('queue');
      addToast(
        'info',
        'Pilih Pengaduan',
        `Silakan pilih laporan di antrean untuk mencocokkan dengan ${inventoryId}.`
      );
    }
  };

  const handleCreateInventory = async (newItem) => {
    try {
      const created = await createInventory(newItem);
      await refreshAdminData();
      addToast(
        'success',
        'Inventori Ditambahkan',
        `[${created.id}] ${created.title} tersimpan di ${created.storageLocker}.`
      );
    } catch (err) {
      addToast('error', 'Gagal Menambah Inventori', err?.message || 'Gagal menyimpan inventori.');
    }
  };

  const handleUpdateInventory = async (updatedItem) => {
    try {
      await updateInventory(updatedItem.id, updatedItem);
      await refreshAdminData();
      addToast(
        'info',
        'Inventori Diperbarui',
        `Detail barang [${updatedItem.id}] berhasil disimpan.`
      );
    } catch (err) {
      addToast('error', 'Gagal Memperbarui Inventori', err?.message || 'Gagal menyimpan perubahan.');
    }
  };

  const handleDeleteInventory = async (inventoryId, reason) => {
    try {
      await deleteInventory(inventoryId, { reason, confirmId: inventoryId });
      await refreshAdminData();
      addToast('warning', 'Inventori Dihapus', `Barang [${inventoryId}] berhasil dihapus.`);
    } catch (err) {
      addToast(
        'error',
        'Gagal Menghapus Inventori',
        err?.message || 'Gagal menghapus data inventori.'
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

  const handleConfirmLogout = async () => {
    await logoutOfficer();
    setIsLogoutModalOpen(false);
    setIsDrawerOpen(false);
    setSecureFileModal((prev) => ({ ...prev, isOpen: false }));
    setActiveJsonLog(null);
    setSelectedTicketCode(null);
    setApiReportCounts(null);
    setReports([]);
    setInventoryList([]);
    setAuditLogs([]);
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

  const statsCounts = apiReportCounts
    ? {
        belumAda: apiReportCounts.belum_ada ?? 0,
        perluVerifikasi: apiReportCounts.perlu_verifikasi ?? 0,
        lawas: apiReportCounts.lawas ?? 0,
        selesai: apiReportCounts.selesai ?? 0,
        ditolak: apiReportCounts.ditolak ?? 0,
        dibatalkan: apiReportCounts.dibatalkan ?? 0,
      }
    : {
        belumAda: reports.filter((r) => r.status === 'Belum Ada').length,
        perluVerifikasi: reports.filter((r) => r.status === 'Perlu Verifikasi').length,
        lawas: reports.filter((r) => r.isStale).length,
        selesai: reports.filter((r) => r.status === 'Selesai').length,
        ditolak: reports.filter((r) => r.status === 'Ditolak').length,
        dibatalkan: reports.filter((r) => r.status === 'Dibatalkan').length,
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
        activeTab={effectiveTab}
        onSelectTab={handleSelectTab}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        queueCount={statsCounts.belumAda}
        officer={currentOfficer}
        canViewAudit={isHighPrivilege}
      />

      <main id="konten" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {effectiveTab === 'queue' && (
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

            <AdminStatsCards
              counts={statsCounts}
              activeFilterTab={activeFilterTab}
              onlyStale={dateRangeFilter === 'STALE'}
              onSelectStatus={setActiveFilterTab}
              onToggleStale={() =>
                setDateRangeFilter((prev) => (prev === 'STALE' ? 'ALL' : 'STALE'))
              }
            />

            <AdminReportQueue
              reports={reports}
              onReviewReport={handleReviewReport}
              activeFilterTab={activeFilterTab}
              onFilterTabChange={setActiveFilterTab}
              dateRangeFilter={dateRangeFilter}
              onDateRangeFilterChange={setDateRangeFilter}
              onRefresh={refreshAdminData}
            />
          </div>
        )}

        {effectiveTab === 'inventory' && (
          <AdminInventoryPage
            inventoryList={inventoryList}
            reports={reports}
            onSelectToMatch={handleSelectToMatchFromInventory}
            onCreateInventory={handleCreateInventory}
            onUpdateInventory={handleUpdateInventory}
            onDeleteInventory={handleDeleteInventory}
          />
        )}

        {effectiveTab === 'handover' && (
          <AdminHandoverPage
            key={handoverPreloadTicket || 'default'}
            reports={reports}
            inventoryList={inventoryList}
            initialTicketCode={handoverPreloadTicket}
            onEnsureReportDetail={ensureReportDetailLoaded}
            onCompleteHandover={handleCompleteHandover}
            onBackToQueue={() => handleSelectTab('queue')}
          />
        )}

        {effectiveTab === 'audit' && isHighPrivilege && (
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
        reports={reports}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        inventoryList={inventoryList}
        canRestoreStale={isHighPrivilege}
        onIssueInvitation={handleIssueInvitation}
        onRejectReport={(code, reason) => {
          handleRejectReport(code, reason);
          setIsDrawerOpen(false);
        }}
        onRestoreStaleReport={handleRestoreStaleReport}
        onRevertToUnmatched={handleRevertToUnmatched}
        onReopenRejectedReport={handleReopenRejectedReport}
        onVoidHandover={handleVoidHandover}
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
