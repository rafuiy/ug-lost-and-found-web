const TONES = {
  neutral: 'text-ink-2',
  ug: 'text-ug-700',
  ok: 'text-ok',
  danger: 'text-danger',
  ink: 'text-ink',
  gold: 'text-gold',
  goldInk: 'text-gold-ink',
};

const STATUS_TONES = {
  'Belum Ada': 'neutral',
  'Perlu Verifikasi': 'ug',
  Selesai: 'ok',
  Ditolak: 'danger',
  Tersimpan: 'ug',
  Diambil: 'ok',
};

// Rubber-stamp impression: double rule in the ink colour, slightly rotated.
export function Stamp({
  tone = 'ink',
  rotate = -2,
  size = 'sm',
  wrap = false,
  className = '',
  children,
}) {
  const sizing =
    size === 'lg'
      ? 'px-4 py-2 text-lg tracking-[0.14em]'
      : size === 'md'
        ? 'px-3 py-1.5 text-sm tracking-[0.14em]'
        : 'px-2 py-1 text-[11px] tracking-[0.12em]';
  return (
    <span
      style={{ rotate: `${rotate}deg` }}
      className={`inline-block rounded-[3px] border-2 border-current font-bold uppercase outline-2 outline-offset-2 outline-current ${
        wrap ? 'text-center leading-tight' : 'whitespace-nowrap leading-none'
      } ${sizing} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusStamp({ status, tone, rotate, ...props }) {
  const resolvedRotate = rotate ?? (status === 'Ditolak' ? 2 : -2);
  return (
    <Stamp tone={tone ?? STATUS_TONES[status] ?? 'neutral'} rotate={resolvedRotate} {...props}>
      {status}
    </Stamp>
  );
}
