type Size = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<Size, string> = {
  sm: 'spinner spinner--sm',
  md: 'spinner',
  lg: 'spinner spinner--lg',
}

export function Spinner({ size = 'md', label = 'Loading…' }: { size?: Size; label?: string }) {
  return <span className={SIZE_CLASS[size]} role="status" aria-label={label} />
}
