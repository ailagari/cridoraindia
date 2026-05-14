import { useCallback, useEffect, useState } from 'react'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  fractionalConfirmUpi,
  fractionalCreateOrder,
  fractionalListOrders,
  fractionalQuote,
  type FractionalPurchaseDTO,
  type FractionalQuoteDTO,
} from '@/lib/fractionalPurchaseApi'
import { fetchGoldWallet } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLiveCridoraBase } from '@/hooks/useLiveCridoraBase'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function FractionalPurchasePanel() {
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [jewellerId, setJewellerId] = useState<number | ''>('')
  const [inputMode, setInputMode] = useState<'by_total_inr' | 'by_grams'>('by_total_inr')
  const [inrInput, setInrInput] = useState('5000')
  const [gramsInput, setGramsInput] = useState('5')
  const [quote, setQuote] = useState<FractionalQuoteDTO | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [payment, setPayment] = useState<'upi' | 'counter'>('upi')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<FractionalPurchaseDTO[]>([])
  const [orderMsg, setOrderMsg] = useState('')
  const [lastOrder, setLastOrder] = useState<FractionalPurchaseDTO | null>(null)
  const [balanceHint, setBalanceHint] = useState('')
  const { data: liveBase } = useLiveCridoraBase()

  const refreshOrders = useCallback(async () => {
    setOrders(await fractionalListOrders())
  }, [])

  useEffect(() => {
    void fetchVerifiedJewellers().then((list) => {
      const real = list.filter((j) => j.id > 0)
      setJewellers(real)
      setJewellerId((prev) => {
        if (prev !== '') return prev
        return real[0]?.id ?? ''
      })
    })
  }, [])

  const refreshWalletHint = useCallback(async () => {
    if (busy) return
    const w = await fetchGoldWallet()
    if (w) setBalanceHint(w.balance_grams)
  }, [busy])

  useEffect(() => {
    void refreshOrders()
  }, [refreshOrders])

  useLivePoll(refreshOrders, LIVE_BALANCE_POLL_MS, !busy)
  useLivePoll(refreshWalletHint, LIVE_BALANCE_POLL_MS, !busy)

  const runQuote = async () => {
    setQuoteErr('')
    setQuote(null)
    if (jewellerId === '') {
      setQuoteErr('Choose a jeweller.')
      return
    }
    setBusy(true)
    try {
      const out =
        inputMode === 'by_grams'
          ? await fractionalQuote({
              jeweller_id: jewellerId,
              mode: 'by_grams',
              grams: gramsInput.trim(),
            })
          : await fractionalQuote({
              jeweller_id: jewellerId,
              mode: 'by_total_inr',
              total_inr: inrInput.trim(),
            })
      if (!out.ok) {
        setQuoteErr(out.detail)
        return
      }
      setQuote(out.data)
    } finally {
      setBusy(false)
    }
  }

  const submitOrder = async () => {
    setOrderMsg('')
    setLastOrder(null)
    if (!quote || jewellerId === '') {
      setOrderMsg('Update the live quote first.')
      return
    }
    setBusy(true)
    try {
      const out = await fractionalCreateOrder({
        jeweller_id: jewellerId,
        payment_method: payment,
        mode: inputMode === 'by_grams' ? 'by_grams' : 'by_total_inr',
        grams: inputMode === 'by_grams' ? gramsInput.trim() : undefined,
        total_inr: inputMode === 'by_total_inr' ? inrInput.trim() : undefined,
        customer_note: note.trim(),
      })
      if (!out.ok) {
        setOrderMsg(out.detail)
        return
      }
      setLastOrder(out.data)
      setOrderMsg(
        out.data.payment_method === 'counter'
          ? `Order ${out.data.reference} created. Pay at the jeweller counter; they will verify and credit your gold.`
          : `Order ${out.data.reference} created. Complete UPI payment, then confirm below.`,
      )
      await refreshOrders()
      const w = await fetchGoldWallet()
      if (w) setBalanceHint(w.balance_grams)
    } finally {
      setBusy(false)
    }
  }

  const confirmUpi = async () => {
    if (!lastOrder || lastOrder.payment_method !== 'upi' || lastOrder.status !== 'pending_payment') {
      setOrderMsg('Create a new UPI order first.')
      return
    }
    setBusy(true)
    setOrderMsg('')
    try {
      const out = await fractionalConfirmUpi(lastOrder.id)
      if (!out.ok) {
        setOrderMsg(out.detail)
        return
      }
      setLastOrder(out.data)
      setOrderMsg('Payment recorded. Gold has been credited to your wallet.')
      await refreshOrders()
      const w = await fetchGoldWallet()
      if (w) setBalanceHint(w.balance_grams)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Buy fractional gold at your jeweller&apos;s live metal rate (Cridora 22K reference + their markup). GST on gold value is
        included in the quote. Pay with UPI (confirm here once paid) or at the showroom — your jeweller verifies counter
        payments before grams appear in your wallet.
      </p>

      <p style={{ margin: '-0.75rem 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Cridora 22K (live):{' '}
        <strong className="tabular">
          ₹
          {liveBase?.platformBaseInrPerGram22k
            ? Number.parseFloat(liveBase.platformBaseInrPerGram22k).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })
            : '—'}
          /g
        </strong>
        {liveBase?.source ? <span> · {liveBase.source.replace(/_/g, ' ')}</span> : null}
      </p>

      <div className="card" style={{ marginBottom: '1.25rem', maxWidth: 560 }}>
        <div className="dash-form-stack">
          <div className="field">
            <label htmlFor="frac-jeweller">Jeweller</label>
            <select
              id="frac-jeweller"
              value={jewellerId === '' ? '' : String(jewellerId)}
              onChange={(e) => {
                const v = e.target.value
                setJewellerId(v === '' ? '' : Number.parseInt(v, 10))
                setQuote(null)
              }}
            >
              <option value="">Select verified jeweller</option>
              {jewellers.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.business_name} · {j.city}
                </option>
              ))}
            </select>
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Quote basis
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="frac-mode"
                  checked={inputMode === 'by_total_inr'}
                  onChange={() => {
                    setInputMode('by_total_inr')
                    setQuote(null)
                  }}
                />
                <span style={{ fontSize: '0.88rem' }}>Amount to pay (incl. GST)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="frac-mode"
                  checked={inputMode === 'by_grams'}
                  onChange={() => {
                    setInputMode('by_grams')
                    setQuote(null)
                  }}
                />
                <span style={{ fontSize: '0.88rem' }}>Gold quantity (grams)</span>
              </label>
            </div>
          </fieldset>

          {inputMode === 'by_total_inr' ? (
            <div className="field">
              <label htmlFor="frac-inr">Total payable (₹)</label>
              <input
                id="frac-inr"
                type="text"
                inputMode="decimal"
                value={inrInput}
                onChange={(e) => setInrInput(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="frac-g">Gold (grams)</label>
              <input
                id="frac-g"
                type="text"
                inputMode="decimal"
                value={gramsInput}
                onChange={(e) => setGramsInput(e.target.value)}
              />
            </div>
          )}

          <button type="button" className="btn btn-ghost btn--block" disabled={busy} onClick={() => void runQuote()}>
            Show live quote
          </button>
          {quoteErr ? <p className="form-error">{quoteErr}</p> : null}

          {quote ? (
            <div
              style={{
                padding: '1rem',
                borderRadius: 12,
                border: '1px solid var(--border-soft)',
                background: 'var(--veil-35)',
                fontSize: '0.88rem',
              }}
            >
              <p style={{ margin: '0 0 0.65rem', fontWeight: 800, color: 'var(--gold-light)' }}>Live quote</p>
              <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>
                Rate (22K metal this jeweller):{' '}
                <strong className="tabular">₹{formatInr(quote.metal_rate_inr_per_gram)}/g</strong>
              </p>
              <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>
                Gold weight: <strong className="tabular">{quote.grams} g</strong>
              </p>
              <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>
                Gold value (pre-GST): <strong className="tabular">₹{formatInr(quote.gold_value_inr_pre_gst)}</strong>
              </p>
              <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>
                GST ({quote.gst_percent}%): <strong className="tabular">₹{formatInr(quote.gst_inr)}</strong>
              </p>
              <p style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>
                Total payable: <span className="tabular">₹{formatInr(quote.total_inr)}</span>
              </p>
            </div>
          ) : null}

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Payment
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="frac-pay"
                  checked={payment === 'upi'}
                  onChange={() => setPayment('upi')}
                />
                <span style={{ fontSize: '0.88rem' }}>UPI</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="frac-pay"
                  checked={payment === 'counter'}
                  onChange={() => setPayment('counter')}
                />
                <span style={{ fontSize: '0.88rem' }}>Pay at counter</span>
              </label>
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="frac-note">Reference note (optional)</label>
            <input
              id="frac-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UPI ref or receipt id"
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={busy || !quote}
            onClick={() => void submitOrder()}
          >
            Place order
          </button>

          {orderMsg ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>{orderMsg}</p> : null}

          {lastOrder &&
          lastOrder.payment_method === 'upi' &&
          lastOrder.status === 'pending_payment' ? (
            <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Complete your bank UPI transfer for ₹{formatInr(lastOrder.total_inr)} to the jeweller or platform account you
                were given, then confirm here so your gold is credited.
              </p>
              <button type="button" className="btn btn-primary btn--block" disabled={busy} onClick={() => void confirmUpi()}>
                I have paid via UPI — credit my gold
              </button>
            </div>
          ) : null}

          {balanceHint ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Wallet balance after last action: <strong className="tabular">{balanceHint} g</strong>
            </p>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Recent fractional orders</h3>
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No orders yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {orders.map((o) => (
              <li
                key={o.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  fontSize: '0.82rem',
                }}
              >
                <strong>{o.reference}</strong> · {o.jeweller.business_name} ·{' '}
                <span className="tabular">{o.grams} g</span> · ₹{formatInr(o.total_inr)} · {o.payment_method} ·{' '}
                <span style={{ color: 'var(--gold-light)' }}>{o.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
