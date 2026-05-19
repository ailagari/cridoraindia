import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { UpiPayMethodNotice } from '@/components/UpiPayMethodNotice'
import {
  jewellerFetchSellbackPayout,
  jewellerSubmitSellbackUtr,
  type JewellerSellbackRowDTO,
  type SellbackPayoutPayload,
} from '@/lib/goldTransferApi'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { openUpiPayUri } from '@/lib/openUpiPayUri'

type Props = {
  row: JewellerSellbackRowDTO
  busy: boolean
  setBusy: (v: boolean) => void
  onUpdated: () => void | Promise<void>
  onSuccess: (message: string) => void
}

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function SellbackUpiPayoutStep({ row, busy, setBusy, onUpdated, onSuccess }: Props) {
  const narrow = usePublicLayoutMax767()
  const [payout, setPayout] = useState<SellbackPayoutPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [qrSrc, setQrSrc] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  const refreshPayout = useCallback(async () => {
    setLoadErr('')
    const out = await jewellerFetchSellbackPayout(row.id)
    if (!out.ok) {
      setLoadErr(out.detail)
      setPayout(null)
      return
    }
    setPayout(out.data.payout)
  }, [row.id])

  useEffect(() => {
    if (row.status === 'accepted_awaiting_otp') {
      void refreshPayout()
    }
  }, [row.status, refreshPayout])

  useEffect(() => {
    const uri = payout?.upi_uri ?? ''
    if (!uri || narrow) {
      setQrSrc('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(uri, { margin: 1, width: 180, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setQrSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [payout?.upi_uri, narrow])

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg(`${label} copied`)
      window.setTimeout(() => setCopyMsg(''), 2000)
    } catch {
      setCopyMsg('Copy failed')
      window.setTimeout(() => setCopyMsg(''), 2000)
    }
  }

  const copyPaymentDetails = async () => {
    if (!payout) return
    const lines = [
      `UPI ID: ${payout.payee_vpa}`,
      `Amount: ₹${formatInr(payout.amount_inr)}`,
      `Note: ${payout.payment_note}`,
      `Ref: ${payout.reference}`,
    ]
    await copyText(lines.join('\n'), 'Payment details')
  }

  const openUpiApp = () => {
    if (!payout?.upi_uri) return
    openUpiPayUri(payout.upi_uri)
  }

  const pasteUtr = async () => {
    setActionErr('')
    try {
      const text = await navigator.clipboard.readText()
      setUtrInput(text.trim())
    } catch {
      setActionErr('Could not read clipboard. Paste manually.')
    }
  }

  const submitUtr = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await jewellerSubmitSellbackUtr(row.id, utrInput)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await onUpdated()
      onSuccess(`UTR submitted for ${row.reference}. Waiting for customer confirmation.`)
    } finally {
      setBusy(false)
    }
  }

  if (row.status === 'awaiting_utr_verify') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">Payout proof submitted</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          UTR <strong className="tabular">{row.upi_utr || utrInput}</strong> submitted for{' '}
          <strong>{row.reference}</strong>. The customer will confirm receipt in their app before vault gold is debited.
        </p>
      </div>
    )
  }

  if (row.status !== 'accepted_awaiting_otp') return null

  return (
    <div className="fractional-upi-pay card">
      <p className="fractional-upi-pay__title">Pay customer via UPI</p>
      <p className="fractional-upi-pay__lead">
        Send <strong className="tabular">₹{formatInr(row.cash_estimate_inr)}</strong> to{' '}
        <strong>{row.customer_label}</strong>. Then paste the <strong>UPI reference number</strong> from your receipt
        below.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {payout?.expired ? (
        <p className="form-error">This payout window expired. Ask the customer to submit a new sellback.</p>
      ) : null}

      {payout && !payout.expired ? (
        <>
          <UpiPayMethodNotice compact={narrow} />

          <div className="fractional-upi-pay__payee">
            <span className="fractional-upi-pay__label">Pay to UPI ID</span>
            <p className="fractional-upi-pay__vpa tabular">{payout.payee_vpa}</p>
            <p className="fractional-upi-pay__meta">
              {payout.payee_name} · Ref {payout.reference}
            </p>
          </div>

          <div className="fractional-upi-pay__actions">
            <button type="button" className="btn btn-primary btn--block" disabled={busy} onClick={openUpiApp}>
              Open UPI app to pay
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyPaymentDetails()}
            >
              Copy payment details
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyText(payout.payee_vpa, 'UPI ID')}
            >
              Copy UPI ID
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyText(payout.amount_inr, 'Amount')}
            >
              Copy amount (₹{formatInr(payout.amount_inr)})
            </button>
          </div>
          {copyMsg ? <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{copyMsg}</p> : null}

          {!narrow && qrSrc ? (
            <>
              <p className="fractional-upi-pay__qr-caption">
                Desktop only: scan with another phone&apos;s UPI camera. Do not upload this image in PhonePe gallery.
              </p>
              <img src={qrSrc} alt="" width={180} height={180} className="fractional-upi-pay__qr" />
            </>
          ) : null}

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor={`sb-utr-${row.id}`}>UPI reference (UTR)</label>
            <input
              id={`sb-utr-${row.id}`}
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value)}
              placeholder="12-digit ref from GPay / PhonePe receipt"
              autoComplete="off"
              inputMode="text"
            />
          </div>
          <button type="button" className="btn btn-ghost btn--block" disabled={busy} onClick={() => void pasteUtr()}>
            Paste from clipboard
          </button>
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={busy || utrInput.trim().length < 8}
            onClick={() => void submitUtr()}
          >
            Submit UTR
          </button>
          {actionErr ? <p className="form-error">{actionErr}</p> : null}
        </>
      ) : null}
    </div>
  )
}
