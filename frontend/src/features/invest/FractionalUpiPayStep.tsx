import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { UpiPayMethodNotice } from '@/components/UpiPayMethodNotice'
import {
  fractionalCancelUpiOrder,
  fractionalFetchPayment,
  fractionalPaymentAck,
  fractionalSubmitPaymentSms,
  fractionalSubmitUtr,
  type FractionalPaymentPayload,
  type FractionalPurchaseDTO,
} from '@/lib/fractionalPurchaseApi'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { openUpiPayUri } from '@/lib/openUpiPayUri'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import {
  isPaymentSmsBridgeAvailable,
  requestPaymentSmsAccess,
  startPaymentSmsListener,
  type PaymentSmsListenStatus,
} from '@/lib/paymentSmsListener'

type Props = {
  order: FractionalPurchaseDTO
  busy: boolean
  setBusy: (v: boolean) => void
  onUpdated: () => void | Promise<void>
  onSuccess: (message: string) => void
  onCancelled: () => void
}

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

const PENDING_REVIEW_STATUSES = new Set([
  'pending_review',
  'awaiting_utr_verify',
  'signal_received',
  'needs_manual_verification',
])

export function FractionalUpiPayStep({ order, busy, setBusy, onUpdated, onSuccess, onCancelled }: Props) {
  const narrow = usePublicLayoutMax767()
  const [payment, setPayment] = useState<FractionalPaymentPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [smsInput, setSmsInput] = useState('')
  const [showSmsPaste, setShowSmsPaste] = useState(false)
  const [qrSrc, setQrSrc] = useState('')
  const [copyMsg, setCopyMsg] = useState('')
  const [smsListenStatus, setSmsListenStatus] = useState<PaymentSmsListenStatus>('unavailable')

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
    if (order.status !== 'pending_payment' && order.status !== 'signal_received') {
      setSmsListenStatus('unavailable')
      return
    }
    if (!isNativeAndroid() || !isPaymentSmsBridgeAvailable()) {
      setSmsListenStatus(isNativeAndroid() ? 'bridge_missing' : 'unavailable')
      return
    }
    const handle = startPaymentSmsListener(
      order.id,
      async () => {
        const out = await fractionalFetchPayment(order.id)
        if (out.ok && out.data.status === 'completed') {
          onSuccess(
            `Order ${out.data.order_reference ?? out.data.reference} completed. ${out.data.grams} g credited.`,
          )
        }
        await onUpdated()
      },
      setSmsListenStatus,
    )
    return () => {
      handle?.stop()
      setSmsListenStatus('unavailable')
    }
  }, [order.id, order.status, onUpdated, onSuccess])

  useEffect(() => {
    const uri = payment?.upi_uri ?? ''
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
  }, [payment?.upi_uri, narrow])

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
    if (!payment) return
    const lines = [
      `UPI ID: ${payment.payee_vpa}`,
      `Amount: ₹${formatInr(payment.amount_inr)}`,
      `Note: ${payment.payment_note}`,
      `Ref: ${payment.order_reference ?? payment.reference}`,
    ]
    await copyText(lines.join('\n'), 'Payment details')
  }

  const openUpiApp = () => {
    if (!payment?.upi_uri) return
    openUpiPayUri(payment.upi_uri)
  }

  const handleOrderUpdate = async (data: FractionalPurchaseDTO, fallbackMsg: string) => {
    await onUpdated()
    if (data.status === 'completed') {
      onSuccess(`Order ${data.order_reference ?? data.reference} completed. ${data.grams} g credited.`)
      return
    }
    if (PENDING_REVIEW_STATUSES.has(data.status)) {
      onSuccess(
        `Payment received for ${data.order_reference ?? data.reference}. ${
          data.reconciliation_score != null ? `Match score ${data.reconciliation_score}%. ` : ''
        }Waiting for jeweller review if not auto-confirmed.`,
      )
      return
    }
    onSuccess(fallbackMsg)
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
      await handleOrderUpdate(out.data, `Payment submitted for ${out.data.reference}.`)
    } finally {
      setBusy(false)
    }
  }

  const submitSms = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await fractionalSubmitPaymentSms(order.id, smsInput)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await handleOrderUpdate(out.data, 'SMS submitted.')
    } finally {
      setBusy(false)
    }
  }

  const paymentAck = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await fractionalPaymentAck(order.id)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await handleOrderUpdate(out.data, "We've noted your payment.")
    } finally {
      setBusy(false)
    }
  }

  const cancelOrder = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await fractionalCancelUpiOrder(order.id)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await onUpdated()
      onCancelled()
    } finally {
      setBusy(false)
    }
  }

  if (PENDING_REVIEW_STATUSES.has(order.status)) {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">Payment received</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {order.order_reference ?? order.reference}: your payment is being matched
          {order.reconciliation_score != null ? ` (score ${order.reconciliation_score}%)` : ''}. Gold credits
          automatically when confidence is high; otherwise your jeweller will confirm shortly.
          {order.upi_utr ? (
            <>
              {' '}
              UTR <strong className="tabular">{order.upi_utr}</strong>
            </>
          ) : null}
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
          {order.order_reference ?? order.reference} — <strong className="tabular">{order.grams} g</strong> credited to
          your vault.
        </p>
      </div>
    )
  }

  if (order.status === 'rejected') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title" style={{ color: 'var(--danger)' }}>
          Payment not confirmed
        </p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          This order was rejected by the jeweller. Contact them or place a new order.
        </p>
      </div>
    )
  }

  return (
    <div className="fractional-upi-pay card">
      <p className="fractional-upi-pay__title">Pay with UPI</p>
      <p className="fractional-upi-pay__lead">
        Pay <strong className="tabular">₹{formatInr(order.total_inr)}</strong> to{' '}
        <strong>{order.jeweller.business_name}</strong>. UTR is optional — paste your bank SMS for faster
        auto-confirmation.
      </p>

      {isNativeAndroid() && isPaymentSmsBridgeAvailable() ? (
        <div
          className="fractional-upi-pay__sms-listen"
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: 10,
            border: '1px solid var(--border-soft)',
            background: 'var(--veil)',
            fontSize: '0.82rem',
          }}
        >
          {smsListenStatus === 'listening' ? (
            <p style={{ margin: 0, color: 'var(--success)' }}>
              Listening for your bank payment SMS on this device…
            </p>
          ) : smsListenStatus === 'ready' ? (
            <>
              <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Allow SMS access to auto-detect your payment confirmation (only while this screen is open).
              </p>
              <button
                type="button"
                className="btn btn-ghost btn--block"
                style={{ marginTop: '0.5rem' }}
                disabled={busy}
                onClick={() => requestPaymentSmsAccess(order.id)}
              >
                Enable payment SMS detection
              </button>
            </>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Rebuild the Android app to enable automatic SMS detection, or paste your bank SMS below.
            </p>
          )}
        </div>
      ) : null}

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {payment?.expired ? (
        <p className="form-error">This payment window expired. Place a new order.</p>
      ) : null}

      {payment && !payment.expired ? (
        <>
          <UpiPayMethodNotice compact={narrow} />

          <div className="fractional-upi-pay__payee">
            <span className="fractional-upi-pay__label">Pay to UPI ID</span>
            <p className="fractional-upi-pay__vpa tabular">{payment.payee_vpa}</p>
            <p className="fractional-upi-pay__meta">
              {payment.payee_name} · {payment.order_reference ?? payment.reference}
            </p>
          </div>

          <div className="fractional-upi-pay__actions">
            <button type="button" className="btn btn-primary btn--block" disabled={busy} onClick={openUpiApp}>
              Open UPI app to pay
            </button>
            <button type="button" className="btn btn-ghost btn--block" disabled={busy} onClick={() => void paymentAck()}>
              I&apos;ve paid
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void copyPaymentDetails()}
            >
              Copy payment details
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
            <label htmlFor={`frac-utr-${order.id}`}>UPI reference (optional)</label>
            <input
              id={`frac-utr-${order.id}`}
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value)}
              placeholder="From GPay / PhonePe receipt"
              autoComplete="off"
              inputMode="text"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={busy}
            onClick={() => void submitUtr()}
          >
            {utrInput.trim() ? 'Submit UTR' : 'Continue without UTR'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn--block"
            disabled={busy}
            onClick={() => setShowSmsPaste((v) => !v)}
          >
            {showSmsPaste ? 'Hide SMS paste' : 'Paste bank payment SMS'}
          </button>
          {showSmsPaste ? (
            <>
              <div className="field">
                <label htmlFor={`frac-sms-${order.id}`}>Bank SMS text</label>
                <textarea
                  id={`frac-sms-${order.id}`}
                  rows={4}
                  value={smsInput}
                  onChange={(e) => setSmsInput(e.target.value)}
                  placeholder="Paste the debit SMS from your bank"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn--block"
                disabled={busy || smsInput.trim().length < 20}
                onClick={() => void submitSms()}
              >
                Submit SMS for auto-match
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="btn btn-ghost btn--block fractional-upi-pay__cancel"
            disabled={busy}
            onClick={() => void cancelOrder()}
          >
            Cancel order
          </button>
          {actionErr ? <p className="form-error">{actionErr}</p> : null}
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-ghost btn--block fractional-upi-pay__cancel"
            disabled={busy}
            onClick={() => void cancelOrder()}
          >
            Cancel order
          </button>
          {actionErr ? <p className="form-error">{actionErr}</p> : null}
        </>
      )}
    </div>
  )
}
