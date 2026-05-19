import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  fractionalFetchPayment,
  fractionalSubmitUtr,
  type FractionalPaymentPayload,
  type FractionalPurchaseDTO,
} from '@/lib/fractionalPurchaseApi'

type Props = {
  order: FractionalPurchaseDTO
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

export function FractionalUpiPayStep({ order, busy, setBusy, onUpdated, onSuccess }: Props) {
  const [payment, setPayment] = useState<FractionalPaymentPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [qrSrc, setQrSrc] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  const refreshPayment = useCallback(async () => {
    setLoadErr('')
    const out = await fractionalFetchPayment(order.id)
    if (!out.ok) {
      setLoadErr(out.detail)
      setPayment(null)
      return
    }
    setPayment(out.data.payment)
  }, [order.id])

  useEffect(() => {
    void refreshPayment()
  }, [refreshPayment])

  useEffect(() => {
    const uri = payment?.upi_uri ?? ''
    if (!uri) {
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
  }, [payment?.upi_uri])

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

  const openUpiApp = () => {
    if (!payment?.upi_uri) return
    window.location.href = payment.upi_uri
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
      const out = await fractionalSubmitUtr(order.id, utrInput)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await onUpdated()
      if (out.data.status === 'completed') {
        onSuccess(`Order ${out.data.reference} completed. ${out.data.grams} g credited.`)
        return
      }
      onSuccess(`UTR submitted for ${out.data.reference}. Waiting for jeweller verification.`)
    } finally {
      setBusy(false)
    }
  }

  if (order.status === 'awaiting_utr_verify') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">Payment proof received</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Your UTR <strong className="tabular">{order.upi_utr || utrInput}</strong> was submitted for{' '}
          <strong>{order.reference}</strong>. The jeweller will confirm against their UPI app and your gold will be
          credited shortly.
        </p>
      </div>
    )
  }

  if (order.status === 'completed') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title" style={{ color: 'var(--gold-light)' }}>
          Order completed
        </p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {order.reference} — <strong className="tabular">{order.grams} g</strong> credited to your vault.
        </p>
      </div>
    )
  }

  return (
    <div className="fractional-upi-pay card">
      <p className="fractional-upi-pay__title">Pay with UPI</p>
      <p className="fractional-upi-pay__lead">
        Pay <strong className="tabular">₹{formatInr(order.total_inr)}</strong> to{' '}
        <strong>{order.jeweller.business_name}</strong> using GPay, PhonePe, or any UPI app. Then paste the{' '}
        <strong>UPI reference number</strong> from your receipt below.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {payment?.expired ? (
        <p className="form-error">This payment window expired. Place a new order.</p>
      ) : null}

      {payment && !payment.expired ? (
        <>
          <div className="fractional-upi-pay__payee">
            <span className="fractional-upi-pay__label">Pay to UPI ID</span>
            <p className="fractional-upi-pay__vpa tabular">{payment.payee_vpa}</p>
            <p className="fractional-upi-pay__meta">
              {payment.payee_name} · Ref {payment.reference}
            </p>
          </div>

          {qrSrc ? (
            <img
              src={qrSrc}
              alt=""
              width={180}
              height={180}
              className="fractional-upi-pay__qr"
            />
          ) : null}

          <div className="fractional-upi-pay__actions">
            <button type="button" className="btn btn-primary btn--block" disabled={busy} onClick={openUpiApp}>
              Open UPI app to pay
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyText(payment.payee_vpa, 'UPI ID')}
            >
              Copy UPI ID
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyText(payment.amount_inr, 'Amount')}
            >
              Copy amount (₹{formatInr(payment.amount_inr)})
            </button>
          </div>
          {copyMsg ? <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{copyMsg}</p> : null}

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor={`frac-utr-${order.id}`}>UPI reference (UTR)</label>
            <input
              id={`frac-utr-${order.id}`}
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
