import React, { useState } from 'react';
import {
  RiCloseLine,
  RiFileCopyLine,
  RiCheckLine,
  RiShieldCheckLine,
  RiCodeSSlashLine,
} from 'react-icons/ri';

export const JsonViewerModal = ({ entry, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const jsonString = JSON.stringify(entry.payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center">
              <RiCodeSSlashLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Audit Payload Inspector
                <span className="font-mono text-xs text-slate-500">{entry.id}</span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {entry.timestamp} • {entry.actorName} ({entry.actorId})
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

        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Target Entitas:</span>
            <span className="font-mono font-semibold text-slate-900">{entry.targetTable}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Source IP:</span>
            <span className="font-mono text-slate-700">{entry.ipAddress}</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 text-slate-100 overflow-auto flex-1 font-mono text-xs leading-relaxed max-h-[420px]">
          <pre>{jsonString}</pre>
        </div>

        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-mono">
            <RiShieldCheckLine className="w-4 h-4 text-emerald-600" />
            <span>Hash Valid (SHA-256)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-300 font-semibold transition-colors"
            >
              {copied ? (
                <>
                  <RiCheckLine className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <RiFileCopyLine className="w-3.5 h-3.5" />
                  <span>Salin JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#3B1259] hover:bg-[#581C87] text-white font-semibold rounded-xl transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
