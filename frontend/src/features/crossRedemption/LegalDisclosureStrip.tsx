import { useState } from 'react'
import { crossRedemptionTransactionalLines } from '@/features/crossRedemption/legalCopy'

type Props = {
  /** Optional title for the disclosure block */
  title?: string
  className?: string
}

/**
 * Collapsed: first 2 lines. Expanded: up to 4 lines. No backend state leakage.
 */
export function LegalDisclosureStrip({ title = 'About this transfer', className }: Props) {
  const [open, setOpen] = useState(false)
  const lines = crossRedemptionTransactionalLines
  const visible = open ? lines.slice(0, 4) : lines.slice(0, 2)

  return (
    <section
      className={className}
      style={{
        marginTop: '1rem',
        padding: '0.75rem 1rem',
        borderRadius: 8,
        border: '1px solid var(--border-soft)',
        background: 'var(--surface-muted)',
        fontSize: '0.78rem',
        lineHeight: 1.5,
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <strong style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{title}</strong>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.15rem 0.5rem', fontSize: '0.65rem', flexShrink: 0 }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Less' : 'More'}
        </button>
      </div>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
        {visible.map((t) => (
          <li key={t} style={{ marginBottom: '0.35rem' }}>
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
