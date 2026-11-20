const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[5px] font-bold transition-[translate,box-shadow,background-color,color,border-color] duration-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS = {
  // The one loud button: gold with a pressed-stamp shadow. Use once per view.
  gold: 'border-2 border-ug-950 bg-gold text-ug-950 shadow-[4px_4px_0_var(--color-ug-950)] hover:shadow-[2px_2px_0_var(--color-ug-950)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 motion-reduce:transition-none',
  ug: 'bg-ug-700 text-sheet hover:bg-ug-800',
  outline: 'border-2 border-ink/80 bg-sheet text-ink hover:bg-ink hover:text-sheet',
  subtle: 'border-[1.5px] border-line-strong bg-sheet text-ink hover:border-ink hover:bg-paper',
  danger: 'border-2 border-danger bg-sheet text-danger hover:bg-danger hover:text-sheet',
  dangerSolid: 'bg-danger text-sheet hover:bg-danger/90',
  ghost: 'text-ink underline decoration-2 underline-offset-[6px] hover:decoration-ug-600',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'ug',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}) {
  const classes = `${BASE} ${VARIANTS[variant]} ${variant === 'ghost' ? 'h-auto px-0' : SIZES[size]} ${className}`;
  return <button type={type} className={classes} {...props} />;
}
