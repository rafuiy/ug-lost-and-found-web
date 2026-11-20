import { useState } from 'react';
import { StatusStamp } from './ui/Stamp';
import { Button } from './ui/Button';
import { INPUT_CLASS, LABEL_CLASS } from './ui/styles';
import {
  LuSearch,
  LuCamera,
  LuUpload,
  LuCircleAlert,
  LuCircleCheck,
  LuLock,
  LuPrinter,
  LuArrowLeft,
  LuImage,
} from 'react-icons/lu';

function findReportByCode(reports, rawCode) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return null;
  return reports.find((r) => r.ticketCode.toUpperCase() === code) || null;
}

function getInitialHandoverState(reports, initialTicketCode) {
  if (!initialTicketCode) {
    return {
      ticketInput: '',
      loadedReport: null,
      errorMsg: '',
      recipientName: '',
      recipientNpm: '',
    };
  }
  const normalized = initialTicketCode.trim().toUpperCase();
  const found = findReportByCode(reports, normalized);
  if (!found) {
    return {
      ticketInput: normalized,
      loadedReport: null,
      errorMsg: `Tiket ${normalized} tidak ditemukan dalam database loket.`,
      recipientName: '',
      recipientNpm: '',
    };
  }
  return {
    ticketInput: normalized,
    loadedReport: found,
    errorMsg: '',
    recipientName: found.reporterName,
    recipientNpm: found.reporterNpm,
  };
}

