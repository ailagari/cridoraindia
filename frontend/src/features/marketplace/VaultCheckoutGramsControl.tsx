type Props = {
  maxGrams: number
  grams: number
  suggestedGrams: number
  metalRateOk: boolean
  walletLoading: boolean
  jewellerName: string
  totalVaultedAllPartners: number
  onGramsChange: (grams: number) => void
  suggestLabel?: string
  rangeId?: string
}

export function VaultCheckoutGramsControl({
  maxGrams,
  grams,
  suggestedGrams,
  metalRateOk,
  walletLoading,
  jewellerName,
  totalVaultedAllPartners,
  onGramsChange,
  suggestLabel = 'Use suggested — pay full order in gold',
  rangeId = 'vault-grams-checkout',
}: Props) {
  if (walletLoading) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }} role="status">
        Loading vault balance…
      </p>
    )
  }

  if (!metalRateOk) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }} role="status">
        This listing has no metal ₹/g — vault gold cannot be applied until the jeweller sets pricing.
      </p>
    )
  }

  if (maxGrams <= 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }} role="status">
        {totalVaultedAllPartners > 1e-6 ? (
          <>
            You hold <span className="tabular">{totalVaultedAllPartners.toFixed(3)}g</span> vaulted with other partners,
            but none with <strong style={{ color: 'var(--text)' }}>{jewellerName}</strong>. Buy or transfer gold with this
            jeweller to pay from your Cridora account.
          </>
        ) : (
          <>
            No vaulted gold with <strong style={{ color: 'var(--text)' }}>{jewellerName}</strong> yet. Buy fractional gold or
            transfer grams to this jeweller before checkout.
          </>
        )}
      </p>
    )
  }

  const capped = Math.min(grams, maxGrams)
  const suggestDisabled = !Number.isFinite(suggestedGrams) || suggestedGrams <= 0

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderRadius: 12 }}
          onClick={() => onGramsChange(Math.min(maxGrams, suggestedGrams > 0 ? suggestedGrams : maxGrams))}
          disabled={suggestDisabled}
        >
          {suggestLabel}
        </button>
      </div>
      <label htmlFor={rangeId} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        Grams (0 – {maxGrams.toFixed(3)})
      </label>
      <input
        id={rangeId}
        type="range"
        min={0}
        max={maxGrams}
        step={0.001}
        value={capped}
        onChange={(e) => onGramsChange(Number.parseFloat(e.target.value))}
        style={{ width: '100%', marginTop: '0.5rem' }}
      />
      <input
        type="number"
        min={0}
        max={maxGrams}
        step={0.001}
        value={capped}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value)
          if (!Number.isFinite(v)) onGramsChange(0)
          else onGramsChange(Math.max(0, Math.min(maxGrams, v)))
        }}
        style={{
          width: '100%',
          marginTop: '0.5rem',
          padding: '0.5rem',
          borderRadius: 10,
          border: '1px solid var(--border-soft)',
          background: 'var(--veil)',
          color: 'var(--text)',
          fontFamily: 'var(--font)',
        }}
      />
    </div>
  )
}
