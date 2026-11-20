import React from 'react';
import { RiCloseLine, RiShieldCheckLine, RiLockLine } from 'react-icons/ri';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3B1259] text-white rounded-xl flex items-center justify-center">
              <RiLockLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 font-mono">
                {ticketCode ? `Tiket: ${ticketCode}` : 'Dokumen Rahasia'} • {studentName} ({studentNpm})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <RiShieldCheckLine className="w-4 h-4 text-amber-700" />
            <span>Akses Terproteksi: ADM-04D • IP 10.24.110.15</span>
          </div>
          <span className="font-mono font-semibold text-amber-800">CONFIDENTIAL</span>
        </div>

        <div className="p-6 bg-[#F8FAFC] flex-1 flex flex-col items-center justify-center overflow-auto min-h-[300px]">
          <div className="relative border border-slate-300 bg-white rounded-xl shadow-sm overflow-hidden max-h-[460px]">
            <img
              src={fileUrl}
              alt={title}
              className="max-h-[440px] w-auto object-contain mx-auto"
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15 -rotate-25">
              <span className="text-3xl font-extrabold font-mono tracking-widest text-slate-900 uppercase">
                UG LOKET D • {ticketCode}
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500 text-center">
            {fileType === 'ktm'
              ? 'Pastikan nama, foto, dan NPM cocok dengan data laporan.'
              : 'Foto pendukung barang yang diunggah pelapor.'}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-500">SHA-256 Verified: 4a9f...38bc</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#3B1259] hover:bg-[#581C87] text-white font-semibold rounded-xl transition-colors"
          >
            Tutup Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
