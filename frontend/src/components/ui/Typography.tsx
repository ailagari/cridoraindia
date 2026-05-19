import type { HTMLAttributes, ReactNode } from 'react'

type HeadingLevel = 1 | 2 | 3
type TextTone = 'primary' | 'muted' | 'faint' | 'accent' | 'danger' | 'success'

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  level?: HeadingLevel
  children: ReactNode
}

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: TextTone
  size?: 'body' | 'sm' | 'caption' | 'micro'
  children: ReactNode
}

const TONE_CLASS: Record<TextTone, string> = {
  primary: 'ds-text',
  muted: 'ds-text ds-text--muted',
  faint: 'ds-text ds-text--faint',
  accent: 'ds-text ds-text--accent',
  danger: 'ds-text ds-text--danger',
  success: 'ds-text ds-text--success',
}

export function Heading({ level = 2, className, children, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const
  return (
    <Tag className={[`ds-heading ds-heading--${level}`, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}

export function Text({ tone = 'primary', size = 'body', className, children, ...rest }: TextProps) {
  return (
    <p className={[TONE_CLASS[tone], `ds-text--${size}`, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  )
}
