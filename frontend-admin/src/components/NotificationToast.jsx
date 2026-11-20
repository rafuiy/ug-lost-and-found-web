import React from 'react';
import {
  RiCheckboxCircleLine,
  RiAlertLine,
  RiInformationLine,
  RiCloseLine,
} from 'react-icons/ri';

export const NotificationToast = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-slate-300';
        let bgClass = 'bg-white';
        let icon = <RiInformationLine className="w-4 h-4 text-[#3B1259]" />;

        if (toast.type === 'success') {
          borderClass = 'border-emerald-300';
          bgClass = 'bg-emerald-50';
          icon = <RiCheckboxCircleLine className="w-4 h-4 text-emerald-700" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-300';
          bgClass = 'bg-amber-50';
          icon = <RiAlertLine className="w-4 h-4 text-amber-700" />;
        } else if (toast.type === 'error') {
          borderClass = 'border-rose-300';
          bgClass = 'bg-rose-50';
          icon = <RiAlertLine className="w-4 h-4 text-rose-700" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-lg ${bgClass} ${borderClass} flex items-start gap-3`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-slate-900">{toast.title}</h4>
              <p className="text-slate-600 mt-0.5 leading-normal">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Tutup notifikasi"
            >
              <RiCloseLine className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
