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
  rotate = 0,
  size = 'sm',
  wrap = false,
  className = '',
  children,
}) {
  const sizing =
    size === 'lg'
      ? 'border-2 outline-2 outline-offset-2 px-4 py-2 text-lg tracking-[0.14em]'
      : size === 'md'
        ? 'border-2 outline-2 outline-offset-2 px-3 py-1.5 text-sm tracking-[0.14em]'
        : 'border-[1.5px] outline-1 outline-offset-2 px-2 py-0.5 text-[10px] tracking-[0.11em]';
  return (
    <span
      style={{ rotate: `${rotate}deg` }}
      className={`inline-block rounded-[3px] border-current font-bold uppercase outline-current ${
        wrap ? 'text-center leading-tight' : 'whitespace-nowrap leading-none'
      } ${sizing} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusStamp({ status, tone, rotate = 0, ...props }) {
  return (
    <Stamp tone={tone ?? STATUS_TONES[status] ?? 'neutral'} rotate={rotate} {...props}>
      {status}
    </Stamp>
  );
}
