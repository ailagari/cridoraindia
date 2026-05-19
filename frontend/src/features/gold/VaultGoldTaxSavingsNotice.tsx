import { formatInr } from '@/features/marketplace/productPricing'

type Props = {
  gstSavedInr: number
  compact?: boolean
}

/** GST on gold is not charged again when paying from vaulted holdings (already taxed at buy/deposit). */
export function VaultGoldTaxSavingsNotice({ gstSavedInr, compact }: Props) {
  if (!(gstSavedInr > 0.005)) return null

  if (compact) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
        Vault saved you ₹{formatInr(gstSavedInr)} (no GST on gold again)
      </p>
    )
  }

  return (
    <div
      style={{
        marginTop: '0.65rem',
        padding: '0.75rem 0.85rem',
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border-soft))',
        background: 'color-mix(in srgb, var(--success) 8%, var(--veil))',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--success)' }}>
        Vault saved you ₹{formatInr(gstSavedInr)}
      </p>
      <p style={{ margin: '0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        GST on gold metal is not charged again when you pay from your holding (stone is priced separately and is
        not paid from vault grams). Deposits, fractional buys, transfers, and scheme gold were taxed when vaulted.
      </p>
    </div>
  )
}
