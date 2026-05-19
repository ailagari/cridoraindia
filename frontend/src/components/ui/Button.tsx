import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
type Size    = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
  icon?: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost:     'btn btn-ghost',
  danger:    'btn btn-danger',
  icon:      'btn btn-icon',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
}

export function Button({ variant = 'secondary', size = 'md', loading, block, icon, children, className, disabled, ...rest }: Props) {
  const cls = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block   ? 'btn--block'   : '',
    loading ? 'btn--loading' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : icon ?? null}
      {children}
    </button>
  )
}
