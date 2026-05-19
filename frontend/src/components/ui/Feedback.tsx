type Tone = 'error' | 'success' | 'warning'

type Props = {
  children: string
  tone?: Tone
}

const CLASS: Record<Tone, string> = {
  error: 'ds-feedback ds-feedback--error',
  success: 'ds-feedback ds-feedback--success',
  warning: 'ds-feedback ds-feedback--warning',
}

export function Feedback({ children, tone = 'error' }: Props) {
  return (
    <p className={CLASS[tone]} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
