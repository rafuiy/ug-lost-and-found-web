import { Button } from './ui/Button';
import { LuX, LuShieldCheck, LuLock } from 'react-icons/lu';

export const SecureFileModal = ({
  isOpen,
  onClose,
  title,
  fileUrl,
  fileType,
  studentName,
  studentNpm,
  ticketCode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ug-950/65">
      <div className="bg-sheet border-2 border-ink rounded-[5px] shadow-[4px_4px_0_var(--color-ink)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="on-ug px-6 py-4 bg-ug-950 text-sheet border-b border-ug-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <LuLock className="size-5 text-gold shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-sheet truncate">{title}</h3>
              <p className="text-xs text-ug-200/80 tabular-nums truncate">
                {ticketCode ? `Tiket: ${ticketCode}` : 'Dokumen Rahasia'} · {studentName} ({studentNpm})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup viewer"
            className="text-sheet/80 hover:text-gold p-2 rounded-[4px] hover:bg-ug-900 transition-colors cursor-pointer shrink-0"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="bg-gold-wash border-b border-line-strong px-6 py-2.5 flex items-center justify-between gap-2 text-xs text-gold-ink">
          <div className="flex items-center gap-2 font-semibold tabular-nums">
            <LuShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>Akses Terproteksi: ADM-04D · IP 10.24.110.15</span>
          </div>
          <span className="font-bold tracking-[0.08em]">CONFIDENTIAL</span>
        </div>

        <div className="p-6 bg-paper flex-1 flex flex-col items-center justify-center overflow-auto min-h-[300px]">
          <div className="relative border-[1.5px] border-line-strong bg-sheet rounded-[4px] overflow-hidden max-h-[460px]">
            <img
              src={fileUrl}
              alt={title}
              className="max-h-[440px] w-auto object-contain mx-auto"
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15 -rotate-25">
              <span className="text-3xl font-bold tracking-widest text-ink uppercase tabular-nums">
                UG LOKET D · {ticketCode}
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-ink-2 text-center">
            {fileType === 'ktm'
              ? 'Pastikan nama, foto, dan NPM cocok dengan data laporan.'
              : 'Foto pendukung barang yang diunggah pelapor.'}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-sheet border-t border-line-strong flex items-center justify-between text-xs">
          <span className="text-ink-3 tabular-nums font-medium">
            SHA-256 Verified: 4a9f...38bc
          </span>
          <Button variant="ug" size="sm" onClick={onClose}>
            Tutup Viewer
          </Button>
        </div>
      </div>
    </div>
  );
};
