import { useCallback, useEffect, useRef, useState } from 'react'
import { GoldDepositsTable } from '@/features/invest/GoldDepositsTable'
import {
  jewellerGoldDepositCreate,
  jewellerGoldDepositList,
  jewellerGoldDepositVerify,
} from '@/lib/goldDepositApi'
import { jewellerLookupCustomer } from '@/lib/personalHoldingsApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

const OTP_LEN = 6

export function JewellerGoldDepositPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof jewellerGoldDepositList>>>([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpById, setOtpById] = useState<Record<number, string>>({})
  const [formMsg, setFormMsg] = useState('')
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerLabel, setCustomerLabel] = useState('')
  const [grams, setGrams] = useState('')
  const [purity, setPurity] = useState('22')
  const [note, setNote] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const successRef = useRef<HTMLDivElement | null>(null)
  const [doneBanner, setDoneBanner] = useState<{ reference: string; grams: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setErr('')
    setRows(await jewellerGoldDepositList())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null && !formBusy)

  const runLookup = async () => {
    setLookupErr('')
    const r = await jewellerLookupCustomer({
      cridora_member_id: memberId.trim() || undefined,
      phone: phone.trim() || undefined,
    })
    if (!r.found || !r.customer) {
      setLookupErr(r.detail ?? 'Customer not found.')
      setCustomerId(null)
      setCustomerLabel('')
      return
    }
    setCustomerId(r.customer.id)
    setCustomerLabel(`${r.customer.label} · ${r.customer.cridora_member_id}`)
  }

  const createIntake = async () => {
    setFormMsg('')
    setErr('')
    if (customerId == null) {
      setFormMsg('Look up a verified customer first.')
      return
    }
    const g = grams.trim()
    if (!g) {
      setFormMsg('Enter verified gold weight in grams.')
      return
    }
    setFormBusy(true)
    try {
      const out = await jewellerGoldDepositCreate({
        customer_id: customerId,
        grams: g,
        purity_karat: purity.trim() || '22',
        jeweller_note: note.trim() || undefined,
      })
      if (!out.ok) {
        setFormMsg(out.detail)
        return
      }
      setFormMsg(
        `Intake ${out.data.reference} created. Ask the customer to open Gold deposit → Generate OTP; enter the code in the deposits table.`,
      )
      setGrams('')
      setNote('')
      await load()
    } finally {
      setFormBusy(false)
    }
  }

  const verify = async (id: number) => {
    const otp = (otpById[id] ?? '').trim()
    if (otp.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the customer’s app.`)
      return
    }
    const row = rows.find((r) => r.id === id)
    const customerLabelRow = row?.customer ? row.customer.name || row.customer.email : 'Customer'

    setBusyId(id)
    setErr('')
    try {
      const out = await jewellerGoldDepositVerify(id, otp)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setDoneBanner({
        reference: out.data.reference,
        grams: out.data.grams,
        label: customerLabelRow,
      })
      setOtpById((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    if (doneBanner && successRef.current) {
      successRef.current.focus()
    }
  }, [doneBanner])

  const pendingCount = rows.filter((r) => r.status === 'awaiting_customer_otp').length

  return (
    <div className="dash-panel-max jeweller-counter-verify-panel">
      <p className="dash-panel-lead">
        After you verify physical gold at your counter, record the <strong>customer</strong>, <strong>weight</strong>, and{' '}
        <strong>purity</strong>. The saver confirms in their app with the same <strong>6-digit OTP</strong> flow as counter
        purchases; on verify we credit their vault as <strong>gold deposit</strong> and update custodial liability.
      </p>

      <article className="pf-card pf-card--lift pf-card--wide" style={{ marginBottom: '1.25rem', maxWidth: 640 }}>
        <header className="pf-card__head">
          <h3 className="pf-card__title">New deposit intake</h3>
          <p className="pf-card__meta">Verified Cridora customers only (KYC approved).</p>
        </header>
        <div style={{ padding: '0 1rem 1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
              <span>Cridora member ID</span>
              <input className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="CRI…" />
            </label>
            <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
              <span>Phone</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void runLookup()} disabled={formBusy}>
              Find customer
            </button>
          </div>
          {lookupErr ? <p className="form-error">{lookupErr}</p> : null}
          {customerId != null ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', fontWeight: 650, color: 'var(--gold-light)' }}>
              Selected: {customerLabel}
            </p>
          ) : null}
          <div
            style={{
              marginTop: '0.85rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.65rem',
            }}
          >
            <label className="pf-vault-field">
              <span>Weight (g)</span>
              <input className="input tabular" value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" />
            </label>
            <label className="pf-vault-field">
              <span>Purity label</span>
              <input
                className="input"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                placeholder="22 / 916 BIS"
              />
            </label>
          </div>
          <label className="pf-vault-field" style={{ marginTop: '0.65rem', display: 'block' }}>
            <span>Internal note (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </label>
          {formMsg ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }} role="status">
              {formMsg}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '0.85rem' }}
            onClick={() => void createIntake()}
            disabled={formBusy}
          >
            {formBusy ? 'Saving…' : 'Create intake'}
          </button>
        </div>
      </article>

      {doneBanner ? (
        <div
          ref={successRef}
          tabIndex={-1}
          className="admin-dash-form-success admin-dash-form-success--block"
          style={{ maxWidth: '42rem', padding: '1rem 1.15rem', marginBottom: '1.25rem', outline: 'none' }}
          role="status"
        >
          <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)' }}>Deposit approved</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            <strong className="tabular">{doneBanner.reference}</strong> — {doneBanner.label} ·{' '}
            <strong className="tabular">{doneBanner.grams} g</strong> added as gold deposit.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setDoneBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', flex: '1 1 auto' }}>Deposits</h3>
        {pendingCount > 0 ? (
          <span className="jeweller-unified-desk-summary">{pendingCount} pending approval</span>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {err ? (
        <p className="form-error" style={{ marginBottom: '1rem', maxWidth: '42rem' }} role="alert">
          {err}
        </p>
      ) : null}

      <GoldDepositsTable
        role="jeweller"
        rows={rows}
        busyId={busyId}
        otpById={otpById}
        onOtpChange={(id, otp) => {
          setErr('')
          setOtpById((m) => ({ ...m, [id]: otp }))
        }}
        onVerify={(id) => void verify(id)}
      />
    </div>
  )
}
