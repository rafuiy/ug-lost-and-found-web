import { STATUS } from '../../data/statuses'

const TONES = {
  neutral: 'text-ink-2',
  ug: 'text-ug-700',
  ok: 'text-ok',
  danger: 'text-danger',
  ink: 'text-ink',
  gold: 'text-gold',
}

// Rubber-stamp impression: double rule in the ink colour, slightly rotated. The loket stamps paper; so does the UI.
export function Stamp({ tone = 'ink', rotate = -4, size = 'md', wrap = false, className = '', children }) {
  const sizing = size === 'lg' ? 'px-4 py-2 text-lg tracking-[0.14em]' : size === 'sm' ? 'px-2 py-1 text-[11px] tracking-[0.12em]' : 'px-3 py-1.5 text-sm tracking-[0.14em]'
  return (
    <span
      style={{ rotate: `${rotate}deg` }}
      className={`inline-block rounded-[3px] border-2 border-current font-bold uppercase outline-2 outline-offset-2 outline-current ${wrap ? 'text-center leading-tight' : 'whitespace-nowrap leading-none'} ${sizing} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusStamp({ status, tone, ...props }) {
  return <Stamp tone={tone ?? STATUS[status]?.tone ?? 'neutral'} {...props}>{status}</Stamp>
}
