import { forwardRef } from 'react'
import { LuCircleAlert, LuInfo } from 'react-icons/lu'

const TONES = {
  danger: { icon: LuCircleAlert, className: 'border-danger/40 bg-danger-wash text-danger' },
  ug: { icon: LuInfo, className: 'border-ug-200 bg-ug-100 text-ug-700' },
}

export const Alert = forwardRef(function Alert({ tone = 'danger', title, children, ...props }, ref) {
  const { icon: Icon, className } = TONES[tone]
  return (
    <div ref={ref} tabIndex={-1} className={`flex gap-3 rounded-[4px] border-[1.5px] px-4 py-3 focus:outline-none ${className}`} {...props}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-ink-2">{children}</div>
      </div>
    </div>
  )
})
