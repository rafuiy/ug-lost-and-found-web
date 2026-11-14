import { forwardRef } from 'react'
import { LuCircleAlert } from 'react-icons/lu'

export const INPUT_CLASS = 'block w-full rounded-[4px] border-[1.5px] bg-sheet px-3.5 text-base text-ink placeholder:text-ink-3/60 transition-colors hover:border-ink-2 focus:outline-none focus-visible:border-ug-700 focus-visible:shadow-[0_0_0_3px_var(--color-ug-100)]'

export function FieldLabel({ htmlFor, required, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-2 text-[13px] font-bold text-ink">
      {children}
      {required ? <span aria-hidden="true" className="text-ug-600">*</span> : <span className="font-medium text-ink-3">· boleh dikosongkan</span>}
    </label>
  )
}

export function FieldMessage({ id, error, hint, hintIcon: HintIcon }) {
  if (error) {
    return (
      <p id={id} className="mt-2 flex items-start gap-2 text-sm font-semibold text-danger">
        <LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {error}
      </p>
    )
  }
  if (!hint) return null
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-ink-3">
      {HintIcon && <HintIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      {hint}
    </p>
  )
}

export const Field = forwardRef(function Field({ id, label, hint, hintIcon, error, required = true, multiline = false, className = '', ...props }, ref) {
  const messageId = `${id}-message`
  const Control = multiline ? 'textarea' : 'input'
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <Control
        ref={ref}
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={`${INPUT_CLASS} ${multiline ? 'min-h-24 py-2.5 leading-relaxed' : 'h-11'} ${error ? 'border-danger' : 'border-line-strong'}`}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} hintIcon={hintIcon} />
    </div>
  )
})
