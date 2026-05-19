import { useCallback, useEffect, useState } from 'react'
import { fetchCridoraPayInvoiceBlob, type CridoraPayBillDTO } from '@/lib/cridorapayApi'

function isImageFilename(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')
}

type Props = {
  bill: CridoraPayBillDTO
  requireReview?: boolean
  onReviewed?: () => void
}

export function CridoraPayInvoicePreview({ bill, requireReview = false, onReviewed }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState(bill.purchase_invoice_filename || '')
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const loadInvoice = useCallback(async () => {
    setErr('')
    setBusy(true)
    try {
      const out = await fetchCridoraPayInvoiceBlob(bill.id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setFilename(out.filename)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        const url = URL.createObjectURL(out.blob)
        if (!isImageFilename(out.filename)) {
          window.open(url, '_blank', 'noopener')
        }
        return url
      })
      setReviewed(true)
      onReviewed?.()
    } finally {
      setBusy(false)
    }
  }, [bill.id, onReviewed])

  if (!bill.has_purchase_invoice) {
    return (
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        No purchase invoice attached to this bill.
      </p>
    )
  }

  return (
    <div
      style={{
        marginBottom: '0.85rem',
        padding: '0.85rem 1rem',
        borderRadius: 12,
        border: '1px solid var(--border-soft)',
        background: 'rgba(0, 8, 20, 0.28)',
      }}
    >
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        Purchase invoice
      </p>
      <p style={{ margin: '0 0 0.65rem', fontSize: '0.88rem' }}>
        {filename || bill.purchase_invoice_filename || 'Invoice file'}
      </p>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void loadInvoice()}>
        {busy ? 'Loading…' : reviewed ? 'View invoice again' : 'View purchase invoice'}
      </button>
      {requireReview && !reviewed ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--gold-light)' }}>
          Open the invoice to review before confirming payment.
        </p>
      ) : null}
      {err ? (
        <p className="form-error" style={{ margin: '0.5rem 0 0' }}>
          {err}
        </p>
      ) : null}
      {previewUrl && isImageFilename(filename) ? (
        <img
          src={previewUrl}
          alt="Purchase invoice"
          style={{
            display: 'block',
            marginTop: '0.75rem',
            maxWidth: '100%',
            maxHeight: 320,
            borderRadius: 8,
            border: '1px solid var(--border-soft)',
          }}
        />
      ) : null}
      {previewUrl && !isImageFilename(filename) ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          PDF opened in a new tab. If it did not open, tap View purchase invoice again.
        </p>
      ) : null}
    </div>
  )
}
