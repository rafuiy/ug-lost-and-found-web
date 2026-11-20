import React, { useState, useEffect } from 'react';
import {
  RiCheckboxMultipleLine,
  RiSearchLine,
  RiCameraLine,
  RiUploadCloud2Line,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLockLine,
  RiPrinterLine,
  RiArrowLeftLine,
  RiImageLine,
} from 'react-icons/ri';

export const AdminHandoverPage = ({
  reports,
  inventoryList,
  initialTicketCode = '',
  onCompleteHandover,
  onBackToQueue,
}) => {
  const [ticketInput, setTicketInput] = useState(initialTicketCode);
  const [loadedReport, setLoadedReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [ktmChecked, setKtmChecked] = useState(false);
  const [secretChecked, setSecretChecked] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [recipientNpm, setRecipientNpm] = useState('');
  const [handoverNotes, setHandoverNotes] = useState(
    'Diserahkan dalam kondisi fisik baik dan berfungsi normal.'
  );
  const [photoEvidence, setPhotoEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    if (initialTicketCode) {
      handleLoadData(initialTicketCode);
    }
  }, [initialTicketCode]);

  const handleLoadData = (codeToSearch) => {
    const code = (codeToSearch || ticketInput).trim().toUpperCase();
    if (!code) {
      setErrorMsg('Masukkan kode tiket pengaduan terlebih dahulu.');
      return;
    }

    const found = reports.find((r) => r.ticketCode.toUpperCase() === code);
    if (!found) {
      setErrorMsg(`Tiket ${code} tidak ditemukan dalam database loket.`);
      setLoadedReport(null);
      return;
    }

    setErrorMsg('');
    setLoadedReport(found);
    setRecipientName(found.reporterName);
    setRecipientNpm(found.reporterNpm);
    setKtmChecked(false);
    setSecretChecked(false);
  };

  const matchedInventory = loadedReport?.matchedInventoryId
    ? inventoryList.find((inv) => inv.id === loadedReport.matchedInventoryId)
    : null;

  const handleSimulatePhotoUpload = () => {
    setPhotoEvidence(
      'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=600&q=80'
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoEvidence(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    }
  };

  const isFormValid =
    loadedReport !== null &&
    ktmChecked &&
    secretChecked &&
    recipientName.trim().length > 0 &&
    recipientNpm.trim().length > 0 &&
    photoEvidence.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid || !loadedReport) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onCompleteHandover({
        ticketCode: loadedReport.ticketCode,
        recipientName,
        recipientNpm,
        notes: handoverNotes,
        photoEvidence,
      });

      setReceiptData({
        ticket: loadedReport.ticketCode,
        recipient: recipientName,
        npm: recipientNpm,
        item: loadedReport.itemName,
        timestamp: new Date().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'medium',
        }),
      });
      setIsSubmitting(false);
    }, 500);
  };

  const resetForm = () => {
    setLoadedReport(null);
    setTicketInput('');
    setKtmChecked(false);
    setSecretChecked(false);
    setPhotoEvidence('');
    setReceiptData(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-4 px-2 sm:px-0">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToQueue}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>Kembali ke Antrean Laporan</span>
        </button>
        <span className="text-xs text-slate-500 font-mono">Loket D Margonda</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-5 mb-6">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#3B1259] flex items-center justify-center">
              <RiCheckboxMultipleLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Proses Serah Terima Barang
              </h1>
              <p className="text-sm text-slate-500">
                Verifikasi identitas fisik KTM dan dokumentasikan penyerahan barang di loket.
              </p>
            </div>
          </div>
        </div>

        {receiptData ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <RiCheckboxCircleLine className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h2 className="text-base font-bold text-emerald-900">
                Serah Terima Berhasil Diselesaikan
              </h2>
              <p className="text-xs text-emerald-800 mt-1">
                Berita acara penyerahan fisik telah tersimpan permanen ke audit trail.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 bg-[#F8FAFC] font-mono text-xs space-y-2.5">
              <div className="text-center pb-3 border-b border-slate-200">
                <span className="font-bold text-slate-900 block text-sm">
                  UNIVERSITAS GUNADARMA
                </span>
                <span className="text-[11px] text-slate-600 block">
                  BIRO KEMAHASISWAAN • LOKET D MARGONDA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 text-slate-700 pt-1">
                <span className="text-slate-500">KODE TIKET:</span>
                <span className="font-bold text-[#3B1259]">{receiptData.ticket}</span>

                <span className="text-slate-500">BARANG:</span>
                <span className="font-bold text-slate-900">{receiptData.item}</span>

                <span className="text-slate-500">PENERIMA:</span>
                <span className="font-bold text-slate-900">{receiptData.recipient}</span>

                <span className="text-slate-500">NPM:</span>
                <span className="font-bold text-slate-900">{receiptData.npm}</span>

                <span className="text-slate-500">WAKTU:</span>
                <span className="text-slate-700">{receiptData.timestamp}</span>

                <span className="text-slate-500">STATUS AKHIR:</span>
                <span className="text-emerald-700 font-bold">SELESAI (DIAMBIL)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 transition-colors"
              >
                <RiPrinterLine className="w-4 h-4 text-slate-600" />
                <span>Cetak Tanda Terima</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 px-4 bg-[#3B1259] hover:bg-[#581C87] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Proses Tiket Lain
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7">
            {/* Step 1 */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-[#3B1259] text-white rounded-lg inline-flex items-center justify-center text-xs font-mono">
                  1
                </span>
                Pilih / Konfirmasi Tiket &amp; Barang
              </label>

              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: UG-7X9K2 atau UG-3M8P1"
                  className="flex-1 px-3.5 py-2.5 text-sm font-mono font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700 uppercase"
                />
                <button
                  type="button"
                  onClick={() => handleLoadData()}
                  className="px-4 py-2.5 bg-[#3B1259] hover:bg-[#581C87] text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0"
                >
                  <RiSearchLine className="w-4 h-4" />
                  <span>Muat Data</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Pilihan Cepat:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTicketInput('UG-7X9K2');
                    handleLoadData('UG-7X9K2');
                  }}
                  className="underline hover:text-[#3B1259] font-mono"
                >
                  UG-7X9K2
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setTicketInput('UG-3M8P1');
                    handleLoadData('UG-3M8P1');
                  }}
                  className="underline hover:text-[#3B1259] font-mono"
                >
                  UG-3M8P1
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <RiAlertLine className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {loadedReport && (
                <div className="mt-3 bg-[#F3EEF8] border border-purple-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#3B1259]">
                        {loadedReport.ticketCode}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {loadedReport.itemName}
                      </h3>
                      <p className="text-xs text-slate-500">{loadedReport.category}</p>
                    </div>

                    {loadedReport.itemThumbnailUrl && (
                      <div className="w-16 h-16 rounded-xl border border-purple-200 bg-white overflow-hidden shrink-0">
                        <img
                          src={loadedReport.itemThumbnailUrl}
                          alt="Foto Inventori"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-purple-200">
                    <div>
                      <span className="text-slate-500 block">Pelapor Terdaftar</span>
                      <span className="font-semibold text-slate-900">
                        {loadedReport.reporterName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">NPM Pelapor</span>
                      <span className="font-mono font-semibold text-[#3B1259]">
                        {loadedReport.reporterNpm}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase mb-1">
                      <RiLockLine className="w-3.5 h-3.5 text-amber-700" /> Ciri Khusus Rahasia:
                    </span>
                    <p className="text-amber-950 font-medium">"{loadedReport.secretFeature}"</p>
                  </div>

                  {matchedInventory && (
                    <div className="text-xs text-[#3B1259] bg-white p-2.5 rounded-lg border border-purple-200 flex items-center justify-between">
                      <span>
                        Inventori: <strong>[{matchedInventory.id}]</strong> {matchedInventory.title}
                      </span>
                      <span className="font-mono font-semibold">{matchedInventory.storageLocker}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div
              className={`space-y-3 pt-5 border-t border-slate-200 ${
                !loadedReport ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-[#3B1259] text-white rounded-lg inline-flex items-center justify-center text-xs font-mono">
                  2
                </span>
                Checklist Verifikasi Fisik (Wajib Centang Semua)
              </label>

              <div className="space-y-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={ktmChecked}
                    onChange={(e) => setKtmChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-purple-800 rounded border-slate-300 focus:ring-purple-700"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Fisik KTM asli pelapor telah diperiksa dan sesuai dengan data laporan.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors border-t border-slate-200 pt-3">
                  <input
                    type="checkbox"
                    checked={secretChecked}
                    onChange={(e) => setSecretChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-purple-800 rounded border-slate-300 focus:ring-purple-700"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Pelapor telah berhasil membuktikan ciri-ciri khusus rahasia barang.
                  </span>
                </label>
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`space-y-4 pt-5 border-t border-slate-200 ${
                !loadedReport ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-[#3B1259] text-white rounded-lg inline-flex items-center justify-center text-xs font-mono">
                  3
                </span>
                Dokumentasi Penerima &amp; Bukti Digital
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-800 block mb-1">
                    Nama Penerima Barang
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Nama Lengkap Penerima"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-800 block mb-1">
                    NPM Penerima Barang
                  </label>
                  <input
                    type="text"
                    value={recipientNpm}
                    onChange={(e) => setRecipientNpm(e.target.value)}
                    placeholder="Contoh: 51421890"
                    className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800 block mb-1.5">
                  Upload Foto Bukti Serah Terima <span className="text-rose-600">*</span>
                </label>

                {photoEvidence ? (
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-200 rounded-lg border border-slate-300 overflow-hidden shrink-0">
                        <img
                          src={photoEvidence}
                          alt="Bukti Foto"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          <RiCheckboxCircleLine className="w-4 h-4 text-emerald-600" />
                          Foto Bukti Siap Diarsip
                        </span>
                        <span className="text-xs text-slate-500 font-mono">Format JPEG Valid</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoEvidence('')}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200"
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center bg-[#F8FAFC] hover:bg-slate-100 transition-colors">
                    <RiCameraLine className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700 max-w-sm mx-auto">
                      Ambil foto pelapor memegang barang dan KTM asli di meja loket sebagai bukti audit penyerahan.
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
                        <RiUploadCloud2Line className="w-3.5 h-3.5" />
                        <span>Pilih Berkas Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleSimulatePhotoUpload}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F3EEF8] border border-purple-200 hover:bg-purple-100 text-[#3B1259] text-xs font-semibold rounded-lg"
                      >
                        <RiImageLine className="w-3.5 h-3.5" />
                        <span>Gunakan Contoh Bukti</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800 block mb-1">
                  Catatan Serah Terima <span className="text-xs font-normal text-slate-500">(Opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-700"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full py-3.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  !isFormValid || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RiCheckboxCircleLine className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Menyimpan ke Audit Trail...' : 'Konfirmasi Serah Terima Selesai'}
                </span>
              </button>

              <p className="text-xs text-slate-500 text-center">
                Mengunci tiket menjadi <strong>Selesai</strong>, inventori menjadi <strong>Diambil</strong>, dan merekam log ke audit trail.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