export const AdminHandoverPage = ({
  reports,
  inventoryList,
  initialTicketCode = '',
  onCompleteHandover,
  onBackToQueue,
}) => {
  const [initialState] = useState(() =>
    getInitialHandoverState(reports, initialTicketCode)
  );

  const [ticketInput, setTicketInput] = useState(initialState.ticketInput);
  const [loadedReport, setLoadedReport] = useState(initialState.loadedReport);
  const [errorMsg, setErrorMsg] = useState(initialState.errorMsg);

  const [ktmChecked, setKtmChecked] = useState(false);
  const [secretChecked, setSecretChecked] = useState(false);

  const [recipientName, setRecipientName] = useState(initialState.recipientName);
  const [recipientNpm, setRecipientNpm] = useState(initialState.recipientNpm);
  const [handoverNotes, setHandoverNotes] = useState(
    'Diserahkan dalam kondisi fisik baik dan berfungsi normal.'
  );
  const [photoEvidence, setPhotoEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const handleLoadData = (codeToSearch) => {
    const code = (codeToSearch || ticketInput).trim().toUpperCase();
    if (!code) {
      setErrorMsg('Masukkan kode tiket pengaduan terlebih dahulu.');
      return;
    }

    const found = findReportByCode(reports, code);
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
    setErrorMsg('');
    setKtmChecked(false);
    setSecretChecked(false);
    setPhotoEvidence('');
    setReceiptData(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-2 px-1 sm:px-0">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBackToQueue} className="text-sm">
          <LuArrowLeft className="size-4" aria-hidden="true" />
          <span>Kembali ke Antrean Laporan</span>
        </Button>
        <span className="text-xs font-semibold text-ink-3">Loket D Margonda</span>
      </div>

      <div className="rounded-[5px] border-[1.5px] border-ink bg-sheet shadow-[4px_4px_0_var(--color-ink)] overflow-hidden">
        {/* Sheet Header Band */}
        <div className="on-ug bg-ug-950 text-sheet px-6 py-5 sm:px-8 border-b border-ug-800">
          <h1 className="text-xl sm:text-2xl font-bold tracking-[-0.03em]">
            Proses Serah Terima Barang
          </h1>
          <p className="text-sm text-ug-200/85 mt-1">
            Verifikasi identitas fisik KTM dan dokumentasikan penyerahan barang di loket.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {receiptData ? (
            <div className="space-y-6">
              <div className="rounded-[4px] border-[1.5px] border-ok/40 bg-ok-wash p-4 flex items-start gap-3">
                <LuCircleCheck className="size-5 text-ok shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    Serah Terima Berhasil Diselesaikan
                  </h2>
                  <p className="text-xs text-ink-2 mt-0.5">
                    Berita acara penyerahan fisik telah tersimpan permanen ke audit trail.
                  </p>
                </div>
              </div>

              {/* Physical Loket Receipt */}
              <div className="rounded-md border-2 border-ug-950 bg-sheet shadow-[4px_4px_0_var(--color-ug-950)] overflow-hidden">
                <div className="bg-gold border-b-2 border-dashed border-ug-950 px-5 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-ug-950 block text-sm tracking-tight">
                      UNIVERSITAS GUNADARMA
                    </span>
                    <span className="text-[11px] font-bold text-ug-950/80 block">
                      BIRO KEMAHASISWAAN · LOKET D MARGONDA
                    </span>
                  </div>
                  <StatusStamp status="Selesai" size="sm" rotate={-3} className="bg-sheet" />
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2.5 gap-x-4 text-xs tabular-nums">
                  <span className="font-semibold text-ink-3 uppercase">Kode Tiket</span>
                  <span className="font-bold text-ug-800">{receiptData.ticket}</span>

                  <span className="font-semibold text-ink-3 uppercase">Barang</span>
                  <span className="font-bold text-ink">{receiptData.item}</span>

                  <span className="font-semibold text-ink-3 uppercase">Penerima</span>
                  <span className="font-bold text-ink">{receiptData.recipient}</span>

                  <span className="font-semibold text-ink-3 uppercase">NPM</span>
                  <span className="font-bold text-ink">{receiptData.npm}</span>

                  <span className="font-semibold text-ink-3 uppercase">Waktu</span>
                  <span className="text-ink-2 font-medium">{receiptData.timestamp}</span>

                  <span className="font-semibold text-ink-3 uppercase">Status Akhir</span>
                  <span className="text-ok font-bold">SELESAI — DIAMBIL</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex-1"
                >
                  <LuPrinter className="size-4" aria-hidden="true" />
                  <span>Cetak Tanda Terima</span>
                </Button>
                <Button variant="ug" onClick={resetForm} className="flex-1">
                  Proses Tiket Lain
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 01 */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-2xl font-bold leading-none tracking-[-0.04em] text-ug-200 tabular-nums"
                  >
                    01
                  </span>
                  <label htmlFor="handover-ticket-input" className="text-sm font-bold text-ink">
                    Pilih / Konfirmasi Tiket &amp; Barang
                  </label>
                </div>

                <div className="flex gap-2.5">
                  <input
                    id="handover-ticket-input"
                    type="text"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: UG-7X9K2 atau UG-3M8P1"
                    className={`${INPUT_CLASS} h-11 flex-1 font-bold uppercase tabular-nums`}
                  />
                  <Button
                    variant="ug"
                    size="md"
                    onClick={() => handleLoadData()}
                    className="h-11 shrink-0"
                  >
                    <LuSearch className="size-4" aria-hidden="true" />
                    <span>Muat Data</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <span>Pilihan Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketInput('UG-7X9K2');
                      handleLoadData('UG-7X9K2');
                    }}
                    className="font-bold text-ug-700 underline decoration-2 underline-offset-4 hover:text-ug-900 tabular-nums cursor-pointer"
                  >
                    UG-7X9K2
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketInput('UG-3M8P1');
                      handleLoadData('UG-3M8P1');
                    }}
                    className="font-bold text-ug-700 underline decoration-2 underline-offset-4 hover:text-ug-900 tabular-nums cursor-pointer"
                  >
                    UG-3M8P1
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-danger-wash border-[1.5px] border-danger/40 rounded-[4px] text-xs font-semibold text-danger flex items-center gap-2">
                    <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {loadedReport && (
                  <div className="mt-3 rounded-[5px] border-[1.5px] border-ug-200 bg-ug-100 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-ug-800 tabular-nums">
                          {loadedReport.ticketCode}
                        </span>
                        <h3 className="text-sm font-bold text-ink mt-0.5">
                          {loadedReport.itemName}
                        </h3>
                        <p className="text-xs text-ink-2">{loadedReport.category}</p>
                      </div>

                      {loadedReport.itemThumbnailUrl && (
                        <div className="w-16 h-16 rounded-[4px] border border-ug-200 bg-sheet overflow-hidden shrink-0">
                          <img
                            src={loadedReport.itemThumbnailUrl}
                            alt="Foto Inventori"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2.5 border-t border-ug-200">
                      <div>
                        <span className="text-ink-3 block">Pelapor Terdaftar</span>
                        <span className="font-bold text-ink">{loadedReport.reporterName}</span>
                      </div>
                      <div>
                        <span className="text-ink-3 block">NPM Pelapor</span>
                        <span className="font-bold text-ug-800 tabular-nums">
                          {loadedReport.reporterNpm}
                        </span>
                      </div>
                    </div>

                    <div className="bg-sheet border border-ug-200 p-3 rounded-[4px] text-xs space-y-1">
                      <span className="font-bold text-ug-800 flex items-center gap-1.5 uppercase tracking-[0.06em]">
                        <LuLock className="size-4 text-ug-700" aria-hidden="true" />
                        Ciri Khusus Rahasia
                      </span>
                      <p className="text-ink font-medium">
                        &ldquo;{loadedReport.secretFeature}&rdquo;
                      </p>
                    </div>

                    {matchedInventory && (
                      <div className="text-xs text-ink bg-sheet p-2.5 rounded-[4px] border border-line-strong flex items-center justify-between gap-2">
                        <span>
                          Inventori: <strong>[{matchedInventory.id}]</strong>{' '}
                          {matchedInventory.title}
                        </span>
                        <span className="font-bold text-ug-800 tabular-nums shrink-0">
                          {matchedInventory.storageLocker}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 02 */}
              <div
                className={`space-y-3 pt-6 border-t-2 border-dotted border-line-strong ${
                  !loadedReport ? 'opacity-45 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-2xl font-bold leading-none tracking-[-0.04em] text-ug-200 tabular-nums"
                  >
                    02
                  </span>
                  <span className="text-sm font-bold text-ink">
                    Checklist Verifikasi Fisik (Wajib Centang Semua)
                  </span>
                </div>

                <div className="space-y-2 rounded-[4px] border-[1.5px] border-line-strong bg-paper p-4">
                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded-[4px] hover:bg-sheet transition-colors">
                    <input
                      type="checkbox"
                      checked={ktmChecked}
                      onChange={(e) => setKtmChecked(e.target.checked)}
                      className="mt-0.5 size-4 accent-ug-700 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-ink">
                      Fisik KTM asli pelapor telah diperiksa dan sesuai dengan data laporan.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded-[4px] hover:bg-sheet transition-colors border-t border-line pt-3">
                    <input
                      type="checkbox"
                      checked={secretChecked}
                      onChange={(e) => setSecretChecked(e.target.checked)}
                      className="mt-0.5 size-4 accent-ug-700 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-ink">
                      Pelapor telah berhasil membuktikan ciri-ciri khusus rahasia barang.
                    </span>
                  </label>
                </div>
              </div>

              {/* Step 03 */}
              <div
                className={`space-y-4 pt-6 border-t-2 border-dotted border-line-strong ${
                  !loadedReport ? 'opacity-45 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-2xl font-bold leading-none tracking-[-0.04em] text-ug-200 tabular-nums"
                  >
                    03
                  </span>
                  <span className="text-sm font-bold text-ink">
                    Dokumentasi Penerima &amp; Bukti Digital
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="recipient-name" className={LABEL_CLASS}>
                      Nama Penerima Barang
                    </label>
                    <input
                      id="recipient-name"
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nama Lengkap Penerima"
                      className={`${INPUT_CLASS} h-11`}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="recipient-npm" className={LABEL_CLASS}>
                      NPM Penerima Barang
                    </label>
                    <input
                      id="recipient-npm"
                      type="text"
                      value={recipientNpm}
                      onChange={(e) => setRecipientNpm(e.target.value)}
                      placeholder="Contoh: 51421890"
                      className={`${INPUT_CLASS} h-11 tabular-nums`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <span className={LABEL_CLASS}>
                    Upload Foto Bukti Serah Terima <span className="text-danger">*</span>
                  </span>

                  {photoEvidence ? (
                    <div className="bg-paper border-[1.5px] border-line-strong rounded-[4px] p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 bg-sheet rounded-[3px] border border-line-strong overflow-hidden shrink-0">
                          <img
                            src={photoEvidence}
                            alt="Bukti Foto"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                            <LuCircleCheck
                              className="size-4 text-ok shrink-0"
                              aria-hidden="true"
                            />
                            Foto Bukti Siap Diarsip
                          </span>
                          <span className="text-xs text-ink-3">Format JPEG Valid</span>
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setPhotoEvidence('')}
                        className="shrink-0"
                      >
                        Hapus
                      </Button>
                    </div>
                  ) : (
                    <div className="border-[1.5px] border-dashed border-line-strong rounded-[4px] p-5 text-center bg-paper">
                      <LuCamera
                        className="size-6 text-ink-3 mx-auto mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-medium text-ink-2 max-w-sm mx-auto">
                        Ambil foto pelapor memegang barang dan KTM asli di meja loket sebagai bukti audit penyerahan.
                      </p>

                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5">
                        <label className="cursor-pointer inline-flex items-center justify-center gap-2 h-8 px-3 rounded-[5px] border-[1.5px] border-ink/80 bg-sheet text-ink hover:bg-ink hover:text-sheet text-xs font-bold transition-colors">
                          <LuUpload className="size-4" aria-hidden="true" />
                          <span>Pilih Berkas Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={handleSimulatePhotoUpload}
                        >
                          <LuImage className="size-4" aria-hidden="true" />
                          <span>Gunakan Contoh Bukti</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="handover-notes" className={LABEL_CLASS}>
                    Catatan Serah Terima{' '}
                    <span className="font-medium text-ink-3">· opsional</span>
                  </label>
                  <textarea
                    id="handover-notes"
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    className={`${INPUT_CLASS} min-h-20 py-2.5 leading-relaxed`}
                  />
                </div>
              </div>

              <div className="pt-5 border-t-2 border-dotted border-line-strong space-y-2.5">
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full"
                >
                  <LuCircleCheck className="size-5" aria-hidden="true" />
                  <span>
                    {isSubmitting
                      ? 'Menyimpan ke Audit Trail...'
                      : 'Konfirmasi Serah Terima Selesai'}
                  </span>
                </Button>

                <p className="text-xs text-ink-3 text-center">
                  Mengunci tiket menjadi <strong>Selesai</strong>, inventori menjadi{' '}
                  <strong>Diambil</strong>, dan merekam log ke audit trail.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
