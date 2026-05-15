import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchGoldWallet,
  postGoldSellbackConfirm,
  postGoldSellbackQuote,
  type GoldWalletDTO,
  type SellbackQuoteDTO,
  type VaultRowDTO,
} from '@/lib/goldTransferApi'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function CustomerSellbackPanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [jewellerId, setJewellerId] = useState<number | null>(null)
  const [gramsInput, setGramsInput] = useState('')
  const [quote, setQuote] = useState<SellbackQuoteDTO | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busyQuote, setBusyQuote] = useState(false)
  const [busyConfirm, setBusyConfirm] = useState(false)

  const refreshWallet = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
  }, [])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  const vaultOpts = useMemo(() => {
    const rows = wallet?.vaults ?? []
    return rows.filter((v) => parseG(v.fractional_grams) > 0)
  }, [wallet])

  useEffect(() => {
    if (jewellerId != null) return
    if (vaultOpts.length === 0) return
    setJewellerId(vaultOpts[0].custodian_id)
  }, [vaultOpts, jewellerId])

  const selectedVault: VaultRowDTO | undefined = useMemo(() => {
    if (jewellerId == null) return undefined
    return vaultOpts.find((v) => v.custodian_id === jewellerId)
  }, [vaultOpts, jewellerId])

  const onGramsChange = (v: string) => {
    setGramsInput(v)
    setQuote(null)
    setQuoteErr('')
    setConfirmErr('')
    setSuccessMsg('')
  }

  const onJewellerChange = (id: number) => {
    setJewellerId(id)
    setQuote(null)
    setQuoteErr('')
    setConfirmErr('')
    setSuccessMsg('')
  }

  const runQuote = async () => {
    if (jewellerId == null) {
      setQuoteErr('Pick a jeweller vault.')
      return
    }
    const g = gramsInput.trim()
    if (!g) {
      setQuoteErr('Enter grams to sell back.')
      return
    }
    setBusyQuote(true)
    setQuoteErr('')
    setConfirmErr('')
    setSuccessMsg('')
    const out = await postGoldSellbackQuote(jewellerId, g)
    setBusyQuote(false)
    if (!out.ok) {
      setQuote(null)
      setQuoteErr(out.detail)
      return
    }
    setQuote(out.data)
  }

  const runConfirm = async () => {
    if (jewellerId == null || !quote) return
    const g = gramsInput.trim()
    if (!g || quote.grams !== g || quote.jeweller_id !== jewellerId) {
      setConfirmErr('Refresh the quote for the current jeweller and grams, then confirm.')
      return
    }
    setBusyConfirm(true)
    setConfirmErr('')
    setSuccessMsg('')
    const out = await postGoldSellbackConfirm(jewellerId, g)
    setBusyConfirm(false)
    if (!out.ok) {
      setConfirmErr(out.detail)
      return
    }
    setWallet(out.wallet)
    setSuccessMsg(out.detail)
    setQuote(null)
    setGramsInput('')
  }

  const quoteFresh =
    quote != null &&
    quote.jeweller_id === jewellerId &&
    quote.grams === gramsInput.trim() &&
    gramsInput.trim() !== ''

  return (
    <div className="dash-panel-max pf-scope">
      <h2 className="dash-panel-title">Cash sellback</h2>
      <p className="dash-panel-lead">
        Sell fractional vault gold back to the <strong>custodian jeweller</strong> at their indicative buyback ₹/g.
        Grams are deducted from your vault immediately;{' '}
        <strong>cash payout is offline</strong> per showroom settlement (MVP).
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {vaultOpts.length === 0 && !loadErr ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No vaulted balance to sell back yet. Complete a fractional purchase first.
        </p>
      ) : (
        <div className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 18, maxWidth: 520 }}>
          <label htmlFor="sellback-vault" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-faint)' }}>
            Vault (custodian)
          </label>
          <select
            id="sellback-vault"
            style={{
              width: '100%',
              marginTop: '0.35rem',
              padding: '0.55rem 0.65rem',
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil)',
              color: 'var(--text)',
              fontFamily: 'var(--font)',
            }}
            value={jewellerId ?? ''}
            onChange={(e) => onJewellerChange(Number.parseInt(e.target.value, 10))}
          >
            {vaultOpts.map((v) => (
              <option key={v.custodian_id} value={v.custodian_id}>
                {v.custodian_label || `Jeweller #${v.custodian_id}`} · {parseG(v.fractional_grams).toFixed(4)} g
              </option>
            ))}
          </select>

          {selectedVault ? (
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Available <strong className="tabular">{selectedVault.fractional_grams} g</strong> at this custodian.
            </p>
          ) : null}

          <label htmlFor="sellback-grams" style={{ display: 'block', marginTop: '1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-faint)' }}>
            Grams to sell back
          </label>
          <input
            id="sellback-grams"
            type="text"
            inputMode="decimal"
            className="tabular"
            style={{
              width: '100%',
              marginTop: '0.35rem',
              padding: '0.6rem 0.75rem',
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil)',
              color: 'var(--text)',
              fontFamily: 'var(--font)',
            }}
            value={gramsInput}
            onChange={(e) => onGramsChange(e.target.value)}
            placeholder="e.g. 0.5"
          />

          <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" disabled={busyQuote || jewellerId == null} onClick={() => void runQuote()}>
              {busyQuote ? 'Pricing…' : 'Get quote'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyConfirm || !quoteFresh}
              onClick={() => void runConfirm()}
            >
              {busyConfirm ? 'Confirming…' : 'Confirm sellback'}
            </button>
          </div>

          {quoteErr ? (
            <p className="form-error" style={{ marginTop: '0.85rem' }} role="alert">
              {quoteErr}
            </p>
          ) : null}
          {confirmErr ? (
            <p className="form-error" style={{ marginTop: '0.85rem' }} role="alert">
              {confirmErr}
            </p>
          ) : null}
          {successMsg ? (
            <p style={{ marginTop: '0.85rem', color: 'var(--success)', fontWeight: 600 }} role="status">
              {successMsg}
            </p>
          ) : null}

          {quote ? (
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-soft)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                display: 'grid',
                gap: '0.35rem',
              }}
            >
              <p style={{ margin: 0 }}>
                Indicative buyback{' '}
                <strong className="tabular" style={{ color: 'var(--text)' }}>
                  ₹{fmtInr(quote.buyback_inr_per_gram)}
                </strong>
                /g · reference metal ₹{fmtInr(quote.reference_metal_inr_per_gram)}/g
              </p>
              <p style={{ margin: 0 }}>
                Estimated cash{' '}
                <strong className="tabular" style={{ color: 'var(--gold-light)' }}>
                  ₹{fmtInr(quote.cash_estimate_inr)}
                </strong>{' '}
                for <strong className="tabular">{quote.grams} g</strong>
              </p>
              {quote.minimum_redeemable_grams ? (
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Minimum redeemable configured by jeweller:{' '}
                  <strong className="tabular">{quote.minimum_redeemable_grams} g</strong>
                </p>
              ) : null}
              {!quoteFresh ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Vault or grams changed — get a fresh quote before confirming.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
