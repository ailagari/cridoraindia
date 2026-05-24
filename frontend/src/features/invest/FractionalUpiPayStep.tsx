import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { UpiPayMethodNotice } from '@/components/UpiPayMethodNotice'
import { Input } from '@/components/ui'
import {
  fractionalCancelUpiOrder,
  fractionalFetchPayment,
  fractionalPaymentAck,
  fractionalSubmitUtr,
  type FractionalPaymentPayload,
  type FractionalPurchaseDTO,
} from '@/lib/fractionalPurchaseApi'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { openUpiPayUri } from '@/lib/openUpiPayUri'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { isPaymentSmsBridgeAvailable, startPaymentSmsListener } from '@/lib/paymentSmsListener'
import { isValidUtr, utrValidationHint } from '@/lib/utrNormalize'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

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

const INFLIGHT_PAY_STATUSES = new Set(['pending_payment', 'signal_received'])

export function FractionalUpiPayStep({ order, busy, setBusy, onUpdated, onSuccess, onCancelled }: Props) {
  const narrow = usePublicLayoutMax767()
  const [viewOrder, setViewOrder] = useState(order)
  const [payment, setPayment] = useState<FractionalPaymentPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [qrSrc, setQrSrc] = useState('')

  useEffect(() => {
    setViewOrder(order)
  }, [order])

  const refreshPayment = useCallback(async () => {
    setLoadErr('')
    const out = await fractionalFetchPayment(viewOrder.id)
    if (!out.ok) {
      setLoadErr(out.detail)
      setPayment(null)
      return null
    }
    setPayment(out.data.payment)
    const { payment: _p, ...orderRow } = out.data
    setViewOrder((prev) => ({ ...prev, ...orderRow }))
    return out.data
  }, [viewOrder.id])

  useEffect(() => {
    void refreshPayment()
  }, [refreshPayment])

  useLivePoll(() => void refreshPayment(), LIVE_BALANCE_POLL_MS, !busy && INFLIGHT_PAY_STATUSES.has(viewOrder.status))

  useEffect(() => {
    if (!INFLIGHT_PAY_STATUSES.has(viewOrder.status)) return
    if (!isNativeAndroid() || !isPaymentSmsBridgeAvailable()) return
    const handle = startPaymentSmsListener(viewOrder.id, async () => {
      const out = await fractionalFetchPayment(viewOrder.id)
      if (out.ok) {
        setViewOrder(out.data)
        if (out.data.status === 'completed') {
          onSuccess(
            `Order ${out.data.order_reference ?? out.data.reference} completed. ${out.data.grams} g credited.`,
          )
        }
      }
      await onUpdated()
    })
    return () => {
      handle?.stop()
    }
  }, [viewOrder.id, viewOrder.status, onUpdated, onSuccess])

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

  const utrHint = useMemo(() => utrValidationHint(utrInput), [utrInput])
  const utrReady = isValidUtr(utrInput)

  const openUpiApp = () => {
    if (!payment?.upi_uri) return
    openUpiPayUri(payment.upi_uri)
  }

  const handleOrderUpdate = async (data: FractionalPurchaseDTO, fallbackMsg: string) => {
    setViewOrder(data)
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
    if (!utrReady) {
      setActionErr(utrHint ?? 'Enter a valid UTR number.')
      return
    }
    setActionErr('')
    setBusy(true)
    try {
      const out = await fractionalSubmitUtr(viewOrder.id, utrInput)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await handleOrderUpdate(out.data, `Payment submitted for ${out.data.reference}.`)
    } finally {
      setBusy(false)
    }
  }

  const paymentAck = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await fractionalPaymentAck(viewOrder.id)
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
      const out = await fractionalCancelUpiOrder(viewOrder.id)
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

  if (PENDING_REVIEW_STATUSES.has(viewOrder.status)) {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">Payment received</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {viewOrder.order_reference ?? viewOrder.reference}: your payment is being matched
          {viewOrder.reconciliation_score != null ? ` (score ${viewOrder.reconciliation_score}%)` : ''}. Gold credits
          automatically when confidence is high; otherwise your jeweller will confirm shortly.
          {viewOrder.upi_utr ? (
            <>
              {' '}
              UTR <strong className="tabular">{viewOrder.upi_utr}</strong>
            </>
          ) : null}
        </p>
      </div>
    )
  }

  if (viewOrder.status === 'completed') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title" style={{ color: 'var(--gold-light)' }}>
          Order completed
        </p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {viewOrder.order_reference ?? viewOrder.reference} — <strong className="tabular">{viewOrder.grams} g</strong>{' '}
          credited to your vault.
        </p>
      </div>
    )
  }

  if (viewOrder.status === 'rejected') {
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
        Pay <strong className="tabular">₹{formatInr(viewOrder.total_inr)}</strong> to{' '}
        <strong>{viewOrder.jeweller.business_name}</strong>. After paying, tap <strong>I&apos;ve paid</strong>. UTR is
        optional but helps auto-match faster.
      </p>

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
            <button type="button" className="btn btn-secondary btn--block" disabled={busy} onClick={() => void paymentAck()}>
              I&apos;ve paid
            </button>
          </div>

          {!narrow && qrSrc ? (
            <>
              <p className="fractional-upi-pay__qr-caption">
                Desktop only: scan with another phone&apos;s UPI camera. Do not upload this image in PhonePe gallery.
              </p>
              <img src={qrSrc} alt="" width={180} height={180} className="fractional-upi-pay__qr" />
            </>
          ) : null}

          <Input
            label="UTR number (optional)"
            value={utrInput}
            onChange={(e) => {
              setActionErr('')
              setUtrInput(e.target.value)
            }}
            placeholder="12-digit UTR from GPay / PhonePe receipt"
            autoComplete="off"
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            error={utrHint ?? undefined}
            mono
          />
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={busy || !utrReady}
            onClick={() => void submitUtr()}
          >
            Submit UTR
          </button>

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
