import { useState } from 'react';
import { StatusBadge } from './AdminBadges';
import { Button } from './ui/Button';
import { INPUT_CLASS, LABEL_CLASS } from './ui/styles';
import {
  LuX,
  LuLock,
  LuMessageCircle,
  LuMapPin,
  LuCalendar,
  LuUser,
  LuMail,
  LuPhone,
  LuArchive,
  LuCircleCheck,
  LuCircleAlert,
  LuSend,
  LuSave,
  LuEye,
  LuClock,
  LuRotateCcw,
} from 'react-icons/lu';

function formatPhoneForWa(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  return cleaned;
}

function DrawerContent({
  report,
  reports = [],
  onClose,
  inventoryList,
  canRestoreStale,
  onIssueInvitation,
  onRejectReport,
  onRestoreStaleReport,
  onRevertToUnmatched,
  onReopenRejectedReport,
  onVoidHandover,
  onSaveNotes,
  onOpenSecureFile,
  onGoToHandover,
}) {
  const [selectedInventoryId, setSelectedInventoryId] = useState(
    report.matchedInventoryId || ''
  );
  const [inviteError, setInviteError] = useState('');
  const [adminNotes, setAdminNotes] = useState(report.adminNotes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [revertPrompt, setRevertPrompt] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertError, setRevertError] = useState('');
  const [reopenPrompt, setReopenPrompt] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [voidPrompt, setVoidPrompt] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [voidRestoreInventory, setVoidRestoreInventory] = useState(true);
  const [voidIncludeResubmit, setVoidIncludeResubmit] = useState(true);

  const availableInventory = inventoryList.filter(
    (item) => item.status === 'Tersimpan' || item.id === report.matchedInventoryId
  );

  const lockedByOtherTicket = reports.reduce((acc, r) => {
    if (
      r.ticketCode !== report.ticketCode &&
      r.status === 'Perlu Verifikasi' &&
      r.matchedInventoryId
    ) {
      acc[r.matchedInventoryId] = r.ticketCode;
    }
    return acc;
  }, {});

  const sameCategoryInventory = availableInventory.filter(
    (item) => item.category === report.category
  );
  const otherCategoryInventory = availableInventory.filter(
    (item) => item.category !== report.category
  );

  const matchedInventory = inventoryList.find((item) => item.id === selectedInventoryId);

  const handleSaveNotes = () => {
    onSaveNotes(report.ticketCode, adminNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  };

  const handleIssueInvitation = () => {
    if (!selectedInventoryId) {
      setInviteError(
        'Pilih barang temuan fisik dari inventori terlebih dahulu sebelum menerbitkan undangan.'
      );
      return;
    }
    if (lockedByOtherTicket[selectedInventoryId]) {
      setInviteError(
        `Barang [${selectedInventoryId}] sedang diverifikasi untuk tiket ${lockedByOtherTicket[selectedInventoryId]}.`
      );
      return;
    }
    setInviteError('');
    onIssueInvitation(report.ticketCode, selectedInventoryId, adminNotes);
  };

  const handleExecuteReject = () => {
    if (!rejectReason.trim()) {
      setRejectError('Mohon cantumkan alasan penolakan laporan.');
      return;
    }
    setRejectError('');
    onRejectReport(report.ticketCode, rejectReason);
    setRejectPrompt(false);
  };

  const handleExecuteRevert = () => {
    if (!revertReason.trim()) {
      setRevertError('Mohon cantumkan alasan verifikasi loket gagal.');
      return;
    }
    setRevertError('');
    onRevertToUnmatched?.(report.ticketCode, revertReason.trim());
    setRevertPrompt(false);
    setRevertReason('');
  };

  const handleExecuteReopenRejected = () => {
    if (!reopenReason.trim()) {
      setReopenError('Mohon cantumkan alasan pembatalan status Ditolak.');
      return;
    }
    setReopenError('');
    onReopenRejectedReport?.(report.ticketCode, {
      reason: reopenReason.trim(),
    });
    setReopenPrompt(false);
    setReopenReason('');
  };

  const handleExecuteVoidHandover = () => {
    if (!voidReason.trim()) {
      setVoidError('Mohon cantumkan alasan pembatalan status Selesai.');
      return;
    }
    setVoidError('');
    onVoidHandover?.(report.ticketCode, {
      reason: voidReason.trim(),
      restoreInventory: voidRestoreInventory,
      includeResubmitLink: voidIncludeResubmit,
    });
    setVoidPrompt(false);
    setVoidReason('');
  };

  const handleExecuteRestore = () => {
    onRestoreStaleReport?.(report.ticketCode);
    setRestoreConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-ug-950/55 transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-10">
        <div className="w-screen max-w-2xl bg-paper border-l-2 border-ug-950 flex flex-col h-full">
          {/* Header */}
          <div className="on-ug px-6 py-5 bg-ug-950 text-sheet border-b border-ug-800 flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="rounded-[3px] bg-gold px-2 py-0.5 text-xs font-bold text-ug-950 tabular-nums">
                  {report.ticketCode}
                </span>
                <h2 className="text-base font-bold text-sheet tracking-tight">
                  Review Pengaduan
                </h2>
                <StatusBadge status={report.status} />
                {report.isStale && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-gold">
                    <LuClock className="size-4" aria-hidden="true" />
                    Lawas &gt;30h
                  </span>
                )}
              </div>
              <p className="text-xs text-ug-200/80 tabular-nums mt-1.5">
                Diajukan {report.reportedAt} WIB
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-sheet/80 hover:text-gold hover:bg-ug-900 rounded-[4px] transition-colors cursor-pointer shrink-0"
              aria-label="Tutup panel"
              title="Tutup"
            >
              <LuX className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {report.status === 'Dibatalkan' && (
              <div className="rounded-[5px] border-[1.5px] border-ink-3/40 bg-sheet p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink flex items-center gap-1.5">
                    <LuRotateCcw className="size-4 text-ink-2 shrink-0" aria-hidden="true" />
                    <span>
                      Tiket Dibatalkan (Dari Status {report.cancelledFrom || 'Sebelumnya'})
                    </span>
                  </span>
                  {report.cancelledBy && (
                    <span className="text-[11px] font-medium text-ink-3">
                      Oleh: {report.cancelledBy}
                    </span>
                  )}
                </div>
                {report.cancelReason && (
                  <p className="text-xs text-ink-2 bg-paper p-2.5 rounded-[4px] border border-line">
                    <strong className="text-ink">Alasan Petugas:</strong> {report.cancelReason}
                  </p>
                )}
                <p className="text-xs text-ink-2">
                  {report.cancelEmailType === 'RESUBMIT_INVITATION'
                    ? `Email khusus berisi tombol Ajukan Ulang Laporan telah dikirim ke ${report.reporterEmail}.`
                    : `Email pemberitahuan kesalahan sesuai alasan petugas telah dikirim ke ${report.reporterEmail}.`}
                </p>
                {report.resubmitLink && (
                  <p className="text-[11px] font-mono text-ug-700 bg-ug-100/70 px-2.5 py-1.5 rounded-[3px] break-all">
                    Tautan Ajukan Ulang Frontend: {report.resubmitLink}
                  </p>
                )}
              </div>
            )}

            {/* Section 1: Data Laporan Mahasiswa */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line-strong pb-2">
                <h3 className="text-xs font-bold text-ink uppercase tracking-[0.08em] flex items-center gap-2">
                  <LuUser className="size-4 text-ug-700" aria-hidden="true" />
                  Data Laporan Mahasiswa
                </h3>
                <span className="text-xs font-bold text-ink-3 tabular-nums">
                  {report.ticketCode}
                </span>
              </div>

              <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-medium text-ink-3 block">Nama Lengkap</span>
                    <span className="font-bold text-ink">{report.reporterName}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ink-3 block">NPM</span>
                    <span className="font-bold text-ug-800 tabular-nums">
                      {report.reporterNpm}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ink-3 block">Email Institusi</span>
                    <span className="text-ink font-medium text-xs flex items-center gap-1.5 mt-0.5 break-all">
                      <LuMail className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                      {report.reporterEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ink-3 block">WhatsApp</span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-ink font-semibold text-xs tabular-nums flex items-center gap-1.5">
                        <LuPhone className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                        {report.reporterPhone}
                      </span>
                      <a
                        href={`https://wa.me/${formatPhoneForWa(report.reporterPhone)}?text=Halo%20${encodeURIComponent(
                          report.reporterName
                        )},%20kami%20dari%20Biro%20Kemahasiswaan%20Loket%20D%20Universitas%20Gunadarma%20mengenai%20laporan%20hilang%20tiket%20${
                          report.ticketCode
                        }`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-bold bg-ok hover:bg-ok/90 text-sheet transition-colors"
                      >
                        <LuMessageCircle className="size-4" aria-hidden="true" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-dotted border-line-strong grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-ink-3 flex items-center gap-1.5">
                      <LuMapPin className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                      Lokasi Hilang
                    </span>
                    <span className="text-ink font-semibold text-xs mt-1 block">
                      {report.lostLocation}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ink-3 flex items-center gap-1.5">
                      <LuCalendar className="size-4 text-ink-3 shrink-0" aria-hidden="true" />
                      Waktu Hilang
                    </span>
                    <span className="text-ink font-semibold text-xs tabular-nums mt-1 block">
                      {report.lostDate}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t-2 border-dotted border-line-strong">
                  <span className="text-xs font-medium text-ink-3 block mb-1.5">
                    Deskripsi Barang
                  </span>
                  <div className="bg-paper p-3.5 rounded-[4px] border border-line-strong text-ink text-sm leading-relaxed">
                    <span className="font-bold text-ink block mb-1">
                      {report.itemName}{' '}
                      <span className="text-xs font-medium text-ink-3">({report.category})</span>
                    </span>
                    <span className="text-xs text-ink-2">{report.description}</span>
                  </div>
                </div>
              </div>

              {/* Ciri Khusus Rahasia */}
              <div className="rounded-[5px] border-[1.5px] border-ug-200 bg-ug-100 p-4 space-y-2">
                <div className="flex items-center justify-between text-ug-800 font-bold text-xs uppercase tracking-[0.06em]">
                  <span className="flex items-center gap-2">
                    <LuLock className="size-4 text-ug-700" aria-hidden="true" />
                    Ciri Khusus Rahasia Pelapor
                  </span>
                  <span className="font-semibold text-ug-700">Internal Only</span>
                </div>
                <p className="text-sm text-ink font-medium leading-relaxed bg-sheet p-3 rounded-[4px] border border-ug-200">
                  &ldquo;{report.secretFeature}&rdquo;
                </p>
              </div>

              {/* Preview Dokumen */}
              <div>
                <span className="text-xs font-bold text-ink block mb-2.5 uppercase tracking-[0.08em]">
                  Preview Dokumen
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-sheet border-[1.5px] border-line-strong rounded-[4px] p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-paper rounded-[3px] border border-line-strong overflow-hidden shrink-0 flex items-center justify-center">
                        {report.ktmThumbnailUrl ? (
                          <img
                            src={report.ktmThumbnailUrl}
                            alt="KTM"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <LuLock className="size-4 text-ink-3" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink">Foto KTM</div>
                        <div className="text-[11px] text-ink-3 truncate">
                          {report.ktmFileName ||
                            (report.ktmThumbnailUrl
                              ? 'Tervalidasi'
                              : report.hasKtmKrs
                                ? 'Berkas privat tersedia'
                                : 'Memuat...')}
                        </div>
                      </div>
                    </div>
                    {(report.ktmThumbnailUrl || report.hasKtmKrs) && (
                      <Button
                        variant="subtle"
                        size="sm"
                        disabled={!report.ktmThumbnailUrl}
                        onClick={() =>
                          onOpenSecureFile(
                            `KTM Pelapor - ${report.reporterName}`,
                            report.ktmThumbnailUrl,
                            'ktm'
                          )
                        }
                        className="shrink-0"
                      >
                        <LuEye className="size-4" aria-hidden="true" />
                        <span>Buka</span>
                      </Button>
                    )}
                  </div>

                  <div className="bg-sheet border-[1.5px] border-line-strong rounded-[4px] p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-paper rounded-[3px] border border-line-strong overflow-hidden shrink-0 flex items-center justify-center">
                        {report.itemThumbnailUrl ? (
                          <img
                            src={report.itemThumbnailUrl}
                            alt="Barang"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <LuArchive className="size-5 text-ink-3" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink">Foto Barang</div>
                        <div className="text-[11px] text-ink-3 truncate">
                          {report.itemThumbnailUrl
                            ? report.supportFileName || 'Tersedia'
                            : 'Tidak diunggah'}
                        </div>
                      </div>
                    </div>
                    {report.itemThumbnailUrl && (
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() =>
                          onOpenSecureFile(
                            `Foto Barang - ${report.itemName}`,
                            report.itemThumbnailUrl,
                            'item'
                          )
                        }
                        className="shrink-0"
                      >
                        <LuEye className="size-4" aria-hidden="true" />
                        <span>Buka</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pencocokan Inventori */}
            <div className="pt-5 border-t-2 border-dotted border-line-strong space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink uppercase tracking-[0.08em] flex items-center gap-2">
                  <LuArchive className="size-4 text-ug-700" aria-hidden="true" />
                  Pencocokan Inventori Fisik
                </h3>
                <span className="text-xs font-bold text-ink-3 tabular-nums">
                  {availableInventory.length} Tersimpan
                </span>
              </div>

              <div>
                <label htmlFor="drawer-inventory-select" className={LABEL_CLASS}>
                  Pilih Barang Temuan Fisik dari Inventori
                </label>
                <select
                  id="drawer-inventory-select"
                  value={selectedInventoryId}
                  onChange={(e) => {
                    setSelectedInventoryId(e.target.value);
                    if (inviteError) setInviteError('');
                  }}
                  disabled={
                    report.status === 'Selesai' ||
                    report.status === 'Ditolak' ||
                    report.status === 'Dibatalkan'
                  }
                  aria-invalid={inviteError ? true : undefined}
                  className={`${INPUT_CLASS} h-11 font-semibold tabular-nums disabled:opacity-60 disabled:cursor-not-allowed ${
                    inviteError ? 'border-danger' : ''
                  }`}
                >
                  <option value="">-- Belum Dipilih / Tidak Ada Temuan Cocok --</option>
                  {sameCategoryInventory.length > 0 && (
                    <optgroup label={`Sesuai Kategori (${report.category})`}>
                      {sameCategoryInventory.map((item) => {
                        const lockedTicket = lockedByOtherTicket[item.id];
                        return (
                          <option key={item.id} value={item.id} disabled={Boolean(lockedTicket)}>
                            [{item.id}] {item.title} — {item.foundLocation} ({item.foundDate})
                            {lockedTicket ? ` · Sedang Diverifikasi (${lockedTicket})` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {otherCategoryInventory.length > 0 && (
                    <optgroup label="Kategori Lainnya">
                      {otherCategoryInventory.map((item) => {
                        const lockedTicket = lockedByOtherTicket[item.id];
                        return (
                          <option key={item.id} value={item.id} disabled={Boolean(lockedTicket)}>
                            [{item.id}] {item.title} — {item.foundLocation} ({item.foundDate})
                            {lockedTicket ? ` · Sedang Diverifikasi (${lockedTicket})` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
                {inviteError && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>{inviteError}</span>
                  </p>
                )}
              </div>

              {matchedInventory ? (
                <div className="bg-sheet border-2 border-ug-700 rounded-[5px] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-ug-700 tabular-nums">
                        [{matchedInventory.id}]
                      </span>
                      <h4 className="text-sm font-bold text-ink mt-0.5">
                        {matchedInventory.title}
                      </h4>
                    </div>
                    <span className="bg-ug-100 text-ug-800 px-2 py-0.5 rounded-[3px] text-xs font-bold tabular-nums shrink-0">
                      {matchedInventory.storageLocker}
                    </span>
                  </div>

                  <p className="text-xs text-ink-2 bg-paper p-3 rounded-[4px] border border-line-strong">
                    {matchedInventory.notes}
                  </p>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="text-ok font-bold flex items-center gap-1.5">
                      <LuCircleCheck className="size-4" aria-hidden="true" />
                      Barang siap dicocokkan
                    </span>
                    {report.status === 'Perlu Verifikasi' && onGoToHandover && (
                      <button
                        type="button"
                        onClick={() => onGoToHandover(report.ticketCode)}
                        className="text-xs font-bold text-ug-700 hover:text-ug-900 underline decoration-2 underline-offset-4 cursor-pointer"
                      >
                        Buka Form Serah Terima &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-sheet/60 border-[1.5px] border-dashed border-line-strong rounded-[4px] p-4 text-center text-xs text-ink-3">
                  Belum ada barang fisik inventori yang dipasangkan.
                </div>
              )}

              {/* Admin Notes */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="drawer-admin-notes" className="text-[13px] font-bold text-ink">
                    Catatan Internal Petugas (admin_notes)
                  </label>
                  {notesSaved && (
                    <span className="text-xs text-ok font-bold flex items-center gap-1">
                      <LuCircleCheck className="size-4" aria-hidden="true" /> Tersimpan
                    </span>
                  )}
                </div>
                <textarea
                  id="drawer-admin-notes"
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan internal petugas loket..."
                  className={`${INPUT_CLASS} min-h-20 py-2.5 leading-relaxed`}
                />
                <div className="flex items-center justify-end gap-2 mt-2.5 flex-wrap">
                  {report.status === 'Perlu Verifikasi' && onRevertToUnmatched && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevertPrompt(true);
                        setRejectPrompt(false);
                        setReopenPrompt(false);
                        setVoidPrompt(false);
                      }}
                    >
                      <LuRotateCcw className="size-4" aria-hidden="true" />
                      <span>Kembalikan</span>
                    </Button>
                  )}
                  {report.status === 'Ditolak' && onReopenRejectedReport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReopenPrompt(true);
                        setRejectPrompt(false);
                        setRevertPrompt(false);
                        setVoidPrompt(false);
                      }}
                    >
                      <LuRotateCcw className="size-4" aria-hidden="true" />
                      <span>Batalkan Status</span>
                    </Button>
                  )}
                  {report.status === 'Selesai' && onVoidHandover && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVoidPrompt(true);
                        setRejectPrompt(false);
                        setRevertPrompt(false);
                        setReopenPrompt(false);
                      }}
                    >
                      <LuRotateCcw className="size-4" aria-hidden="true" />
                      <span>Batalkan Status</span>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleSaveNotes}>
                    <LuSave className="size-4" aria-hidden="true" />
                    <span>Simpan Catatan</span>
                  </Button>
                </div>
              </div>

              {report.isStale &&
                canRestoreStale &&
                report.status !== 'Selesai' &&
                report.status !== 'Ditolak' &&
                report.status !== 'Dibatalkan' && (
                  <div className="rounded-[5px] border-[1.5px] border-gold-ink/40 bg-gold-wash p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.06em] text-gold-ink flex items-center gap-1.5">
                          <LuClock className="size-4 shrink-0" aria-hidden="true" />
                          <span>Laporan Lawas (&gt;30 Hari)</span>
                        </p>
                        <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                          Laporan melewati ambang 30 hari. Pulihkan ke antrean aktif jika ada
                          barang temuan baru atau pelapor melakukan konfirmasi ulang.
                        </p>
                      </div>
                      {!restoreConfirm && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRestoreConfirm(true)}
                          className="shrink-0"
                        >
                          <LuRotateCcw className="size-4" aria-hidden="true" />
                          <span>Pulihkan Laporan Lawas</span>
                        </Button>
                      )}
                    </div>

                    {restoreConfirm && (
                      <div className="pt-2.5 border-t border-gold-ink/25 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-ink">
                          Konfirmasi pulihkan tiket {report.ticketCode} ke antrean aktif?
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => setRestoreConfirm(false)}
                          >
                            Batal
                          </Button>
                          <Button variant="ug" size="sm" onClick={handleExecuteRestore}>
                            Ya, Pulihkan Laporan
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {revertPrompt && (
                <div className="rounded-[5px] border-[1.5px] border-gold-ink bg-gold-wash p-4 space-y-3">
                  <label
                    htmlFor="drawer-revert-reason"
                    className="text-xs font-bold text-gold-ink block"
                  >
                    Alasan Verifikasi Loket Gagal ({report.ticketCode}):
                  </label>
                  <p className="text-xs text-ink-2">
                    Status laporan akan dikembalikan ke <strong>Belum Ada</strong> dan inventori
                    fisik tetap berstatus <strong>Tersimpan</strong>.
                  </p>
                  <input
                    id="drawer-revert-reason"
                    type="text"
                    value={revertReason}
                    onChange={(e) => {
                      setRevertReason(e.target.value);
                      if (revertError) setRevertError('');
                    }}
                    placeholder="Contoh: Ciri khusus tidak sesuai / pelapor gagal membawa KTM asli"
                    aria-invalid={revertError ? true : undefined}
                    className={`${INPUT_CLASS} h-10 ${revertError ? 'border-danger' : ''}`}
                  />
                  {revertError && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{revertError}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setRevertPrompt(false);
                        setRevertError('');
                      }}
                    >
                      Batal
                    </Button>
                    <Button variant="ug" size="sm" onClick={handleExecuteRevert}>
                      Ya, Kembalikan ke Belum Ada
                    </Button>
                  </div>
                </div>
              )}

              {reopenPrompt && (
                <div className="rounded-[5px] border-[1.5px] border-gold-ink bg-gold-wash p-4 space-y-3">
                  <label
                    htmlFor="drawer-reopen-reason"
                    className="text-xs font-bold text-gold-ink block"
                  >
                    Batalkan Status Ditolak → Dibatalkan ({report.ticketCode}):
                  </label>
                  <p className="text-xs text-ink-2">
                    Status laporan akan diubah menjadi <strong>Dibatalkan</strong>. Pelapor (
                    <strong>{report.reporterEmail}</strong>) otomatis menerima email khusus berisi
                    alasan pembatalan dan tombol <strong>Ajukan Ulang Laporan</strong> yang
                    terhubung ke Frontend.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Pelapor Melengkapi Ciri Khusus',
                      'Kesalahan Penolakan Petugas',
                      'Bukti Tambahan Valid',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setReopenReason(preset);
                          if (reopenError) setReopenError('');
                        }}
                        className="px-2.5 py-1 rounded-[3px] border border-gold-ink/40 bg-sheet text-[11px] font-semibold text-ink hover:border-gold-ink cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    id="drawer-reopen-reason"
                    type="text"
                    value={reopenReason}
                    onChange={(e) => {
                      setReopenReason(e.target.value);
                      if (reopenError) setReopenError('');
                    }}
                    placeholder="Contoh: Pelapor melampirkan ciri khusus tambahan / salah tolak"
                    aria-invalid={reopenError ? true : undefined}
                    className={`${INPUT_CLASS} h-10 ${reopenError ? 'border-danger' : ''}`}
                  />
                  {reopenError && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{reopenError}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setReopenPrompt(false);
                        setReopenError('');
                      }}
                    >
                      Batal
                    </Button>
                    <Button variant="ug" size="sm" onClick={handleExecuteReopenRejected}>
                      Ya, Ubah ke Dibatalkan &amp; Kirim Email
                    </Button>
                  </div>
                </div>
              )}

              {voidPrompt && (
                <div className="rounded-[5px] border-2 border-danger/60 bg-danger-wash p-4 space-y-3">
                  <label
                    htmlFor="drawer-void-reason"
                    className="text-xs font-bold text-danger block"
                  >
                    Batalkan Status Selesai → Dibatalkan ({report.ticketCode}):
                  </label>
                  <p className="text-xs text-ink-2">
                    Status laporan akan diubah menjadi <strong>Dibatalkan</strong>. Pelapor (
                    <strong>{report.reporterEmail}</strong>) otomatis menerima email pemberitahuan
                    kesalahan sesuai alasan petugas di bawah ini.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Petugas Keliru Pilih Tiket', restoreInv: true },
                      { label: 'Barang Tertukar (Sudah Dikembalikan)', restoreInv: true },
                      { label: 'Barang Tertukar (Masih Ditarik)', restoreInv: false },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setVoidReason(preset.label);
                          setVoidRestoreInventory(preset.restoreInv);
                          if (voidError) setVoidError('');
                        }}
                        className="px-2.5 py-1 rounded-[3px] border border-danger/40 bg-sheet text-[11px] font-semibold text-ink hover:border-danger cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    id="drawer-void-reason"
                    type="text"
                    value={voidReason}
                    onChange={(e) => {
                      setVoidReason(e.target.value);
                      if (voidError) setVoidError('');
                    }}
                    placeholder="Contoh: Petugas keliru memilih tiket / barang tertukar"
                    aria-invalid={voidError ? true : undefined}
                    className={`${INPUT_CLASS} h-10 ${voidError ? 'border-danger' : ''}`}
                  />
                  {voidError && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{voidError}</span>
                    </p>
                  )}

                  {report.matchedInventoryId && (
                    <label className="flex items-start gap-2.5 text-xs text-ink-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={voidRestoreInventory}
                        onChange={(e) => setVoidRestoreInventory(e.target.checked)}
                        className="mt-0.5 accent-ug-700"
                      />
                      <span>
                        Barang fisik masih / kembali berada di loket (ubah inventori{' '}
                        <strong>{report.matchedInventoryId}</strong> kembali ke{' '}
                        <strong>Tersimpan</strong>).
                      </span>
                    </label>
                  )}

                  <label className="flex items-start gap-2.5 text-xs text-ink-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voidIncludeResubmit}
                      onChange={(e) => setVoidIncludeResubmit(e.target.checked)}
                      className="mt-0.5 accent-ug-700"
                    />
                    <span>
                      Sertakan juga tombol <strong>Ajukan Ulang Laporan</strong> di dalam email
                      pemberitahuan kesalahan (agar pelapor dapat menerbitkan tiket pengganti).
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setVoidPrompt(false);
                        setVoidError('');
                      }}
                    >
                      Batal
                    </Button>
                    <Button variant="dangerSolid" size="sm" onClick={handleExecuteVoidHandover}>
                      Ya, Ubah ke Dibatalkan &amp; Kirim Email
                    </Button>
                  </div>
                </div>
              )}

              {rejectPrompt && (
                <div className="rounded-[5px] border-2 border-danger bg-danger-wash p-4 space-y-3">
                  <label
                    htmlFor="drawer-reject-reason"
                    className="text-xs font-bold text-danger block"
                  >
                    Alasan Penolakan Laporan {report.ticketCode}:
                  </label>
                  <input
                    id="drawer-reject-reason"
                    type="text"
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (rejectError) setRejectError('');
                    }}
                    placeholder="Contoh: Dibatalkan pelapor / laporan duplikat"
                    aria-invalid={rejectError ? true : undefined}
                    className={`${INPUT_CLASS} h-10 ${rejectError ? 'border-danger' : ''}`}
                  />
                  {rejectError && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{rejectError}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setRejectPrompt(false);
                        setRejectError('');
                      }}
                    >
                      Batal
                    </Button>
                    <Button variant="dangerSolid" size="sm" onClick={handleExecuteReject}>
                      Ya, Tolak Laporan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Bar */}
          <div className="p-4 sm:p-5 bg-sheet border-t-[1.5px] border-line-strong shrink-0 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Button
                variant="gold"
                size="md"
                disabled={
                  report.status === 'Perlu Verifikasi' ||
                  report.status === 'Selesai' ||
                  report.status === 'Ditolak' ||
                  report.status === 'Dibatalkan'
                }
                onClick={handleIssueInvitation}
                className="flex-1"
              >
                <LuSend className="size-4" aria-hidden="true" />
                <span>
                  {report.status === 'Perlu Verifikasi'
                    ? 'Undangan Telah Diterbitkan'
                    : 'Terbitkan Undangan Loket'}
                </span>
              </Button>

              <Button
                variant="danger"
                size="md"
                disabled={
                  report.status === 'Ditolak' ||
                  report.status === 'Selesai' ||
                  report.status === 'Dibatalkan'
                }
                onClick={() => {
                  setRejectPrompt(true);
                  setRevertPrompt(false);
                }}
                className="shrink-0"
              >
                Tolak Laporan
              </Button>
            </div>
            <p className="text-xs text-ink-3 text-center">
              Sistem otomatis mengirim email undangan resmi ke{' '}
              <span className="font-semibold text-ink-2">{report.reporterEmail}</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const AdminReviewDrawer = ({
  report,
  reports = [],
  isOpen,
  onClose,
  inventoryList,
  canRestoreStale = false,
  onIssueInvitation,
  onRejectReport,
  onRestoreStaleReport,
  onRevertToUnmatched,
  onReopenRejectedReport,
  onVoidHandover,
  onSaveNotes,
  onOpenSecureFile,
  onGoToHandover,
}) => {
  if (!isOpen || !report) return null;

  return (
    <DrawerContent
      key={`${report.ticketCode}-${report.detailLoaded ? 'full' : 'summary'}`}
      report={report}
      reports={reports}
      onClose={onClose}
      inventoryList={inventoryList}
      canRestoreStale={canRestoreStale}
      onIssueInvitation={onIssueInvitation}
      onRejectReport={onRejectReport}
      onRestoreStaleReport={onRestoreStaleReport}
      onRevertToUnmatched={onRevertToUnmatched}
      onReopenRejectedReport={onReopenRejectedReport}
      onVoidHandover={onVoidHandover}
      onSaveNotes={onSaveNotes}
      onOpenSecureFile={onOpenSecureFile}
      onGoToHandover={onGoToHandover}
    />
  );
};
