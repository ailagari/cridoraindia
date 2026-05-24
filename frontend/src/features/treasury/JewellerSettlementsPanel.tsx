import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploadTrigger, type FileUploadTriggerPhase } from '@/components/ui'
import {
  jewellerTreasuryPaymentSubmit,
  jewellerTreasuryPayments,
  jewellerTreasurySummary,
  type SettlementPaymentRow,
} from '@/lib/adminTreasuryApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function JewellerSettlementsPanel() {
  const [owedInr, setOwedInr] = useState('0')
  const [payments, setPayments] = useState<SettlementPaymentRow[]>([])
  const [amount, setAmount] = useState('')
  const [utr, setUtr] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [uploadPhase, setUploadPhase] = useState<FileUploadTriggerPhase>('idle')
  const fileRef = useRef<File | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const [sumOut, payOut] = await Promise.all([jewellerTreasurySummary(), jewellerTreasuryPayments()])
    if (sumOut.ok) setOwedInr(sumOut.data.pending_platform_fee_inr)
    if (payOut.ok) setPayments(payOut.results)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, uploadPhase === 'uploading')

  const owedDisplay = owedInr

  const submitPayment = async (file: File) => {
    if (!amount.trim()) {
      setErr('Enter payment amount.')
      setUploadPhase('error')
      return
    }
    setUploadPhase('uploading')
    setErr('')
    const out = await jewellerTreasuryPaymentSubmit({
      amount_inr: amount.trim(),
      utr: utr.trim() || undefined,
      reference_note: note.trim() || undefined,
      receipt_file: file,
    })
    if (!out.ok) {
      setErr(out.detail)
      setUploadPhase('error')
      return
    }
    setUploadPhase('done')
    setAmount('')
    setUtr('')
    setNote('')
    fileRef.current = null
    await load()
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Platform fee settlement — pay Cridora and upload your bank receipt for admin confirmation.
      </p>

      <div className="dash-stat-card" style={{ marginBottom: '1rem', maxWidth: '20rem' }}>
        <span className="dash-stat-card__label">Your pending platform fees</span>
        <strong className="tabular">₹{formatInr(owedDisplay)}</strong>
      </div>

      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}

      <div style={{ maxWidth: '28rem', display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <label>
          Amount (INR)
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          UTR (optional)
          <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} />
        </label>
        <label>
          Note (optional)
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <FileUploadTrigger
          accept="image/*,application/pdf"
          idleLabel="Upload receipt"
          phase={uploadPhase}
          onFile={(file) => {
            fileRef.current = file
            void submitPayment(file)
          }}
        />
      </div>

      <h3>Payment history</h3>
      <table className="jeweller-purchases-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Amount</th>
            <th>UTR</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={4}>No payments submitted yet.</td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id}>
                <td>{p.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td className="tabular">₹{formatInr(p.amount_inr)}</td>
                <td>{p.utr || '—'}</td>
                <td>{p.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
