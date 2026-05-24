import { useState } from 'react'
import { UpiRejectModal } from '@/features/upi/UpiRejectModal'
import {
  approveUpiPayment,
  rejectUpiPayment,
  reportUpiFraud,
  upiProofImageUrl,
  type UpiPaymentKind,
} from '@/features/upi/upiPaymentApi'

type Props = {
  kind: UpiPaymentKind
  paymentId: number
  reference?: string
  amountInr?: string
  upiUtr?: string
  proofFileUrl?: string
  rejectionCount?: number
  lastRemark?: string
  fraudReported?: boolean
  busy?: boolean
  compact?: boolean
  onBusyChange?: (v: boolean) => void
  onDone?: (message: string) => void
  onError?: (message: string) => void
}

export function UpiProofReviewActions({
  kind,
  paymentId,
  reference,
  amountInr,
  upiUtr,
  proofFileUrl,
  rejectionCount,
  lastRemark,
  fraudReported,
  busy = false,
  compact = false,
  onBusyChange,
  onDone,
  onError,
}: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [fraudOpen, setFraudOpen] = useState(false)
  const [fraudNote, setFraudNote] = useState('')

  const imgUrl = upiProofImageUrl(proofFileUrl ?? '')

  const run = async (fn: () => Promise<void>) => {
    onBusyChange?.(true)
    try {
      await fn()
    } finally {
      onBusyChange?.(false)
    }
  }

  const onApprove = () =>
    void run(async () => {
      const out = await approveUpiPayment(kind, paymentId)
      if (!out.ok) {
        onError?.(out.detail)
        return
      }
      onDone?.(`Approved ${reference ?? 'payment'}.`)
    })

  const onRejectConfirm = (remark: string) =>
    void run(async () => {
      const out = await rejectUpiPayment(kind, paymentId, remark)
      if (!out.ok) {
        onError?.(out.detail)
        return
      }
      setRejectOpen(false)
      onDone?.(`Rejected ${reference ?? 'payment'}.`)
    })

  const onFraudSubmit = () =>
    void run(async () => {
      const note = fraudNote.trim()
      if (!note) {
        onError?.('Enter a fraud report note.')
        return
      }
      const out = await reportUpiFraud(kind, paymentId, note)
      if (!out.ok) {
        onError?.(out.detail)
        return
      }
      setFraudOpen(false)
      setFraudNote('')
      onDone?.('Fraud report submitted to admin treasury.')
    })

  return (
    <div className={`upi-proof-review${compact ? ' upi-proof-review--compact' : ''}`}>
      {!compact ? (
        <>
          <p className="upi-proof-review__meta">
            {reference ? <strong>{reference}</strong> : null}
            {amountInr ? (
              <>
                {' '}
                · ₹{amountInr}
              </>
            ) : null}
            {rejectionCount ? (
              <span style={{ color: 'var(--text-muted)' }}> · rejection {rejectionCount}/2</span>
            ) : null}
          </p>
          {upiUtr ? (
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
              UTR: <span className="tabular">{upiUtr}</span>
            </p>
          ) : null}
          {lastRemark ? (
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Last remark: {lastRemark}
            </p>
          ) : null}
          {imgUrl ? (
            <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="upi-proof-review__thumb">
              <img src={imgUrl} alt="Payment proof" width={120} height={120} />
            </a>
          ) : null}
        </>
      ) : null}
      <div className="upi-proof-review__actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setRejectOpen(true)}>
          Reject
        </button>
        {!fraudReported ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setFraudOpen(true)}>
            Report fraud
          </button>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Fraud reported</span>
        )}
      </div>

      <UpiRejectModal
        open={rejectOpen}
        busy={busy}
        onClose={() => setRejectOpen(false)}
        onConfirm={onRejectConfirm}
      />

      {fraudOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3 className="modal-card__title">Report fraud</h3>
            <textarea
              className="form-input"
              rows={4}
              value={fraudNote}
              onChange={(e) => setFraudNote(e.target.value)}
              placeholder="Describe why this payment looks fraudulent"
            />
            <div className="modal-card__actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setFraudOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onFraudSubmit}>
                Submit report
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
