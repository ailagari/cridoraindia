type Props = {
  title: string
  lines: string[]
}

export function SchemeSectionPreview({ title, lines }: Props) {
  if (lines.length === 0) return null
  return (
    <div
      className="scheme-section-preview"
      style={{
        marginTop: 'var(--sp-3)',
        padding: 'var(--sp-3)',
        borderRadius: 'var(--r-md)',
        background: 'var(--silk-06)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <p
        className="ds-field__label"
        style={{ margin: '0 0 var(--sp-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {title}
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem' }}>
        {lines.map((line) => (
          <li key={line} className="ds-field__hint" style={{ margin: 0, lineHeight: 1.45 }}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}
