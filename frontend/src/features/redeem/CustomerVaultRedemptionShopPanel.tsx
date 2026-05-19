import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductPhoto } from '@/components/ProductPhoto'
import { useAuth } from '@/context/AuthContext'
import {
  fetchMarketplaceProducts,
  fetchVerifiedJewellers,
  type JewellerStorefrontDTO,
  type MarketplaceProductDTO,
} from '@/lib/marketplaceApi'
import { LIVE_CATALOG_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  authorizeVaultRedemptionCross,
  confirmVaultRedemptionPurchase,
  fetchVaultRedemptionQuote,
  type VaultRedemptionQuoteDTO,
} from '@/lib/vaultRedemptionPurchaseApi'
import { VaultGoldTaxSavingsNotice } from '@/features/gold/VaultGoldTaxSavingsNotice'
import { formatInr, MarketplaceProductListSummary } from '@/features/marketplace/productPricing'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function CustomerVaultRedemptionShopPanel() {
  const { user, refreshProfile } = useAuth()
  const kycOk = user?.kyc_status === 'verified'

  const [cities, setCities] = useState<string[]>(['All Cities'])
  const [city, setCity] = useState('All Cities')
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [jewellerId, setJewellerId] = useState<number | undefined>(undefined)
  const [products, setProducts] = useState<MarketplaceProductDTO[]>([])
  const [search, setSearch] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [selected, setSelected] = useState<MarketplaceProductDTO | null>(null)
  const [quote, setQuote] = useState<VaultRedemptionQuoteDTO | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [crossBusy, setCrossBusy] = useState(false)
  const [crossMsg, setCrossMsg] = useState('')
  const [crossRequestId, setCrossRequestId] = useState<number | null>(null)
  const [okMsg, setOkMsg] = useState('')

  const refreshJewellers = useCallback(async () => {
    const c = city !== 'All Cities' ? city : undefined
    const rows = await fetchVerifiedJewellers(c)
    setJewellers(rows)
    const uniq = new Set<string>()
    for (const j of rows) {
      if (j.city?.trim()) uniq.add(j.city.trim())
    }
    setCities(['All Cities', ...Array.from(uniq).sort((a, b) => a.localeCompare(b))])
  }, [city])

  const refreshProducts = useCallback(async () => {
    setLoadErr('')
    const rows = await fetchMarketplaceProducts(
      jewellerId != null ? { jewellerId } : undefined,
    )
    setProducts(rows.filter((p) => p.id > 0))
  }, [jewellerId])

  useEffect(() => {
    void refreshJewellers()
  }, [refreshJewellers])

  useEffect(() => {
    void refreshProducts()
  }, [refreshProducts])

  useLivePoll(refreshProducts, LIVE_CATALOG_POLL_MS, kycOk)

  const loadQuote = useCallback(async (p: MarketplaceProductDTO) => {
    setQuoteErr('')
    setOkMsg('')
    const q = await fetchVaultRedemptionQuote(p.id)
    if (!q.ok) {
      setQuote(null)
      setQuoteErr(q.detail)
      return
    }
    setQuote(q.data)
    const active = q.data.cross_redemption?.active_request
    if (active?.id) {
      setCrossRequestId(active.id)
      setCrossMsg(active.funded ? 'Gold move complete — you can confirm checkout.' : `${active.public_reference}: ${active.checkout_status}`)
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      setQuote(null)
      setQuoteErr('')
      setCrossMsg('')
      setCrossRequestId(null)
      return
    }
    void loadQuote(selected)
  }, [selected, loadQuote])

  const crossPending = Boolean(selected && quote?.cross_redemption?.needed && !quote.sufficient_vault)

  useLivePoll(
    () => {
      if (selected && crossPending) void loadQuote(selected)
    },
    4000,
    Boolean(selected && crossPending),
  )

  const onCrossAuthorize = async () => {
    if (!selected || !quote?.cross_redemption) return
    setCrossBusy(true)
    setCrossMsg('')
    setQuoteErr('')
    try {
      const out = await authorizeVaultRedemptionCross(
        selected.id,
        quote.cross_redemption.source_jeweller_id,
      )
      if (!out.ok) {
        setQuoteErr(out.detail)
        return
      }
      if (out.request_id) setCrossRequestId(out.request_id)
      const ref = out.public_reference ?? 'Request'
      if (out.funded) {
        setCrossMsg(`${ref} complete — you can confirm checkout.`)
      } else if (out.status === 'PENDING') {
        setCrossMsg(`${ref} submitted. Source jeweller (${quote.cross_redemption.source_label}) must approve.`)
      } else {
        setCrossMsg(`${ref}: ${out.checkout_status ?? 'Processing'}`)
      }
      if (out.quote) setQuote(out.quote)
      else await loadQuote(selected)
    } finally {
      setCrossBusy(false)
    }
  }

  const onConfirm = async () => {
    if (!selected || !quote?.sufficient_vault) return
    setBusy(true)
    setOkMsg('')
    setQuoteErr('')
    try {
      const out = await confirmVaultRedemptionPurchase(selected.id, {
        vaultGrams: parseG(quote.grams_required),
        crossRedemptionRequestId: crossRequestId ?? undefined,
        expected: {
          final_invoice_inr: quote.final_invoice_inr,
          cash_payable_inr: quote.cash_payable_inr,
          grams_charged: quote.grams_required,
        },
      })
      if (!out.ok) {
        if (out.staleQuote) {
          setQuote(out.staleQuote)
          setQuoteErr(out.detail)
          return
        }
        setQuoteErr(out.detail)
        return
      }
      const saved = parseG(out.redemption.gst_on_gold_saved_inr)
      const savedNote = saved > 0 ? ` Vault saved you ₹${formatInr(saved)} on gold GST.` : ''
      setOkMsg(`${out.redemption.reference}: debited ${out.redemption.grams_charged} g.${savedNote} ${out.detail}`)
      setSelected(null)
      void refreshProducts()
      void refreshProfile()
    } finally {
      setBusy(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        p.jeweller_name.toLowerCase().includes(t) ||
        p.category.toLowerCase().includes(t),
    )
  }, [products, search])

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        <strong>Redeem with vault gold</strong> — pay from your holding (deposits, fractional, transfers, schemes). GST on
        gold is <strong>not charged again</strong> on metal paid from vault; we show how much the vault saved you. Collect
        the physical piece at the showroom.
      </p>

      {!kycOk ? (
        <p className="form-error" role="alert">
          Complete KYC to redeem with vault gold.{' '}
          <Link to="/userdashboard?section=profile_kyc">Open KYC</Link>
        </p>
      ) : null}

      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 20,
          marginBottom: '1.25rem',
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <div>
          <label htmlFor="vault-red-city" style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 700 }}>
            City
          </label>
          <select
            id="vault-red-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setJewellerId(undefined)
            }}
            className="field-control"
            style={{ width: '100%', marginTop: 6 }}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="vault-red-jeweller"
            style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 700 }}
          >
            Jeweller
          </label>
          <select
            id="vault-red-jeweller"
            value={jewellerId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setJewellerId(v ? Number.parseInt(v, 10) : undefined)
              setSelected(null)
            }}
            className="field-control"
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="">All jewellers</option>
            {jewellers.map((j) => (
              <option key={j.id} value={j.id}>
                {j.business_name}
                {j.city ? ` · ${j.city}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2 / auto' }}>
          <label htmlFor="vault-red-search" style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 700 }}>
            Search products
          </label>
          <input
            id="vault-red-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, category, jeweller…"
            autoComplete="off"
            style={{
              width: '100%',
              marginTop: 6,
              padding: '0.65rem 0.85rem',
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {okMsg ? (
        <p style={{ color: 'var(--success)', marginBottom: '1rem', fontWeight: 600 }}>
          {okMsg}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {filteredProducts.map((p) => (
          <article
            key={p.id}
            className="pf-card pf-card--lift"
            style={{
              cursor: 'pointer',
              padding: 0,
              overflow: 'hidden',
              boxShadow:
                selected?.id === p.id ? '0 0 0 2px var(--gold-light)' : undefined,
            }}
            onClick={() => setSelected(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSelected(p)
            }}
            role="button"
            tabIndex={0}
          >
            <ProductPhoto src={p.image_url} alt="" />
            <div style={{ padding: '0.85rem 1rem 1rem' }}>
              <h3 className="pf-card__title" style={{ fontSize: '0.95rem', margin: '0 0 0.35rem' }}>
                {p.name}
              </h3>
              <p className="pf-card__meta" style={{ margin: 0, fontSize: '0.78rem' }}>
                {p.jeweller_name}
                {p.jeweller_city ? ` · ${p.jeweller_city}` : ''}
              </p>
              <div style={{ marginTop: '0.65rem' }}>
                <MarketplaceProductListSummary p={p} />
              </div>
              {p.stock_quantity != null && p.stock_quantity <= 0 ? (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--danger)' }}>Out of stock</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No listings match this filter.</p>
      ) : null}

      {selected ? (
        <div
          className="card"
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: 20,
            border: '1px solid var(--border-soft)',
          }}
        >
          <h3 className="pf-card__title">Checkout with vault · {selected.name}</h3>
          {quoteErr ? <p className="form-error">{quoteErr}</p> : null}
          {!quote && !quoteErr ? <p style={{ color: 'var(--text-muted)' }}>Loading quote…</p> : null}
          {quote ? (
            <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>{quote.jeweller_name}</strong>
                {quote.same_store ? (
                  <span style={{ color: 'var(--success)', marginLeft: 8 }}>· Same-shop making rates apply</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· Cross-jeweller making rates</span>
                )}
              </p>
              <p style={{ margin: '0 0 0.35rem' }}>
                Catalogue total (reference, incl. taxes):{' '}
                <strong className="tabular">₹{formatInr(parseG(quote.final_invoice_inr))}</strong>
              </p>
              <VaultGoldTaxSavingsNotice gstSavedInr={parseG(quote.gst_on_gold_saved_inr)} />
              {parseG(quote.cash_payable_inr) > 0.01 ? (
                <p style={{ margin: '0.5rem 0 0.35rem' }}>
                  Cash / UPI balance after vault:{' '}
                  <strong className="tabular">₹{formatInr(parseG(quote.cash_payable_inr))}</strong>
                </p>
              ) : parseG(quote.grams_required) > 0 ? (
                <p style={{ margin: '0.5rem 0 0.35rem', color: 'var(--success)', fontWeight: 600 }}>
                  Fully covered from vault — no extra cash due for this order.
                </p>
              ) : null}
              <p style={{ margin: '0.65rem 0 0.35rem' }}>
                Metal rate used for gram conversion:{' '}
                <strong className="tabular">₹{formatInr(parseG(quote.metal_rate_inr_per_gram), 2)}</strong>/g
              </p>
              <p style={{ margin: '0 0 0.35rem' }}>
                Grams to debit: <strong className="tabular">{quote.grams_required} g</strong>
              </p>
              <p style={{ margin: '0 0 0.35rem' }}>
                Your vault at this jeweller:{' '}
                <strong className="tabular">{quote.vault_grams_available} g</strong>
              </p>
              {!quote.sufficient_vault && quote.cross_redemption?.needed ? (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-soft)',
                    background: 'var(--veil)',
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                    Your gold is at <strong>{quote.cross_redemption.source_label}</strong>. Move{' '}
                    <strong>{quote.cross_redemption.grams_to_move} g</strong> to{' '}
                    <strong>{quote.jeweller_name}</strong> to checkout here.
                  </p>
                  {crossMsg ? (
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--success)' }}>
                      {crossMsg}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!kycOk || crossBusy}
                    onClick={() => void onCrossAuthorize()}
                  >
                    {crossBusy ? 'Starting…' : 'Move gold to this jeweller'}
                  </button>
                </div>
              ) : null}
              {!quote.sufficient_vault && !quote.cross_redemption?.needed ? (
                <p className="form-error" style={{ marginTop: '0.75rem' }}>
                  Not enough vaulted gold with this jeweller and no other vault can cover the shortfall.
                </p>
              ) : null}
              <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    !kycOk || busy || !quote.sufficient_vault || (selected.stock_quantity != null && selected.stock_quantity <= 0)
                  }
                  onClick={() => void onConfirm()}
                >
                  {busy ? 'Processing…' : 'Confirm vault redemption'}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setSelected(null)}>
                  Cancel
                </button>
                <Link className="btn btn-ghost" to={`/marketplace/product/${selected.id}`} target="_blank" rel="noreferrer">
                  Open public listing
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
