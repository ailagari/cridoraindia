import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Input } from '@/components/ui'
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
import { openUpiPayUri } from '@/lib/openUpiPayUri'
import { isValidUtr, utrValidationHint } from '@/lib/utrNormalize'

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

  useEffect(() => {
    const uri = state?.upi_uri ?? ''
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
  }, [state?.upi_uri])

  const utrHint = useMemo(() => utrValidationHint(utrInput), [utrInput])
  const utrReady = isValidUtr(utrInput)
  const canSubmitProof = utrReady || Boolean(screenshotFile)

  if (state?.is_on_hold || state?.status === UPI_ON_HOLD) {
    return <UpiOnHoldNotice kind={kind} />
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
      onSuccess?.('Payment proof submitted for review.')
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
      <p className="fractional-upi-pay__title">Pay with UPI</p>
      {state?.status === UPI_PROOF_REJECTED && state.last_rejection_remark ? (
        <p className="form-error" style={{ marginBottom: '0.75rem' }}>
          Rejected: {state.last_rejection_remark}. Re-upload proof below.
        </p>
      ) : null}
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

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {state?.expired ? <p className="form-error">This payment window expired.</p> : null}

      {state && !state.expired ? (
        <>
          <UpiPayMethodNotice compact={narrow} />

          {state.payee_vpa ? (
            <div className="fractional-upi-pay__payee">
              <span className="fractional-upi-pay__label">Pay to UPI ID</span>
              <p className="fractional-upi-pay__vpa tabular">{state.payee_vpa}</p>
              <p className="fractional-upi-pay__meta">
                {state.payee_name} · {state.reference}
              </p>
            </div>
          ) : null}

          {qrSrc ? (
            <>
              <p className="fractional-upi-pay__qr-caption">Scan with your UPI app to pay.</p>
              <img src={qrSrc} alt="" width={180} height={180} className="fractional-upi-pay__qr" />
            </>
          ) : null}

          {narrow && state.upi_uri ? (
            <button
              type="button"
              className="btn btn-primary btn--block"
              disabled={busy}
              onClick={() => openUpiPayUri(state.upi_uri!)}
            >
              Pay by UPI
            </button>
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
              Submit payment proof
            </button>
          </div>

          {actionErr ? <p className="form-error">{actionErr}</p> : null}
        </>
      ) : null}
    </div>
  )
}
