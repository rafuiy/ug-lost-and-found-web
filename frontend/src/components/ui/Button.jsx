import { Link } from 'react-router'

const BASE = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[5px] font-bold transition-[translate,box-shadow,background-color,color] duration-100 disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTS = {
  // The one loud button: gold with a pressed-stamp shadow. Use once per view.
  gold: 'border-2 border-ug-950 bg-gold text-ug-950 shadow-[4px_4px_0_var(--color-ug-950)] hover:shadow-[2px_2px_0_var(--color-ug-950)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] motion-reduce:transition-none',
  ug: 'bg-ug-700 text-sheet hover:bg-ug-800',
  outline: 'border-2 border-ink/80 text-ink hover:bg-ink hover:text-sheet',
  ghost: 'text-ink underline decoration-2 underline-offset-[6px] hover:decoration-ug-600',
}

const SIZES = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({ to, variant = 'ug', size = 'md', className = '', ...props }) {
  const classes = `${BASE} ${VARIANTS[variant]} ${variant === 'ghost' ? 'h-auto px-0' : SIZES[size]} ${className}`
  if (to) return <Link to={to} className={classes} {...props} />
  return <button type="button" className={classes} {...props} />
}
