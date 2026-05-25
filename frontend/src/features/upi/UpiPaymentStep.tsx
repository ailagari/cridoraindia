import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Input } from '@/components/ui'
import { UpiMobilePayLinks } from '@/features/upi/UpiMobilePayLinks'
import { UpiPayMethodNotice } from '@/components/UpiPayMethodNotice'
import { UpiOnHoldNotice } from '@/features/upi/UpiOnHoldNotice'
import {
  fetchUpiPayment,
  submitUpiPaymentProof,
  UPI_ON_HOLD,
  UPI_PENDING_REVIEW,
  UPI_PROOF_REJECTED,
  type UpiPaymentKind,
  type UpiPaymentState,
} from '@/features/upi/upiPaymentApi'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { isValidUtr, utrValidationHint } from '@/lib/utrNormalize'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type Props = {
  kind: UpiPaymentKind
  paymentId: number
  busy: boolean
  setBusy: (v: boolean) => void
  onSubmitted?: () => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

function formatInr(s: string | undefined): string {
  if (!s) return '—'
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function manualPayClipboardText(state: UpiPaymentState): string {
  const lines = [
    state.payee_vpa ? `UPI ID: ${state.payee_vpa}` : '',
    state.amount_inr ? `Amount: ₹${formatInr(state.amount_inr)}` : '',
    state.reference ? `Reference: ${state.reference}` : '',
    state.payee_name ? `Payee: ${state.payee_name}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

export function UpiPaymentStep({
  kind,
  paymentId,
  busy,
  setBusy,
  onSubmitted,
  onSuccess,
  onError,
}: Props) {
  const narrow = usePublicLayoutMax767()
  const [state, setState] = useState<UpiPaymentState | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [utrInput, setUtrInput] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [qrSrc, setQrSrc] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const out = await fetchUpiPayment(kind, paymentId)
    if (!out.ok) {
      setLoadErr(out.detail)
      setState(null)
      return
    }
    setState(out.data)
  }, [kind, paymentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, !busy && state?.status === UPI_PENDING_REVIEW)

  const qrSize = 180

  useEffect(() => {
    const uri = state?.upi_uri ?? ''
    if (!uri || narrow) {
      setQrSrc('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(uri, { margin: 1, width: qrSize, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setQrSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [state?.upi_uri, narrow])

  const utrHint = useMemo(() => utrValidationHint(utrInput), [utrInput])
  const utrReady = isValidUtr(utrInput)
  const canSubmitProof = utrReady || Boolean(screenshotFile)
  const isResubmit = state?.status === UPI_PROOF_REJECTED

  useEffect(() => {
    if (state?.status !== UPI_PROOF_REJECTED) return
    setUtrInput('')
    setScreenshotFile(null)
    setActionErr('')
  }, [state?.status, state?.rejection_count, state?.last_rejection_remark])

  if (state?.is_on_hold || state?.status === UPI_ON_HOLD) {
    return <UpiOnHoldNotice kind={kind} contactName={state?.payee_name} />
  }

  if (state?.status === UPI_PENDING_REVIEW || state?.is_completed) {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">
          {state.is_completed ? 'Payment completed' : 'Proof submitted'}
        </p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {state.is_completed
            ? 'This payment has been approved.'
            : `${state.reference ?? ''}: your proof is with the reviewer.`}
          {state.upi_utr ? (
            <>
              {' '}
              UTR <strong className="tabular">{state.upi_utr}</strong>
            </>
          ) : null}
        </p>
      </div>
    )
  }

  const canSubmit = state?.can_submit_proof ?? false

  const handleSubmit = async () => {
    if (!canSubmitProof) {
      setActionErr('Enter a UTR number or upload a payment screenshot.')
      return
    }
    if (utrInput.trim() && !utrReady && !screenshotFile) {
      setActionErr(utrHint ?? 'Enter a valid UTR number.')
      return
    }
    setActionErr('')
    setBusy(true)
    try {
      const out = await submitUpiPaymentProof(kind, paymentId, {
        utr: utrInput,
        file: screenshotFile,
      })
      if (!out.ok) {
        setActionErr(out.detail)
        onError?.(out.detail)
        return
      }
      setState(out.data)
      setScreenshotFile(null)
      onSubmitted?.()
      onSuccess?.(isResubmit ? 'Payment proof resubmitted for review.' : 'Payment proof submitted for review.')
    } finally {
      setBusy(false)
    }
  }

  if (!canSubmit && state?.status !== UPI_PROOF_REJECTED) {
    if (loadErr) return <p className="form-error">{loadErr}</p>
    return null
  }

  return (
    <div className="fractional-upi-pay card">
      <p className="fractional-upi-pay__title">{isResubmit ? 'Resubmit payment proof' : 'Pay with UPI'}</p>
      {isResubmit ? (
        <div className="upi-proof-rejected-notice" role="alert">
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5 }}>
            Your payment proof was rejected
            {state?.last_rejection_remark ? (
              <>
                : <strong>{state.last_rejection_remark}</strong>
              </>
            ) : (
              '.'
            )}
          </p>
          {state?.rejection_count ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Rejection {state.rejection_count}/2 — a second rejection puts this payment on hold.
            </p>
          ) : null}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Add a new UTR and/or payment screenshot below, then resubmit for review.
          </p>
        </div>
      ) : null}
      {!isResubmit ? (
        <p className="fractional-upi-pay__lead">
          Pay <strong className="tabular">₹{formatInr(state?.amount_inr)}</strong>
          {state?.payee_name ? (
            <>
              {' '}
              to <strong>{state.payee_name}</strong>
            </>
          ) : null}
          . After paying, submit your UTR number and/or payment screenshot.
        </p>
      ) : (
        <p className="fractional-upi-pay__lead">
          Amount <strong className="tabular">₹{formatInr(state?.amount_inr)}</strong>
          {state?.reference ? (
            <>
              {' '}
              · <strong>{state.reference}</strong>
            </>
          ) : null}
        </p>
      )}

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {state?.expired ? <p className="form-error">This payment window expired.</p> : null}

      {state && !state.expired ? (
        <>
          {!isResubmit ? <UpiPayMethodNotice compact={narrow} /> : null}

          {!isResubmit && narrow && state.upi_uri ? <UpiMobilePayLinks upiUri={state.upi_uri} /> : null}

          {!isResubmit && !narrow && qrSrc ? (
            <>
              <p className="fractional-upi-pay__qr-caption">Scan with your UPI app to pay.</p>
              <img src={qrSrc} alt="" width={qrSize} height={qrSize} className="fractional-upi-pay__qr" />
            </>
          ) : null}

          {!isResubmit && state.payee_vpa ? (
            <div className="fractional-upi-pay__payee">
              <span className="fractional-upi-pay__label">Pay to UPI ID</span>
              <p className="fractional-upi-pay__vpa tabular">{state.payee_vpa}</p>
              <p className="fractional-upi-pay__meta">
                {state.payee_name} · {state.reference}
              </p>
              {narrow ? (
                <button
                  type="button"
                  className="btn btn-secondary btn--block"
                  disabled={busy}
                  onClick={() => {
                    void navigator.clipboard.writeText(manualPayClipboardText(state)).then(() => {
                      onSuccess?.('Payment details copied. Pay manually in your UPI app if the button fails.')
                    })
                  }}
                >
                  Copy payment details
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="fractional-upi-pay__proof-options">
            <Input
              label="UTR number (optional if screenshot added)"
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
            <label className="form-label" htmlFor={`upi-screenshot-${paymentId}`}>
              Payment screenshot (optional if UTR added)
            </label>
            <input
              id={`upi-screenshot-${paymentId}`}
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                setActionErr('')
                setScreenshotFile(e.target.files?.[0] ?? null)
              }}
            />
            {screenshotFile ? (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Selected: {screenshotFile.name}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn--block"
              disabled={busy || !canSubmitProof}
              onClick={() => void handleSubmit()}
            >
              {isResubmit ? 'Resubmit payment proof' : 'Submit payment proof'}
            </button>
          </div>

          {actionErr ? <p className="form-error">{actionErr}</p> : null}
        </>
      ) : null}
    </div>
  )
}
