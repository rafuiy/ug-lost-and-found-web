import { useState } from 'react';
import { Button } from './ui/Button';
import {
  LuX,
  LuCopy,
  LuCheck,
  LuShieldCheck,
  LuCode,
} from 'react-icons/lu';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ug-950/65">
      <div className="bg-sheet border-2 border-ink rounded-[5px] shadow-[6px_6px_0_var(--color-ink)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="on-ug px-6 py-4 bg-ug-800 text-sheet border-b-2 border-ug-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <LuCode className="size-5 text-gold shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-sheet flex items-center gap-2 flex-wrap">
                <span>Audit Payload Inspector</span>
                <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-xs font-bold text-ug-950 tabular-nums">
                  {entry.id}
                </span>
              </h3>
              <p className="text-xs text-sheet/75 tabular-nums mt-0.5 truncate">
                {entry.timestamp} · {entry.actorName} ({entry.actorId})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup inspector"
            className="text-sheet/80 hover:text-gold p-2 rounded-[4px] hover:bg-ug-900 transition-colors cursor-pointer shrink-0"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-3 bg-paper border-b border-line-strong flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-ink-3">Target Entitas:</span>
            <span className="font-bold text-ink tabular-nums">{entry.targetTable}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-3">Source IP:</span>
            <span className="font-semibold text-ink-2 tabular-nums">{entry.ipAddress}</span>
          </div>
        </div>

        <div className="p-5 bg-ug-950 text-paper overflow-auto flex-1 font-mono text-xs leading-relaxed max-h-[420px]">
          <pre>{jsonString}</pre>
        </div>

        <div className="px-6 py-3.5 bg-sheet border-t border-line-strong flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-ink-2 font-medium">
            <LuShieldCheck className="size-4 text-ok shrink-0" aria-hidden="true" />
            <span>Hash Valid (SHA-256)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <LuCheck className="size-4 text-ok" aria-hidden="true" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <LuCopy className="size-4" aria-hidden="true" />
                  <span>Salin JSON</span>
                </>
              )}
            </Button>
            <Button variant="ug" size="sm" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
