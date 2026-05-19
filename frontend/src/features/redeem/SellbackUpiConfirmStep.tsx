import { useState } from 'react'
import {
  customerCancelSellbackUpi,
  customerConfirmSellbackUtr,
  type SellbackOutstandingDTO,
} from '@/lib/goldTransferApi'

type Props = {
  row: SellbackOutstandingDTO
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

export function SellbackUpiConfirmStep({ row, busy, setBusy, onUpdated, onSuccess }: Props) {
  const [actionErr, setActionErr] = useState('')

  const confirmPayout = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await customerConfirmSellbackUtr(row.id)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await onUpdated()
      onSuccess(`${row.reference} settled — ${row.grams} g debited from your vault.`)
    } finally {
      setBusy(false)
    }
  }

  const cancelSellback = async () => {
    setActionErr('')
    setBusy(true)
    try {
      const out = await customerCancelSellbackUpi(row.id)
      if (!out.ok) {
        setActionErr(out.detail)
        return
      }
      await onUpdated()
      onSuccess('Sellback cancelled.')
    } finally {
      setBusy(false)
    }
  }

  if (row.status === 'awaiting_utr_verify') {
    return (
      <div className="fractional-upi-pay card">
        <p className="fractional-upi-pay__title">Confirm UPI payout received</p>
        <p className="fractional-upi-pay__lead">
          Your jeweller reported paying <strong className="tabular">₹{formatInr(row.cash_estimate_inr)}</strong> to{' '}
          <strong className="tabular">{row.payout_upi_vpa}</strong>. UTR{' '}
          <strong className="tabular">{row.upi_utr}</strong>. Confirm only after the amount appears in your UPI app.
        </p>
        <button type="button" className="btn btn-primary btn--block" disabled={busy} onClick={() => void confirmPayout()}>
          I received the payout — confirm
        </button>
        {actionErr ? <p className="form-error">{actionErr}</p> : null}
      </div>
    )
  }

  if (row.status === 'pending_jeweller' && row.payment_method === 'upi') {
    return (
      <div className="fractional-upi-pay card">
        <p className="fractional-upi-pay__title">UPI sellback pending</p>
        <p className="fractional-upi-pay__lead">
          Waiting for <strong>{row.jeweller_label}</strong> to accept. Payout will go to{' '}
          <strong className="tabular">{row.payout_upi_vpa}</strong> once accepted.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn--block fractional-upi-pay__cancel"
          disabled={busy}
          onClick={() => void cancelSellback()}
        >
          Cancel sellback
        </button>
        {actionErr ? <p className="form-error">{actionErr}</p> : null}
      </div>
    )
  }

  if (row.status === 'accepted_awaiting_otp' && row.payment_method === 'upi') {
    return (
      <div className="fractional-upi-pay card" role="status">
        <p className="fractional-upi-pay__title">Awaiting jeweller UPI payout</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong>{row.jeweller_label}</strong> accepted your sellback for{' '}
          <strong className="tabular">₹{formatInr(row.cash_estimate_inr)}</strong>. They will pay{' '}
          <strong className="tabular">{row.payout_upi_vpa}</strong> and submit the UTR — you will confirm here when
          funds arrive.
        </p>
      </div>
    )
  }

  return null
}
