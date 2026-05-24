import { useState } from 'react'
import { Input } from '@/components/ui'

type Props = {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (remark: string) => void | Promise<void>
}

export function UpiRejectModal({ open, busy, onClose, onConfirm }: Props) {
  const [remark, setRemark] = useState('')

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="upi-reject-title">
      <div className="modal-card">
        <h3 id="upi-reject-title" className="modal-card__title">
          Reject payment proof
        </h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Add a remark so the payer knows what to fix when re-uploading proof.
        </p>
        <Input
          label="Rejection remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. UTR does not match amount"
          autoComplete="off"
        />
        <div className="modal-card__actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !remark.trim()}
            onClick={() => void onConfirm(remark.trim())}
          >
            Reject payment
          </button>
        </div>
      </div>
    </div>
  )
}
