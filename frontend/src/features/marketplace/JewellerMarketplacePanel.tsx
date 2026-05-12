import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { authFetch } from '@/lib/api'
import { fetchGoldTicker, type GoldTickerPayload } from '@/lib/marketplaceApi'
import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'

type ProductRow = Record<string, unknown>

/** API shape for jeweller pricing + marketplace card fields. */
type ProfileApi = Record<string, unknown>

function formatInr(n: number, fractionDigits = 2): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

function parseN(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

type SellbackMode = 'percent' | 'fixed'

function inferSellbackMode(pctStr: string, fixStr: string): SellbackMode {
  const pct = parseN(pctStr)
  const fix = parseN(fixStr)
  if (pct > 0) return 'percent'
  if (fix > 0) return 'fixed'
  return 'percent'
}

function previewIndicativeBuyback(
  platformBase: number,
  markupPct: number,
  mode: SellbackMode,
  pctStr: string,
  fixStr: string,
): number {
  const refMetal = platformBase * (1 + markupPct / 100)
  if (mode === 'percent') {
    const p = parseN(pctStr)
    return Math.max(0, refMetal * (1 - p / 100))
  }
  const f = parseN(fixStr)
  return Math.max(0, refMetal - f)
}

function numOrZero(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : '0'
}

export function JewellerMarketplacePanel() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [pfDraft, setPfDraft] = useState({
    gold_rate_source: 'live_cridora' as 'live_cridora' | 'manual',
    manual_gold_rate_inr_per_gram: '',
    live_markup_percent: '',
    live_markup_inr_per_gram: '',
    default_gold_markup_percent: '',
    sellback_deduction_percent: '',
    sellback_fixed_inr_per_gram: '',
    gold_deposit_note: '',
    representative_making_charge_inr_per_gram: '',
    buyback_headline_inr_per_gram: '',
    gold_deposit_yield_apr_percent: '',
    gold_loan_interest_apr_percent: '',
    logo_url: '',
    credibility_score: '',
    lock_in_summary: '',
    minimum_redeemable_grams: '',
    same_store_mc_benefit: '',
    cross_redemption_fee_note: '',
    metric_active_users: '0',
    metric_total_redeemed_gold_grams: '0',
    metric_years_active: '0',
    feat_instant_redemption: false,
    feat_zero_mc_same_store: false,
    feat_loan_available: false,
    feat_goldnest_available: false,
    feat_emergency_funds: false,
    feat_cross_redemption: true,
  })

  const [ticker, setTicker] = useState<GoldTickerPayload | null>(null)
  const [sellbackDeductionMode, setSellbackDeductionMode] = useState<SellbackMode>('percent')

  const [form, setForm] = useState({
    name: '',
    category: '',
    gold_weight_grams: '',
    making_charge_mode: MAKING_FIXED_PER_GRAM,
    making_charge_per_gram: '',
    making_charge_percent: '',
    image_url: '',
    pricing_mode: 'spot_markup',
    jeweller_markup_percent: '',
    manual_gold_rate_inr_per_gram: '',
    stone_included: false,
    stone_type: '',
    stone_weight_grams: '',
    stone_cost_inr: '',
    is_x_redeem: true,
    is_published: true,
    rating: '4.5',
    same_store_benefit_note: '',
  })

  const refresh = useCallback(async () => {
    setLoadError('')
    const [pr, ls, tk] = await Promise.all([
      authFetch('/api/v1/jeweller/marketplace/profile/'),
      authFetch('/api/v1/jeweller/marketplace/products/'),
      fetchGoldTicker(),
    ])
    setTicker(tk)
    if (!pr.ok) {
      const j = await pr.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load pricing profile.')
      return
    }
    if (!ls.ok) {
      const j = await ls.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load products.')
      return
    }
    const pJson = (await pr.json()) as ProfileApi
    const lJson = (await ls.json()) as { results: ProductRow[] }
    setPfDraft({
      gold_rate_source:
        pJson.gold_rate_source === 'manual'
          ? 'manual'
          : 'live_cridora',
      manual_gold_rate_inr_per_gram: String(pJson.manual_gold_rate_inr_per_gram ?? ''),
      live_markup_percent: String(pJson.live_markup_percent ?? '0'),
      live_markup_inr_per_gram: String(pJson.live_markup_inr_per_gram ?? '0'),
      default_gold_markup_percent: String(pJson.default_gold_markup_percent ?? ''),
      sellback_deduction_percent: String(pJson.sellback_deduction_percent ?? ''),
      sellback_fixed_inr_per_gram: String(pJson.sellback_fixed_inr_per_gram ?? ''),
      gold_deposit_note: String(pJson.gold_deposit_note ?? ''),
      representative_making_charge_inr_per_gram: String(
        pJson.representative_making_charge_inr_per_gram ?? '0',
      ),
      buyback_headline_inr_per_gram:
        pJson.buyback_headline_inr_per_gram != null && String(pJson.buyback_headline_inr_per_gram) !== ''
          ? String(pJson.buyback_headline_inr_per_gram)
          : '',
      gold_deposit_yield_apr_percent: String(pJson.gold_deposit_yield_apr_percent ?? '0'),
      gold_loan_interest_apr_percent: String(pJson.gold_loan_interest_apr_percent ?? '0'),
      logo_url: String(pJson.logo_url ?? ''),
      credibility_score:
        pJson.credibility_score != null && String(pJson.credibility_score) !== ''
          ? String(pJson.credibility_score)
          : '',
      lock_in_summary: String(pJson.lock_in_summary ?? ''),
      minimum_redeemable_grams:
        pJson.minimum_redeemable_grams != null && String(pJson.minimum_redeemable_grams) !== ''
          ? String(pJson.minimum_redeemable_grams)
          : '',
      same_store_mc_benefit: String(pJson.same_store_mc_benefit ?? ''),
      cross_redemption_fee_note: String(pJson.cross_redemption_fee_note ?? ''),
      metric_active_users: String(pJson.metric_active_users ?? '0'),
      metric_total_redeemed_gold_grams: String(pJson.metric_total_redeemed_gold_grams ?? '0'),
      metric_years_active: String(pJson.metric_years_active ?? '0'),
      feat_instant_redemption: Boolean(pJson.feat_instant_redemption),
      feat_zero_mc_same_store: Boolean(pJson.feat_zero_mc_same_store),
      feat_loan_available: Boolean(pJson.feat_loan_available),
      feat_goldnest_available: Boolean(pJson.feat_goldnest_available),
      feat_emergency_funds: Boolean(pJson.feat_emergency_funds),
      feat_cross_redemption: pJson.feat_cross_redemption !== false,
    })
    setSellbackDeductionMode(
      inferSellbackMode(
        String(pJson.sellback_deduction_percent ?? ''),
        String(pJson.sellback_fixed_inr_per_gram ?? ''),
      ),
    )
    setProducts(lJson.results ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveProfile = async () => {
    setBusy(true)
    setFormError('')
    const sellbackPct =
      sellbackDeductionMode === 'percent' ? numOrZero(pfDraft.sellback_deduction_percent) : '0'
    const sellbackFix =
      sellbackDeductionMode === 'fixed' ? numOrZero(pfDraft.sellback_fixed_inr_per_gram) : '0'
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: {
        gold_rate_source: pfDraft.gold_rate_source,
        manual_gold_rate_inr_per_gram:
          pfDraft.gold_rate_source === 'manual' && pfDraft.manual_gold_rate_inr_per_gram.trim() !== ''
            ? numOrZero(pfDraft.manual_gold_rate_inr_per_gram)
            : null,
        live_markup_percent: numOrZero(pfDraft.live_markup_percent),
        live_markup_inr_per_gram: numOrZero(pfDraft.live_markup_inr_per_gram),
        default_gold_markup_percent: numOrZero(pfDraft.default_gold_markup_percent),
        sellback_deduction_percent: sellbackPct,
        sellback_fixed_inr_per_gram: sellbackFix,
        gold_deposit_note: pfDraft.gold_deposit_note.trim(),
        representative_making_charge_inr_per_gram: numOrZero(
          pfDraft.representative_making_charge_inr_per_gram,
        ),
        buyback_headline_inr_per_gram:
          pfDraft.buyback_headline_inr_per_gram.trim() === ''
            ? null
            : numOrZero(pfDraft.buyback_headline_inr_per_gram),
        gold_deposit_yield_apr_percent: numOrZero(pfDraft.gold_deposit_yield_apr_percent),
        gold_loan_interest_apr_percent: numOrZero(pfDraft.gold_loan_interest_apr_percent),
        logo_url: pfDraft.logo_url.trim(),
        credibility_score:
          pfDraft.credibility_score.trim() === '' ? null : numOrZero(pfDraft.credibility_score),
        lock_in_summary: pfDraft.lock_in_summary.trim(),
        minimum_redeemable_grams:
          pfDraft.minimum_redeemable_grams.trim() === ''
            ? null
            : numOrZero(pfDraft.minimum_redeemable_grams),
        same_store_mc_benefit: pfDraft.same_store_mc_benefit.trim(),
        cross_redemption_fee_note: pfDraft.cross_redemption_fee_note.trim(),
        metric_active_users: Math.max(0, Math.floor(parseN(pfDraft.metric_active_users))),
        metric_total_redeemed_gold_grams: numOrZero(pfDraft.metric_total_redeemed_gold_grams),
        metric_years_active: numOrZero(pfDraft.metric_years_active),
        feat_instant_redemption: pfDraft.feat_instant_redemption,
        feat_zero_mc_same_store: pfDraft.feat_zero_mc_same_store,
        feat_loan_available: pfDraft.feat_loan_available,
        feat_goldnest_available: pfDraft.feat_goldnest_available,
        feat_emergency_funds: pfDraft.feat_emergency_funds,
        feat_cross_redemption: pfDraft.feat_cross_redemption,
      },
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    await refresh()
  }

  const addProduct = async () => {
    setBusy(true)
    setFormError('')
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      category: form.category.trim(),
      gold_weight_grams: numOrZero(form.gold_weight_grams),
      making_charge_mode: form.making_charge_mode,
      image_url: form.image_url.trim(),
      pricing_mode: form.pricing_mode,
      is_x_redeem: form.is_x_redeem,
      is_published: form.is_published,
      rating: numOrZero(form.rating),
      stone_included: form.stone_included,
      stone_type: form.stone_type.trim(),
      same_store_benefit_note: form.same_store_benefit_note.trim(),
    }
    if (form.making_charge_mode === MAKING_PERCENT_OF_METAL) {
      body.making_charge_percent = numOrZero(form.making_charge_percent)
      body.making_charge_per_gram = '0'
    } else {
      body.making_charge_per_gram = numOrZero(form.making_charge_per_gram)
      body.making_charge_percent = null
    }
    const jmp = form.jeweller_markup_percent.trim()
    if (jmp !== '') {
      body.jeweller_markup_percent = numOrZero(jmp)
    }
    if (form.pricing_mode === 'manual_rate') {
      body.manual_gold_rate_inr_per_gram = numOrZero(form.manual_gold_rate_inr_per_gram)
    }
    if (form.stone_included) {
      const sw = form.stone_weight_grams.trim()
      if (sw !== '') {
        body.stone_weight_grams = numOrZero(sw)
      }
      const sc = form.stone_cost_inr.trim()
      if (sc !== '') {
        body.stone_cost_inr = numOrZero(sc)
      }
    }

    const res = await authFetch('/api/v1/jeweller/marketplace/products/', {
      method: 'POST',
      jsonBody: body,
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    setForm((f) => ({
      ...f,
      name: '',
      category: '',
      gold_weight_grams: '',
      making_charge_mode: MAKING_FIXED_PER_GRAM,
      making_charge_per_gram: '',
      making_charge_percent: '',
      image_url: '',
      jeweller_markup_percent: '',
      manual_gold_rate_inr_per_gram: '',
      stone_type: '',
      stone_weight_grams: '',
      stone_cost_inr: '',
      same_store_benefit_note: '',
    }))
    await refresh()
  }

  const removeProduct = async (id: number) => {
    setBusy(true)
    await authFetch(`/api/v1/jeweller/marketplace/products/${id}/`, { method: 'DELETE' })
    setBusy(false)
    await refresh()
  }

  const platformBaseInr = useMemo(
    () => (ticker ? parseN(ticker.platform_base_inr_per_gram_22k) : 0),
    [ticker],
  )
  const reference22kInr = useMemo(
    () => (ticker ? parseN(ticker.reference_price_inr_per_gram_22k) : 0),
    [ticker],
  )
  const adminMarkupTicker = useMemo(
    () => (ticker ? parseN(ticker.admin_markup_percent) : 0),
    [ticker],
  )

  const jewellerStore22k = useMemo(() => {
    if (pfDraft.gold_rate_source === 'manual') {
      const m = parseN(pfDraft.manual_gold_rate_inr_per_gram)
      return m > 0 ? m : platformBaseInr
    }
    const lp = parseN(pfDraft.live_markup_percent)
    const lf = parseN(pfDraft.live_markup_inr_per_gram)
    return platformBaseInr * (1 + lp / 100) + lf
  }, [
    pfDraft.gold_rate_source,
    pfDraft.manual_gold_rate_inr_per_gram,
    pfDraft.live_markup_percent,
    pfDraft.live_markup_inr_per_gram,
    platformBaseInr,
  ])

  const referenceMetalInr = useMemo(() => {
    const m = parseN(pfDraft.default_gold_markup_percent)
    return jewellerStore22k * (1 + m / 100)
  }, [jewellerStore22k, pfDraft.default_gold_markup_percent])

  const indicativeBuybackPreview = useMemo(
    () =>
      previewIndicativeBuyback(
        jewellerStore22k,
        parseN(pfDraft.default_gold_markup_percent),
        sellbackDeductionMode,
        pfDraft.sellback_deduction_percent,
        pfDraft.sellback_fixed_inr_per_gram,
      ),
    [
      jewellerStore22k,
      pfDraft.default_gold_markup_percent,
      sellbackDeductionMode,
      pfDraft.sellback_deduction_percent,
      pfDraft.sellback_fixed_inr_per_gram,
    ],
  )

  const tableInput: CSSProperties = {
    width: '100%',
    maxWidth: 200,
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border-soft)',
    background: 'var(--veil)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    fontSize: '0.85rem',
  }

  return (
    <div className="dash-panel-max jeweller-mkt">
      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Jeweller marketplace card &amp; redemption details
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          Fields below power the public jeweller card: identity, gold and sellback lines, lock-in, minimum redeemable grams,
          same-store MC wording, cross-redemption fee disclosure, credibility score, feature tags, and optional operating
          metrics. Keep copy concise — customers compare multiple showrooms.
        </p>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label className="field">
            <span>Logo URL</span>
            <input
              value={pfDraft.logo_url}
              onChange={(e) => setPfDraft((p) => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>Credibility score (0–100)</span>
            <input
              inputMode="decimal"
              value={pfDraft.credibility_score}
              onChange={(e) => setPfDraft((p) => ({ ...p, credibility_score: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            <span>Lock-in summary</span>
            <input
              value={pfDraft.lock_in_summary}
              onChange={(e) => setPfDraft((p) => ({ ...p, lock_in_summary: e.target.value }))}
              placeholder="e.g. 30 / 90 days · none optional"
            />
          </label>
          <label className="field">
            <span>Minimum redeemable (g)</span>
            <input
              inputMode="decimal"
              value={pfDraft.minimum_redeemable_grams}
              onChange={(e) => setPfDraft((p) => ({ ...p, minimum_redeemable_grams: e.target.value }))}
              placeholder="e.g. 0.25"
            />
          </label>
          <label className="field">
            <span>Same-store making charge benefit</span>
            <input
              value={pfDraft.same_store_mc_benefit}
              onChange={(e) => setPfDraft((p) => ({ ...p, same_store_mc_benefit: e.target.value }))}
              placeholder="e.g. 0% MC same store"
            />
          </label>
          <label className="field">
            <span>Cross-redemption fee note</span>
            <input
              value={pfDraft.cross_redemption_fee_note}
              onChange={(e) => setPfDraft((p) => ({ ...p, cross_redemption_fee_note: e.target.value }))}
              placeholder="Platform / MC disclosure"
            />
          </label>
          <label className="field">
            <span>Active users (display metric)</span>
            <input
              inputMode="numeric"
              value={pfDraft.metric_active_users}
              onChange={(e) => setPfDraft((p) => ({ ...p, metric_active_users: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Total redeemed gold (g, display)</span>
            <input
              inputMode="decimal"
              value={pfDraft.metric_total_redeemed_gold_grams}
              onChange={(e) => setPfDraft((p) => ({ ...p, metric_total_redeemed_gold_grams: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Years active (display)</span>
            <input
              inputMode="decimal"
              value={pfDraft.metric_years_active}
              onChange={(e) => setPfDraft((p) => ({ ...p, metric_years_active: e.target.value }))}
            />
          </label>
        </div>
        <fieldset
          style={{
            marginTop: '1rem',
            border: '1px solid var(--border-soft)',
            borderRadius: 14,
            padding: '0.85rem 1rem',
          }}
        >
          <legend style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0 0.35rem' }}>Feature tags (marketplace)</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_instant_redemption}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_instant_redemption: e.target.checked }))}
              />
              <span>Instant redemption</span>
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_zero_mc_same_store}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_zero_mc_same_store: e.target.checked }))}
              />
              <span>0% MC (same store)</span>
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_loan_available}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_loan_available: e.target.checked }))}
              />
              <span>Loan available</span>
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_goldnest_available}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_goldnest_available: e.target.checked }))}
              />
              <span>GoldNest</span>
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_emergency_funds}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_emergency_funds: e.target.checked }))}
              />
              <span>Emergency funds</span>
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <input
                type="checkbox"
                checked={pfDraft.feat_cross_redemption}
                onChange={(e) => setPfDraft((p) => ({ ...p, feat_cross_redemption: e.target.checked }))}
              />
              <span>Cross redemption</span>
            </label>
          </div>
        </fieldset>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void saveProfile()}
          style={{ marginTop: '1rem' }}
        >
          Save marketplace profile
        </button>
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Storefront pricing &amp; sellback
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          Cridora&apos;s resolved 22K base (global spot with INR FX, then admin fallback) is your starting point. Choose
          <strong> live Cridora</strong> and add your markup % and/or fixed ₹/g on that base, or choose <strong>manual</strong>{' '}
          and set your own 22K ₹/g for all spot-linked SKUs. Default gold markup then applies on top of your store 22K
          reference for listings without a per-SKU override. Product-level manual rates still override everything for that
          SKU. Fractional gold buys and buyback previews follow the same reference metal.
        </p>

        <div
          className="card"
          style={{
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            borderRadius: 14,
            background: 'var(--veil-35)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
            }}
          >
            Live ticker (22K · comparison)
          </p>
          {ticker ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem 1.75rem',
                fontSize: '0.88rem',
                alignItems: 'baseline',
              }}
            >
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Reference </span>
                <strong className="tabular">₹{formatInr(reference22kInr, 2)}/g</strong>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Platform markup </span>
                <strong className="tabular">{formatInr(adminMarkupTicker, 3)}%</strong>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Resolved Cridora 22K </span>
                <strong className="tabular" style={{ color: 'var(--gold-light)' }}>
                  ₹{formatInr(platformBaseInr, 2)}/g
                </strong>
                {ticker.cridora_base_source ? (
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginLeft: 8 }}>
                    ({ticker.cridora_base_source.replace(/_/g, ' ')})
                  </span>
                ) : null}
              </span>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                Updated {new Date(ticker.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Ticker unavailable — check API or try Refresh after opening Marketplace.
            </p>
          )}
        </div>

        <div className="dash-table-scroll card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="admin-user-table">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Value</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Your store 22K (before default SKU markup)</td>
                <td className="tabular" style={{ fontWeight: 700 }}>
                  ₹{formatInr(jewellerStore22k, 2)}/g
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  From Cridora live + your live markups, or your manual 22K rate.
                </td>
              </tr>
              <tr>
                <td>Gold rate source</td>
                <td colSpan={2}>
                  <select
                    style={{ ...tableInput, maxWidth: 280 }}
                    value={pfDraft.gold_rate_source}
                    onChange={(e) =>
                      setPfDraft((p) => ({
                        ...p,
                        gold_rate_source: e.target.value === 'manual' ? 'manual' : 'live_cridora',
                      }))
                    }
                  >
                    <option value="live_cridora">Cridora live 22K + my markups</option>
                    <option value="manual">Manual 22K ₹/g (fixed)</option>
                  </select>
                </td>
              </tr>
              {pfDraft.gold_rate_source === 'live_cridora' ? (
                <>
                  <tr>
                    <td>Markup on Cridora 22K (%)</td>
                    <td>
                      <input
                        style={tableInput}
                        inputMode="decimal"
                        value={pfDraft.live_markup_percent}
                        onChange={(e) => setPfDraft((p) => ({ ...p, live_markup_percent: e.target.value }))}
                      />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Percent applied to resolved Cridora 22K before ₹/g add-on.
                    </td>
                  </tr>
                  <tr>
                    <td>Extra on live 22K (₹/g)</td>
                    <td>
                      <input
                        style={tableInput}
                        inputMode="decimal"
                        value={pfDraft.live_markup_inr_per_gram}
                        onChange={(e) => setPfDraft((p) => ({ ...p, live_markup_inr_per_gram: e.target.value }))}
                      />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Added after percent markup on Cridora 22K.
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td>Manual 22K rate (₹/g)</td>
                  <td>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.manual_gold_rate_inr_per_gram}
                      onChange={(e) =>
                        setPfDraft((p) => ({ ...p, manual_gold_rate_inr_per_gram: e.target.value }))
                      }
                    />
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Required for manual mode; drives all spot-linked SKUs and fractional quotes.
                  </td>
                </tr>
              )}
              <tr>
                <td>Default gold markup</td>
                <td>
                  <label className="field" style={{ margin: 0, gap: '0.35rem' }}>
                    <span className="sr-only">Default gold markup percent</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.default_gold_markup_percent}
                      onChange={(e) => setPfDraft((p) => ({ ...p, default_gold_markup_percent: e.target.value }))}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>% on your store 22K</span>
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Applies to spot-linked SKUs without a per-SKU markup override.
                </td>
              </tr>
              <tr>
                <td>Your reference metal (after default SKU markup)</td>
                <td className="tabular" style={{ fontWeight: 700 }}>
                  ₹{formatInr(referenceMetalInr, 2)}/g
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Store 22K × (1 + default markup ÷ 100). Used for sellback preview and directory when no headline override.
                </td>
              </tr>
              <tr>
                <td>Sellback deduction</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                    <div
                      role="group"
                      aria-label="Sellback deduction type"
                      style={{
                        display: 'inline-flex',
                        borderRadius: 10,
                        border: '1px solid var(--border-soft)',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        className={sellbackDeductionMode === 'percent' ? 'btn btn-primary' : 'btn btn-ghost'}
                        style={{
                          borderRadius: 0,
                          border: 'none',
                          padding: '0.4rem 0.65rem',
                          fontSize: '0.7rem',
                        }}
                        onClick={() => setSellbackDeductionMode('percent')}
                      >
                        Percent
                      </button>
                      <button
                        type="button"
                        className={sellbackDeductionMode === 'fixed' ? 'btn btn-primary' : 'btn btn-ghost'}
                        style={{
                          borderRadius: 0,
                          border: 'none',
                          padding: '0.4rem 0.65rem',
                          fontSize: '0.7rem',
                        }}
                        onClick={() => setSellbackDeductionMode('fixed')}
                      >
                        Fixed ₹/g
                      </button>
                    </div>
                    {sellbackDeductionMode === 'percent' ? (
                      <label className="field" style={{ margin: 0, flex: '1 1 120px' }}>
                        <span className="sr-only">Sellback percent</span>
                        <input
                          style={tableInput}
                          inputMode="decimal"
                          value={pfDraft.sellback_deduction_percent}
                          onChange={(e) =>
                            setPfDraft((p) => ({ ...p, sellback_deduction_percent: e.target.value }))
                          }
                          aria-label="Sellback deduction percent"
                        />
                      </label>
                    ) : (
                      <label className="field" style={{ margin: 0, flex: '1 1 120px' }}>
                        <span className="sr-only">Sellback fixed per gram</span>
                        <input
                          style={tableInput}
                          inputMode="decimal"
                          value={pfDraft.sellback_fixed_inr_per_gram}
                          onChange={(e) =>
                            setPfDraft((p) => ({ ...p, sellback_fixed_inr_per_gram: e.target.value }))
                          }
                          aria-label="Sellback fixed rupees per gram"
                        />
                      </label>
                    )}
                  </div>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Percent: buyback ≈ reference metal × (1 − %÷100). Fixed: buyback ≈ reference metal − ₹/g. Only the selected
                  mode is saved; the other is stored as 0.
                </td>
              </tr>
              <tr>
                <td>Preview indicative buyback</td>
                <td className="tabular" style={{ fontWeight: 700, color: 'var(--gold-light)' }}>
                  ₹{formatInr(indicativeBuybackPreview, 2)}/g
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Before optional headline override. Compare to platform base and your reference metal.
                </td>
              </tr>
              <tr>
                <td>Typical making charge (comparison)</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Typical making charge per gram</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.representative_making_charge_inr_per_gram}
                      onChange={(e) =>
                        setPfDraft((p) => ({ ...p, representative_making_charge_inr_per_gram: e.target.value }))
                      }
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Shown on your jeweller card and used as a comparison anchor for listings.
                </td>
              </tr>
              <tr>
                <td>Optional buyback headline</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Optional buyback headline</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.buyback_headline_inr_per_gram}
                      onChange={(e) => setPfDraft((p) => ({ ...p, buyback_headline_inr_per_gram: e.target.value }))}
                      placeholder="₹/g or leave blank"
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  If set, storefront buyback uses this headline instead of the derived rate.
                </td>
              </tr>
              <tr>
                <td>Gold deposit yield</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Gold deposit yield APR</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.gold_deposit_yield_apr_percent}
                      onChange={(e) =>
                        setPfDraft((p) => ({ ...p, gold_deposit_yield_apr_percent: e.target.value }))
                      }
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>% APR disclosed on directory.</td>
              </tr>
              <tr>
                <td>Gold loan interest</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Gold loan interest APR</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={pfDraft.gold_loan_interest_apr_percent}
                      onChange={(e) =>
                        setPfDraft((p) => ({ ...p, gold_loan_interest_apr_percent: e.target.value }))
                      }
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  The network messaging assumes zero-interest gold loans with a 2% processing fee; enter 0 if that matches your
                  programme. Non-zero values appear as APR for directory sorting.
                </td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                  <label className="field" style={{ margin: 0, width: '100%' }}>
                    <span>Gold deposit note (marketplace)</span>
                    <textarea
                      className="dash-textarea"
                      rows={3}
                      value={pfDraft.gold_deposit_note}
                      onChange={(e) => setPfDraft((p) => ({ ...p, gold_deposit_note: e.target.value }))}
                      style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}
                    />
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void saveProfile()}
          style={{ marginTop: '0.85rem' }}
        >
          Save pricing defaults
        </button>
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Add catalogue SKU
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '0.85rem' }}>
          Making can be a fixed ₹/gram on gold weight or a percentage of the computed gold metal value (weight × live
          metal ₹/g). Same-store notes are optional; pricing and fees at checkout stay accurate in the customer flow.
        </p>
        <datalist id="jeweller-mp-categories">
          <option value="Ornaments" />
          <option value="Chains" />
          <option value="Bangles" />
          <option value="Coins" />
          <option value="Bridal sets" />
          <option value="Rings" />
          <option value="Necklaces" />
        </datalist>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="field">
            <span>Product name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="field">
            <span>Category</span>
            <input
              list="jeweller-mp-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Ornaments, chains, coins…"
            />
          </label>
          <label className="field">
            <span>Gold weight (g)</span>
            <input
              value={form.gold_weight_grams}
              onChange={(e) => setForm((f) => ({ ...f, gold_weight_grams: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Making charge type</span>
            <select
              value={form.making_charge_mode}
              onChange={(e) => setForm((f) => ({ ...f, making_charge_mode: e.target.value }))}
            >
              <option value={MAKING_FIXED_PER_GRAM}>Fixed (₹ per gram of gold)</option>
              <option value={MAKING_PERCENT_OF_METAL}>Percentage of gold metal value</option>
            </select>
          </label>
          {form.making_charge_mode === MAKING_PERCENT_OF_METAL ? (
            <label className="field">
              <span>Making (% of gold metal value)</span>
              <input
                value={form.making_charge_percent}
                onChange={(e) => setForm((f) => ({ ...f, making_charge_percent: e.target.value }))}
                placeholder="e.g. 8.5"
              />
            </label>
          ) : (
            <label className="field">
              <span>Making charges (₹/g)</span>
              <input
                value={form.making_charge_per_gram}
                onChange={(e) => setForm((f) => ({ ...f, making_charge_per_gram: e.target.value }))}
              />
            </label>
          )}
          <div className="field" style={{ margin: 0 }}>
            <span>Purity</span>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 700, color: 'var(--gold-light)' }}>BIS 916 (22K) only</p>
          </div>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Image URL</span>
            <input
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Same-store benefit note (optional)</span>
            <textarea
              className="dash-textarea"
              rows={2}
              value={form.same_store_benefit_note}
              onChange={(e) => setForm((f) => ({ ...f, same_store_benefit_note: e.target.value }))}
              placeholder="e.g. 0% MC when you redeem ornaments with us"
              style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Overrides generic copy on the product card for this SKU.
            </span>
          </label>
          <label className="field">
            <span>Pricing mode</span>
            <select
              value={form.pricing_mode}
              onChange={(e) => setForm((f) => ({ ...f, pricing_mode: e.target.value }))}
            >
              <option value="spot_markup">Spot base + markup</option>
              <option value="manual_rate">Manual gold ₹/g</option>
            </select>
          </label>
          {form.pricing_mode === 'spot_markup' ? (
            <label className="field">
              <span>SKU markup override (%)</span>
              <input
                value={form.jeweller_markup_percent}
                onChange={(e) => setForm((f) => ({ ...f, jeweller_markup_percent: e.target.value }))}
                placeholder="Blank uses default above"
              />
            </label>
          ) : (
            <label className="field">
              <span>Manual gold rate (₹/g)</span>
              <input
                value={form.manual_gold_rate_inr_per_gram}
                onChange={(e) => setForm((f) => ({ ...f, manual_gold_rate_inr_per_gram: e.target.value }))}
              />
            </label>
          )}
          <label className="field">
            <span>Rating</span>
            <input value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.stone_included}
              onChange={(e) => setForm((f) => ({ ...f, stone_included: e.target.checked }))}
            />
            <span>Stone included</span>
          </label>
          {form.stone_included ? (
            <>
              <label className="field">
                <span>Stone type</span>
                <input
                  value={form.stone_type}
                  onChange={(e) => setForm((f) => ({ ...f, stone_type: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Stone weight (g)</span>
                <input
                  value={form.stone_weight_grams}
                  onChange={(e) => setForm((f) => ({ ...f, stone_weight_grams: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Stone cost (₹)</span>
                <input
                  value={form.stone_cost_inr}
                  onChange={(e) => setForm((f) => ({ ...f, stone_cost_inr: e.target.value }))}
                />
              </label>
            </>
          ) : null}
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.is_x_redeem}
              onChange={(e) => setForm((f) => ({ ...f, is_x_redeem: e.target.checked }))}
            />
            <span>Cross-jeweller redemption (X-redeem)</span>
          </label>
          <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            X-redeem controls platform settlement rules in the vault workflow; it does not change how making is entered above.
          </p>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
            />
            <span>Published (live after approval)</span>
          </label>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addProduct()} style={{ marginTop: '1rem' }}>
          Submit SKU for review
        </button>
      </section>

      <section>
        <h2 className="dash-table-title">Your listings</h2>
        <div className="dash-table-scroll card">
          <table className="admin-user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Weight</th>
                <th>Making</th>
                <th>Status</th>
                <th>Metal ₹/g</th>
                <th>Sellback ₹/g</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    No SKUs yet — approved items appear on the public marketplace.
                  </td>
                </tr>
              ) : (
                products.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{String(row.name ?? '')}</td>
                    <td>{String(row.category ?? '')}</td>
                    <td className="tabular">{String(row.gold_weight_grams ?? '')}</td>
                    <td className="tabular">
                      {String(row.making_charge_mode ?? MAKING_FIXED_PER_GRAM) === MAKING_PERCENT_OF_METAL
                        ? `${String(row.making_charge_percent ?? '')}% metal`
                        : String(row.making_charge_per_gram ?? '')}
                    </td>
                    <td>{String(row.moderation_status ?? '')}</td>
                    <td className="tabular">{String(row.metal_rate_inr_per_gram_used ?? '')}</td>
                    <td className="tabular">{String(row.sellback_indicative_inr_per_gram ?? '')}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost kyb-btn-sm"
                        disabled={busy}
                        onClick={() => void removeProduct(Number(row.id))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
