import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchGoldLoanOutstanding,
  postGoldLoanCompare,
  postGoldLoanConfirm,
  postGoldLoanQuote,
  type GoldLoanCompareDTO,
  type GoldLoanOfferDTO,
  type GoldLoanOutstandingDTO,
  type GoldLoanQuoteDTO,
} from '@/lib/goldLoanApi'
import { fetchGoldWallet, type GoldWalletDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function eligibleOffers(data: GoldLoanCompareDTO): GoldLoanOfferDTO[] {
  return data.offers.filter((o) => o.eligible_for_request === 'true')
}

export function CustomerGoldLoanPanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [gramsInput, setGramsInput] = useState('')
  const [compare, setCompare] = useState<GoldLoanCompareDTO | null>(null)
  const [selectedJewellerId, setSelectedJewellerId] = useState<number | null>(null)
  const [quote, setQuote] = useState<GoldLoanQuoteDTO | null>(null)
  const [outstanding, setOutstanding] = useState<GoldLoanOutstandingDTO[]>([])
  const [actionErr, setActionErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const compareSeq = useRef(0)

  const refreshWallet = useCallback(async () => {
    setWallet(await fetchGoldWallet())
  }, [])

  const refreshOutstanding = useCallback(async () => {
    setOutstanding((await fetchGoldLoanOutstanding()) ?? [])
  }, [])

  useEffect(() => {
    void refreshWallet()
    void refreshOutstanding()
  }, [refreshWallet, refreshOutstanding])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const vaultRows = useMemo(
    () =>
      (wallet?.vaults ?? []).filter(
        (v) => parseG(v.fractional_grams) + parseG(v.deposit_grams ?? '0') > 0,
      ),
    [wallet],
  )

  const runQuote = useCallback(async (jewellerId: number, grams: string) => {
    setBusy(true)
    setActionErr('')
    const { data, detail } = await postGoldLoanQuote(jewellerId, grams)
    setBusy(false)
    if (!data) {
      setActionErr(detail)
      setQuote(null)
      return
    }
    setQuote(data)
    setSelectedJewellerId(jewellerId)
  }, [])

  const applyCompareResult = useCallback(
    async (data: GoldLoanCompareDTO) => {
      setCompare(data)
      const eligible = eligibleOffers(data)
      if (eligible.length === 0) {
        setQuote(null)
        setSelectedJewellerId(null)
        return
      }
      if (data.skip_compare === 'true' && data.auto_selected_jeweller_id) {
        const jid = Number.parseInt(data.auto_selected_jeweller_id, 10)
        await runQuote(jid, data.grams)
        return
      }
      const first = eligible[0]
      const jid = Number.parseInt(first.jeweller_id, 10)
      setSelectedJewellerId(jid)
      setQuote(null)
    },
    [runQuote],
  )

  const runCompare = useCallback(
    async (grams: string) => {
      const seq = ++compareSeq.current
      setBusy(true)
      setActionErr('')
      setSuccessMsg('')
      setQuote(null)
      setCompare(null)
      setSelectedJewellerId(null)
      const res = await authFetchCompare(grams)
      if (seq !== compareSeq.current) return
      setBusy(false)
      if (!res.ok) {
        setActionErr(res.detail)
        return
      }
      await applyCompareResult(res.data)
    },
    [applyCompareResult],
  )

  useEffect(() => {
    const g = gramsInput.trim()
    if (!g || parseG(g) <= 0) {
      setCompare(null)
      setQuote(null)
      setSelectedJewellerId(null)
      return
    }
    const t = window.setTimeout(() => {
      void runCompare(g)
    }, 450)
    return () => window.clearTimeout(t)
  }, [gramsInput, runCompare])

  const onSelectOffer = (offer: GoldLoanOfferDTO) => {
    const jid = Number.parseInt(offer.jeweller_id, 10)
    void runQuote(jid, offer.grams)
  }

  const onConfirm = async () => {
    if (!selectedJewellerId || !compare) return
    setBusy(true)
    setActionErr('')
    const { data, detail } = await postGoldLoanConfirm(selectedJewellerId, compare.grams)
    setBusy(false)
    if (!data) {
      setActionErr(detail)
      return
    }
    setSuccessMsg(`Loan request ${data.reference} submitted — awaiting jeweller approval.`)
    setQuote(null)
    setCompare(null)
    setGramsInput('')
    void refreshOutstanding()
    void refreshWallet()
  }

  const showCompareList =
    compare != null &&
    compare.skip_compare !== 'true' &&
    eligibleOffers(compare).length > 1

  const singleJewellerQuote =
    compare != null && compare.skip_compare === 'true' && quote != null

  return (
    <div className="dash-panel-max">
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55, marginTop: 0 }}>
        Borrow only against <strong>your vault gold</strong> at jewellers where you hold fractional or deposit
        grams (primary or secondary custodians). Offers load automatically when you enter grams.
      </p>

      {actionErr ? <p className="form-error">{actionErr}</p> : null}
      {successMsg ? (
        <p style={{ color: 'var(--success)', fontSize: '0.88rem' }}>{successMsg}</p>
      ) : null}

      <div className="card" style={{ padding: '1rem', borderRadius: 16, marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Your vault holdings (loan collateral)</h3>
        {vaultRows.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No custodied vault gold yet.{' '}
            <Link to="/userdashboard?section=invest_fractional">Buy fractional gold</Link> or{' '}
            <Link to="/userdashboard?section=invest_deposit">deposit physical gold</Link> first.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
            {vaultRows.map((v) => (
              <li key={v.custodian_id}>
                <strong>{v.custodian_label}</strong>
                {v.is_primary_custodian ? ' (primary)' : ' (secondary)'} —{' '}
                <span className="tabular">
                  {(parseG(v.fractional_grams) + parseG(v.deposit_grams ?? '0')).toFixed(3)} g
                </span>{' '}
                eligible
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="field">
        <span>Grams to pledge</span>
        <input
          inputMode="decimal"
          value={gramsInput}
          onChange={(e) => setGramsInput(e.target.value)}
          placeholder="e.g. 10"
        />
      </label>

      {busy && gramsInput.trim() ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Finding loan offers at your jewellers…
        </p>
      ) : null}

      {compare ? (
        <div style={{ marginTop: '1.25rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Platform processing fee:{' '}
            <strong>{compare.gold_loan_processing_fee_percent}%</strong> of principal.
          </p>
          {eligibleOffers(compare).length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              None of your vault jewellers can offer a loan for this amount. Try fewer grams or ask your jeweller
              to enable loans and set a loan %.
            </p>
          ) : null}

          {showCompareList ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Compare offers</p>
              {eligibleOffers(compare).map((o) => (
                <button
                  key={o.jeweller_id}
                  type="button"
                  className="card"
                  style={{
                    textAlign: 'left',
                    padding: '0.85rem 1rem',
                    borderRadius: 14,
                    cursor: 'pointer',
                    border:
                      selectedJewellerId === Number.parseInt(o.jeweller_id, 10)
                        ? '1px solid var(--gold-light)'
                        : '1px solid var(--border-soft)',
                    background:
                      selectedJewellerId === Number.parseInt(o.jeweller_id, 10)
                        ? 'var(--gold-shine-12)'
                        : 'var(--veil)',
                  }}
                  onClick={() => onSelectOffer(o)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>
                      {o.jeweller_label}
                      {o.is_primary_custodian === 'true' ? ' · primary' : ''}
                    </strong>
                    <span className="tabular" style={{ fontWeight: 800, color: 'var(--gold-light)' }}>
                      ₹{fmtInr(o.net_disbursement_inr)} net
                    </span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {o.ltv_percent}% LTV · principal ₹{fmtInr(o.gross_principal_inr)} · fee ₹
                    {fmtInr(o.processing_fee_inr)} ({o.processing_fee_percent}%)
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {(quote && (showCompareList || singleJewellerQuote)) ? (
            <div className="card" style={{ marginTop: '1rem', padding: '1rem', borderRadius: 16 }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>
                {singleJewellerQuote ? 'Your loan offer' : 'Quote'} — {quote.jeweller_label}
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Collateral ₹{fmtInr(quote.collateral_value_inr)} ({quote.grams} g @ ₹
                {fmtInr(quote.reference_metal_inr_per_gram)}/g) × {quote.ltv_percent}% = principal ₹
                {fmtInr(quote.gross_principal_inr)}. After {quote.processing_fee_percent}% processing fee (₹
                {fmtInr(quote.processing_fee_inr)}), you receive ₹{fmtInr(quote.net_disbursement_inr)}.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.85rem' }}
                disabled={busy}
                onClick={() => void onConfirm()}
              >
                Submit loan request
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {outstanding.length > 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem' }}>Open requests</h3>
          <ul style={{ paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
            {outstanding.map((r) => (
              <li key={r.id}>
                {r.reference} · {r.jeweller_label} · {r.grams} g · ₹{fmtInr(r.net_disbursement_inr)} ·{' '}
                {r.status.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

async function authFetchCompare(
  grams: string,
): Promise<{ ok: true; data: GoldLoanCompareDTO } | { ok: false; detail: string }> {
  const data = await postGoldLoanCompare(grams)
  if (!data) {
    return { ok: false, detail: 'Could not load loan offers from your vault jewellers.' }
  }
  return { ok: true, data }
}
