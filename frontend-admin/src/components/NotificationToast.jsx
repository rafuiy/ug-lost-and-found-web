import {
  LuCircleCheck,
  LuCircleAlert,
  LuInfo,
  LuX,
} from 'react-icons/lu';

export const NotificationToast = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        let styleClass = 'border-ug-700 bg-ug-100 text-ink';
        let icon = <LuInfo className="size-4 text-ug-700" aria-hidden="true" />;

        if (toast.type === 'success') {
          styleClass = 'border-ok bg-ok-wash text-ink';
          icon = <LuCircleCheck className="size-4 text-ok" aria-hidden="true" />;
        } else if (toast.type === 'warning') {
          styleClass = 'border-gold-ink bg-gold-wash text-ink';
          icon = <LuCircleAlert className="size-4 text-gold-ink" aria-hidden="true" />;
        } else if (toast.type === 'error') {
          styleClass = 'border-danger bg-danger-wash text-ink';
          icon = <LuCircleAlert className="size-4 text-danger" aria-hidden="true" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-[5px] border-2 shadow-[4px_4px_0_var(--color-ink)] ${styleClass} flex items-start gap-3`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-ink">{toast.title}</h4>
              <p className="text-ink-2 mt-0.5 leading-normal">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-ink-3 hover:text-ink p-0.5 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <LuX className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
