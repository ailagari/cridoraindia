import { upiProofImageUrl } from '@/features/upi/upiPaymentApi'

type Props = {
  utr?: string
  proofFileUrl?: string
}

export function UpiProofTableCell({ utr, proofFileUrl }: Props) {
  const imgUrl = upiProofImageUrl(proofFileUrl ?? '')
  const hasUtr = Boolean(utr && utr !== '—')
  if (!hasUtr && !imgUrl) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }
  return (
    <div className="upi-proof-table-cell">
      {hasUtr ? (
        <p style={{ margin: 0, fontSize: '0.82rem' }}>
          <span className="tabular fractional-upi-utr-display">{utr}</span>
        </p>
      ) : null}
      {imgUrl ? (
        <a
          href={imgUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="upi-proof-review__thumb"
          style={{ marginTop: hasUtr ? '0.35rem' : 0 }}
        >
          <img src={imgUrl} alt="Payment screenshot" width={72} height={72} />
        </a>
      ) : null}
    </div>
  )
}
