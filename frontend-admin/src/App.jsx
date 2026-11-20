import { useState, useEffect, useCallback } from 'react';
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
import {
  clearStoredSession,
  getStoredSession,
  isHighPrivilegeOfficer,
  logoutOfficer,
} from './services/auth';
import { API_MOCK } from './services/httpClient';
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
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [inventoryList, setInventoryList] = useState(INITIAL_INVENTORY);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
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

  const isMockMode = API_MOCK || Boolean(currentOfficer?.isMock);

  const refreshAdminData = useCallback(async () => {
    if (!currentOfficer || isMockMode) return;
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
  }, [currentOfficer, isMockMode, isHighPrivilege]);

  useEffect(() => {
    if (!currentOfficer || isMockMode) return;
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
  }, [currentOfficer, isMockMode, refreshAdminData, addToast]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setIsLogoutModalOpen(false);
      setIsDrawerOpen(false);
      setSecureFileModal((prev) => ({ ...prev, isOpen: false }));
      setActiveJsonLog(null);
      setSelectedTicketCode(null);
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

  const handleReviewReport = async (report) => {
    setSelectedTicketCode(report.ticketCode);
    setIsDrawerOpen(true);

    if (!isMockMode && !report.detailLoaded) {
      try {
        const detail = await fetchReportDetailWithFiles(report.ticketCode);
        setReports((prev) =>
          prev.map((r) => (r.ticketCode === report.ticketCode ? { ...r, ...detail } : r))
        );
      } catch (err) {
        addToast('error', 'Gagal Memuat Detail', err?.message || 'Tidak dapat memuat detail tiket.');
      }
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
    if (!isMockMode) {
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
          `Status tiket ${reportCode} kini 'Perlu Verifikasi'. Email dikirim ke ${target?.reporterEmail || 'pelapor'}.`
        );
      } catch (err) {
        addToast('error', 'Gagal Menerbitkan Undangan', err?.message || 'Gagal memperbarui status.');
      }
      return;
    }

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

  const handleRejectReport = async (reportCode, reason) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    if (!isMockMode) {
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
      return;
    }

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

  const handleRestoreStaleReport = async (reportCode) => {
    const officerLabel = `${currentOfficer?.name || 'Budi Santoso'} (${
      currentOfficer?.id || 'ADM-04D'
    })`;
    if (!isMockMode) {
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
      return;
    }

    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              isStale: false,
              adminNotes: `${
                r.adminNotes ? r.adminNotes + ' | ' : ''
              }Dipulihkan dari laporan lawas oleh ${officerLabel}.`,
            }
          : r
      )
    );

    appendAuditLog('STALE_RESTORE', `reports: ${reportCode}`, reportCode, {
      action: 'RESTORE_STALE_REPORT',
      ticket_code: reportCode,
      previous_is_stale: true,
      new_is_stale: false,
      restored_by: officerLabel,
    });

    addToast(
      'success',
      'Laporan Lawas Dipulihkan',
      `Tiket ${reportCode} dikembalikan ke antrean aktif.`
    );
  };

  const handleRevertToUnmatched = async (reportCode, reason) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    const officerLabel = `${currentOfficer?.name || 'Budi Santoso'} (${
      currentOfficer?.id || 'ADM-04D'
    })`;

    if (!isMockMode) {
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
      return;
    }

    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              status: 'Belum Ada',
              matchedInventoryId: '',
              adminNotes: `${
                r.adminNotes ? r.adminNotes + ' | ' : ''
              }Verifikasi loket gagal (${reason}) — dikembalikan ke Belum Ada.`,
            }
          : r
      )
    );

    appendAuditLog('STATUS_REVERT', `reports: ${reportCode}`, reportCode, {
      action: 'REVERT_VERIFICATION_FAILED',
      ticket_code: reportCode,
      previous_status: target?.status || 'Perlu Verifikasi',
      new_status: 'Belum Ada',
      reason,
      inventory_retained_status: 'Tersimpan',
      officer: officerLabel,
    });

    addToast(
      'warning',
      'Dikembalikan ke Belum Ada',
      `Tiket ${reportCode} dikembalikan ke antrean. Inventori tetap Tersimpan.`
    );
  };

  const handleReopenRejectedReport = async (reportCode, { reason }) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    const officerLabel = `${currentOfficer?.name || 'Budi Santoso'} (${
      currentOfficer?.id || 'ADM-04D'
    })`;
    const resubmitToken = `RST-${reportCode.replace(/[^A-Z0-9]/gi, '')}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const resubmitLink = `/lapor?reopen=${resubmitToken}`;

    if (!isMockMode) {
      try {
        await updateReportStatus(reportCode, {
          status: 'Dibatalkan',
          adminNotes: `${
            target?.adminNotes ? target.adminNotes + ' | ' : ''
          }Status Ditolak dibatalkan menjadi Dibatalkan (${reason}).`,
        });
        await refreshAdminData();
        addToast(
          'success',
          'Status Ditolak → Dibatalkan',
          `Tiket ${reportCode} diubah menjadi Dibatalkan.`
        );
      } catch (err) {
        addToast(
          'error',
          'Belum Didukung Backend',
          err?.message || 'Backend saat ini belum membuka transisi Ditolak → Dibatalkan.'
        );
      }
      return;
    }

    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              status: 'Dibatalkan',
              cancelledFrom: 'Ditolak',
              cancelReason: reason,
              cancelledBy: officerLabel,
              cancelEmailType: 'RESUBMIT_INVITATION',
              resubmitLink,
              adminNotes: `${
                r.adminNotes ? r.adminNotes + ' | ' : ''
              }Status Ditolak dibatalkan menjadi Dibatalkan oleh ${officerLabel} (${reason}). Email tombol Ajukan Ulang dikirim ke ${r.reporterEmail}.`,
            }
          : r
      )
    );

    appendAuditLog('STATUS_REVERT', `reports: ${reportCode}`, reportCode, {
      action: 'CANCEL_REJECTED_REPORT',
      ticket_code: reportCode,
      previous_status: target?.status || 'Ditolak',
      new_status: 'Dibatalkan',
      reason,
      email_type: 'RESUBMIT_INVITATION',
      resubmit_link: resubmitLink,
      officer: officerLabel,
    });

    addToast(
      'success',
      'Status Ditolak → Dibatalkan',
      `Tiket ${reportCode} diubah menjadi Dibatalkan. Email khusus berisi tombol Ajukan Ulang telah dikirim ke ${target?.reporterEmail}.`
    );
  };

  const handleVoidHandover = async (
    reportCode,
    { reason, restoreInventory, includeResubmitLink }
  ) => {
    const target = reports.find((r) => r.ticketCode === reportCode);
    const officerLabel = `${currentOfficer?.name || 'Budi Santoso'} (${
      currentOfficer?.id || 'ADM-04D'
    })`;
    const matchedInvId = target?.matchedInventoryId || '';
    const resubmitLink = includeResubmitLink
      ? `/lapor?reopen=VOID-${reportCode.replace(/[^A-Z0-9]/gi, '')}-${Date.now()
          .toString(36)
          .toUpperCase()}`
      : null;

    if (!isMockMode) {
      try {
        await updateReportStatus(reportCode, {
          status: 'Dibatalkan',
          adminNotes: `${
            target?.adminNotes ? target.adminNotes + ' | ' : ''
          }Status Selesai dibatalkan menjadi Dibatalkan (${reason}).`,
        });
        await refreshAdminData();
        addToast(
          'warning',
          'Status Selesai → Dibatalkan',
          `Tiket ${reportCode} diubah menjadi Dibatalkan.`
        );
      } catch (err) {
        addToast(
          'error',
          'Belum Didukung Backend',
          err?.message || 'Backend saat ini belum membuka void/revert untuk status Selesai.'
        );
      }
      return;
    }

    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === reportCode
          ? {
              ...r,
              status: 'Dibatalkan',
              cancelledFrom: 'Selesai',
              cancelReason: reason,
              cancelledBy: officerLabel,
              cancelEmailType: 'ERROR_CLARIFICATION',
              resubmitLink,
              matchedInventoryId: '',
              adminNotes: `${
                r.adminNotes ? r.adminNotes + ' | ' : ''
              }Status Selesai dibatalkan menjadi Dibatalkan oleh ${officerLabel} (${reason}). Email pemberitahuan kesalahan dikirim ke ${r.reporterEmail}.`,
            }
          : r
      )
    );

    if (restoreInventory && matchedInvId) {
      setInventoryList((prev) =>
        prev.map((inv) =>
          inv.id === matchedInvId
            ? {
                ...inv,
                status: 'Tersimpan',
                notes: `${inv.notes} [SERAH TERIMA DIBATALKAN: ${reason}]`,
              }
            : inv
        )
      );
    }

    appendAuditLog('HANDOVER_VOID', `reports: ${reportCode}`, reportCode, {
      action: 'CANCEL_COMPLETED_REPORT',
      ticket_code: reportCode,
      previous_status: target?.status || 'Selesai',
      new_status: 'Dibatalkan',
      reason,
      matched_inventory_id: matchedInvId || 'N/A',
      inventory_restored_to_tersimpan: Boolean(restoreInventory && matchedInvId),
      email_type: 'ERROR_CLARIFICATION',
      resubmit_link: resubmitLink,
      officer: officerLabel,
    });

    addToast(
      'warning',
      'Status Selesai → Dibatalkan',
      `Tiket ${reportCode} diubah menjadi Dibatalkan${
        restoreInventory && matchedInvId ? ' & inventori kembali Tersimpan' : ''
      }. Email pemberitahuan kesalahan telah dikirim ke ${target?.reporterEmail}.`
    );
  };

  const handleSaveNotes = async (reportCode, notes) => {
    if (!isMockMode) {
      try {
        await updateReportNotes(reportCode, { adminNotes: notes });
        setReports((prev) =>
          prev.map((r) => (r.ticketCode === reportCode ? { ...r, adminNotes: notes } : r))
        );
        addToast('info', 'Catatan Disimpan', `Catatan internal tiket ${reportCode} diperbarui.`);
      } catch (err) {
        addToast('error', 'Gagal Menyimpan Catatan', err?.message || 'Gagal menyimpan catatan.');
      }
      return;
    }

    setReports((prev) =>
      prev.map((r) => (r.ticketCode === reportCode ? { ...r, adminNotes: notes } : r))
    );
    addToast('info', 'Catatan Disimpan', `Catatan internal tiket ${reportCode} diperbarui.`);
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

    if (!isMockMode) {
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
    }

    const matchedInvId = params.inventoryId || target.matchedInventoryId;
    setReports((prev) =>
      prev.map((r) =>
        r.ticketCode === params.ticketCode
          ? {
              ...r,
              status: 'Selesai',
              matchedInventoryId: matchedInvId || r.matchedInventoryId,
              adminNotes: `${
                r.adminNotes ? r.adminNotes + ' | ' : ''
              }Serah terima selesai kepada ${params.recipientName} (${
                params.recipientNpm
              }). Catatan: ${params.notes}`,
            }
          : r
      )
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
    return true;
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
    if (!isMockMode) {
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
      return;
    }

    setInventoryList((prev) => [newItem, ...prev]);

    appendAuditLog('INV_CREATE', `inventories: ${newItem.id}`, newItem.id, {
      action: 'REGISTER_FOUND_ITEM',
      inventory_id: newItem.id,
      item_title: newItem.title,
      category: newItem.category,
      storage_location: newItem.storageLocker,
      found_location: newItem.foundLocation,
      found_date: newItem.foundDate,
      finder: newItem.finderName,
      finder_contact: newItem.finderContact || null,
      registered_by: `${currentOfficer?.name || 'Budi Santoso'} (${currentOfficer?.id || 'ADM-04D'})`,
    });

    addToast(
      'success',
      'Inventori Ditambahkan',
      `[${newItem.id}] ${newItem.title} tersimpan di ${newItem.storageLocker}.`
    );
  };

  const handleUpdateInventory = async (updatedItem) => {
    if (!isMockMode) {
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
      return;
    }

    setInventoryList((prev) =>
      prev.map((inv) =>
        inv.id === updatedItem.id && inv.status === 'Tersimpan' ? updatedItem : inv
      )
    );

    appendAuditLog('INV_UPDATE', `inventories: ${updatedItem.id}`, updatedItem.id, {
      action: 'UPDATE_FOUND_ITEM',
      inventory_id: updatedItem.id,
      item_title: updatedItem.title,
      category: updatedItem.category,
      storage_location: updatedItem.storageLocker,
      found_location: updatedItem.foundLocation,
      found_date: updatedItem.foundDate,
      finder: updatedItem.finderName,
      finder_contact: updatedItem.finderContact || null,
      updated_by: `${currentOfficer?.name || 'Budi Santoso'} (${currentOfficer?.id || 'ADM-04D'})`,
    });

    addToast(
      'info',
      'Inventori Diperbarui',
      `Detail barang [${updatedItem.id}] berhasil disimpan.`
    );
  };

  const handleDeleteInventory = async (inventoryId, reason) => {
    if (!isMockMode) {
      try {
        await deleteInventory(inventoryId, { reason, confirmId: inventoryId });
        await refreshAdminData();
        addToast('warning', 'Inventori Dihapus', `Barang [${inventoryId}] berhasil dihapus.`);
      } catch (err) {
        addToast(
          'error',
          'Hapus Inventori Belum Didukung Backend',
          err?.message || 'Endpoint DELETE /api/v1/admin/inventories/:id belum tersedia di backend.'
        );
      }
      return;
    }

    const targetItem = inventoryList.find((inv) => inv.id === inventoryId);
    const linkedReport = reports.find((r) => r.matchedInventoryId === inventoryId);
    const officerLabel = `${currentOfficer?.name || 'Budi Santoso'} (${
      currentOfficer?.id || 'ADM-04D'
    })`;

    setInventoryList((prev) => prev.filter((inv) => inv.id !== inventoryId));

    if (linkedReport) {
      setReports((prev) =>
        prev.map((r) =>
          r.matchedInventoryId === inventoryId
            ? {
                ...r,
                matchedInventoryId: '',
                status: r.status === 'Perlu Verifikasi' ? 'Belum Ada' : r.status,
                adminNotes: `${
                  r.adminNotes ? r.adminNotes + ' | ' : ''
                }Inventori tertaut [${inventoryId}] dihapus oleh ${officerLabel} (${reason})${
                  r.status === 'Perlu Verifikasi' ? ' — status dikembalikan ke Belum Ada.' : '.'
                }`,
              }
            : r
        )
      );
    }

    appendAuditLog('INV_DELETE', `inventories: ${inventoryId}`, inventoryId, {
      action: 'DELETE_FOUND_ITEM',
      inventory_id: inventoryId,
      item_title: targetItem?.title || 'N/A',
      storage_location: targetItem?.storageLocker || 'N/A',
      reason,
      unlinked_ticket: linkedReport?.ticketCode || null,
      reverted_ticket_to_belum_ada:
        linkedReport?.status === 'Perlu Verifikasi' ? linkedReport.ticketCode : null,
      deleted_by: officerLabel,
    });

    addToast(
      'warning',
      'Inventori Dihapus',
      `Barang [${inventoryId}] berhasil dihapus dari inventori.${
        linkedReport
          ? ` Tautan tiket ${linkedReport.ticketCode} dilepas${
              linkedReport.status === 'Perlu Verifikasi'
                ? ' & dikembalikan ke Belum Ada'
                : ''
            }.`
          : ''
      }`
    );
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
    setReports(INITIAL_REPORTS);
    setInventoryList(INITIAL_INVENTORY);
    setAuditLogs(INITIAL_AUDIT_LOGS);
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

  const statsCounts =
    !isMockMode && apiReportCounts
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
