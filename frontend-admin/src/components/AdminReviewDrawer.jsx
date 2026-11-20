import React, { useState, useEffect } from 'react';
import { StatusBadge, StaleBadge } from './AdminBadges';
import {
  RiCloseLine,
  RiLockLine,
  RiWhatsappLine,
  RiMapPinLine,
  RiCalendarLine,
  RiUserLine,
  RiMailLine,
  RiPhoneLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiSendPlaneLine,
  RiSaveLine,
  RiEyeLine,
} from 'react-icons/ri';

export const AdminReviewDrawer = ({
  report,
  isOpen,
  onClose,
  inventoryList,
  onIssueInvitation,
  onRejectReport,
  onSaveNotes,
  onOpenSecureFile,
  onGoToHandover,
}) => {
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (report) {
      setSelectedInventoryId(report.matchedInventoryId || '');
      setAdminNotes(report.adminNotes || '');
      setNotesSaved(false);
      setRejectPrompt(false);
      setRejectReason('');
    }
  }, [report]);

  if (!isOpen || !report) return null;

  const availableInventory = inventoryList.filter(
    (item) => item.status === 'Tersimpan' || item.id === report.matchedInventoryId
  );

  const matchedInventory = inventoryList.find((item) => item.id === selectedInventoryId);

  const handleSaveNotes = () => {
    onSaveNotes(report.ticketCode, adminNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  };

  const handleIssueInvitation = () => {
    onIssueInvitation(report.ticketCode, selectedInventoryId, adminNotes);
  };

  const handleExecuteReject = () => {
    if (!rejectReason.trim()) {
      alert('Mohon cantumkan alasan penolakan laporan.');
      return;
    }
    onRejectReport(report.ticketCode, rejectReason);
    setRejectPrompt(false);
  };

  const formatPhoneForWa = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '62' + cleaned.slice(1);
    }
    return cleaned;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#3B1259] text-white flex items-center justify-center font-bold text-xs">
                UG
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">
                    Review Pengaduan:{' '}
                    <span className="font-mono text-[#3B1259]">{report.ticketCode}</span>
                  </h2>
                  <StatusBadge status={report.status} />
                  {report.isStale && <StaleBadge />}
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Diajukan {report.reportedAt} WIB
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Tutup"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Data Laporan Mahasiswa */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <RiUserLine className="w-4 h-4 text-[#581C87]" />
                  Data Laporan Mahasiswa
                </h3>
                <span className="text-xs text-slate-400 font-mono">{report.ticketCode}</span>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Nama Lengkap</span>
                    <span className="font-semibold text-slate-900">{report.reporterName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">NPM</span>
                    <span className="font-mono font-semibold text-[#3B1259]">
                      {report.reporterNpm}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Email Institusi</span>
                    <span className="text-slate-800 font-mono text-xs flex items-center gap-1.5 mt-0.5">
                      <RiMailLine className="w-3.5 h-3.5 text-slate-400" />
                      {report.reporterEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">WhatsApp</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-800 font-mono text-xs flex items-center gap-1.5">
                        <RiPhoneLine className="w-3.5 h-3.5 text-slate-400" />
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
                      >
                        <RiWhatsappLine className="w-3 h-3" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <RiMapPinLine className="w-3.5 h-3.5 text-slate-400" />
                      Lokasi Hilang
                    </span>
                    <span className="text-slate-800 font-medium text-xs mt-0.5 block">
                      {report.lostLocation}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <RiCalendarLine className="w-3.5 h-3.5 text-slate-400" />
                      Waktu Hilang
                    </span>
                    <span className="text-slate-800 font-mono text-xs mt-0.5 block">
                      {report.lostDate}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block mb-1.5">Deskripsi Barang</span>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-900 block mb-1">
                      {report.itemName}{' '}
                      <span className="text-xs font-normal text-slate-500">({report.category})</span>
                    </span>
                    <span className="text-xs text-slate-600">{report.description}</span>
                  </div>
                </div>
              </div>

              {/* Ciri Khusus Rahasia */}
              <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-amber-900 font-bold text-xs uppercase tracking-wide">
                  <span className="flex items-center gap-2">
                    <RiLockLine className="w-4 h-4 text-amber-700" />
                    Ciri Khusus Rahasia Pelapor
                  </span>
                  <span className="font-normal text-amber-800">Internal Only</span>
                </div>
                <p className="text-sm text-amber-950 font-medium leading-relaxed bg-white/70 p-3 rounded-lg border border-amber-200">
                  "{report.secretFeature}"
                </p>
              </div>

              {/* Preview Dokumen */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2.5 uppercase tracking-wider">
                  Preview Dokumen
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden shrink-0">
                        <img
                          src={report.ktmThumbnailUrl}
                          alt="KTM"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">Foto KTM</div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {report.ktmFileName || 'Tervalidasi'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenSecureFile(
                          `KTM Pelapor - ${report.reporterName}`,
                          report.ktmThumbnailUrl,
                          'ktm'
                        )
                      }
                      className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <RiEyeLine className="w-3.5 h-3.5" />
                      Buka
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {report.itemThumbnailUrl ? (
                          <img
                            src={report.itemThumbnailUrl}
                            alt="Barang"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <RiArchiveLine className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">Foto Barang</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {report.itemThumbnailUrl
                            ? report.supportFileName || 'Tersedia'
                            : 'Tidak diunggah'}
                        </div>
                      </div>
                    </div>
                    {report.itemThumbnailUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSecureFile(
                            `Foto Barang - ${report.itemName}`,
                            report.itemThumbnailUrl,
                            'item'
                          )
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition-colors flex items-center gap-1 shrink-0"
                      >
                        <RiEyeLine className="w-3.5 h-3.5" />
                        Buka
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pencocokan Inventori */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <RiArchiveLine className="w-4 h-4 text-[#581C87]" />
                  Pencocokan Inventori Fisik
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {availableInventory.length} Tersimpan
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Pilih Barang Temuan Fisik dari Inventori:
                </label>
                <select
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700 font-mono"
                >
                  <option value="">-- Belum Dipilih / Tidak Ada Temuan Cocok --</option>
                  {availableInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.id}] {item.title} — {item.foundLocation} ({item.foundDate})
                    </option>
                  ))}
                </select>
              </div>

              {matchedInventory ? (
                <div className="bg-[#F3EEF8] border border-purple-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-[#3B1259]">
                        [{matchedInventory.id}]
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {matchedInventory.title}
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-[#3B1259] font-semibold">
                      {matchedInventory.storageLocker}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-purple-200">
                    {matchedInventory.notes}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <RiCheckboxCircleLine className="w-4 h-4" />
                      Barang siap dicocokkan
                    </span>
                    {report.status === 'Perlu Verifikasi' && onGoToHandover && (
                      <button
                        type="button"
                        onClick={() => onGoToHandover(report.ticketCode)}
                        className="text-xs font-bold text-[#3B1259] hover:text-[#581C87] underline"
                      >
                        Buka Form Serah Terima &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500">
                  Belum ada barang fisik inventori yang dipasangkan.
                </div>
              )}

              {/* Admin Notes */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Catatan Internal Petugas (admin_notes):
                  </label>
                  {notesSaved && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <RiCheckboxCircleLine className="w-3.5 h-3.5" /> Tersimpan
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan internal petugas loket..."
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors inline-flex items-center gap-1.5"
                  >
                    <RiSaveLine className="w-3.5 h-3.5" />
                    Simpan Catatan
                  </button>
                </div>
              </div>

              {rejectPrompt && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 space-y-2.5">
                  <span className="text-xs font-bold text-rose-900 block">
                    Alasan Penolakan Laporan {report.ticketCode}:
                  </span>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Contoh: Dibatalkan pelapor / laporan duplikat"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-600"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectPrompt(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteReject}
                      className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-lg"
                    >
                      Ya, Tolak Laporan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Bar */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                disabled={report.status === 'Perlu Verifikasi' || report.status === 'Selesai'}
                onClick={handleIssueInvitation}
                className={`flex-1 bg-[#3B1259] hover:bg-[#581C87] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 ${
                  report.status === 'Perlu Verifikasi' || report.status === 'Selesai'
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                <RiSendPlaneLine className="w-4 h-4" />
                <span>
                  {report.status === 'Perlu Verifikasi'
                    ? 'Undangan Telah Diterbitkan'
                    : 'Terbitkan Undangan Loket'}
                </span>
              </button>

              <button
                type="button"
                disabled={report.status === 'Ditolak' || report.status === 'Selesai'}
                onClick={() => setRejectPrompt(true)}
                className={`bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0 ${
                  report.status === 'Ditolak' || report.status === 'Selesai'
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                Tolak Laporan
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Sistem otomatis mengirim email undangan resmi ke{' '}
              <span className="font-mono">{report.reporterEmail}</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
