import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authFetch, authUpload } from '@/lib/api'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'
import { useLivePoll } from '@/lib/useLivePoll'
import { numOrZero, parseN } from '@/features/marketplace/jewellerMarketplaceShared'

const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024

type ProductRow = Record<string, unknown>

type ProfileApi = Record<string, unknown>

export function JewellerMarketplacePanel() {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const skuImageInputRef = useRef<HTMLInputElement>(null)
  const catalogImageInputRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [productImageBusy, setProductImageBusy] = useState(false)
  const [pendingCatalogProductId, setPendingCatalogProductId] = useState<number | null>(null)

  const [cardDraft, setCardDraft] = useState({
    logo_url: '',
    credibility_score: '',
    minimum_redeemable_grams: '',
    same_store_mc_benefit: '',
    metric_active_users: '0',
    metric_total_redeemed_gold_grams: '0',
    metric_years_active: '0',
    feat_instant_redemption: false,
    feat_zero_mc_same_store: false,
    feat_loan_available: false,
    feat_goldnest_available: false,
    feat_emergency_funds: false,
  })

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

  const flashSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    setFormError('')
  }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(''), 6000)
    return () => window.clearTimeout(t)
  }, [successMsg])

  const refresh = useCallback(async () => {
    setLoadError('')
    const [pr, ls] = await Promise.all([
      authFetch('/api/v1/jeweller/marketplace/profile/'),
      authFetch('/api/v1/jeweller/marketplace/products/'),
    ])
    if (!pr.ok) {
      const j = await pr.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load marketplace profile.')
      return
    }
    if (!ls.ok) {
      const j = await ls.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load products.')
      return
    }
    const pJson = (await pr.json()) as ProfileApi
    const lJson = (await ls.json()) as { results: ProductRow[] }
    setCardDraft({
      logo_url: String(pJson.logo_url ?? ''),
      credibility_score:
        pJson.credibility_score != null && String(pJson.credibility_score) !== ''
          ? String(pJson.credibility_score)
          : '',
      minimum_redeemable_grams:
        pJson.minimum_redeemable_grams != null && String(pJson.minimum_redeemable_grams) !== ''
          ? String(pJson.minimum_redeemable_grams)
          : '',
      same_store_mc_benefit: String(pJson.same_store_mc_benefit ?? ''),
      metric_active_users: String(pJson.metric_active_users ?? '0'),
      metric_total_redeemed_gold_grams: String(pJson.metric_total_redeemed_gold_grams ?? '0'),
      metric_years_active: String(pJson.metric_years_active ?? '0'),
      feat_instant_redemption: Boolean(pJson.feat_instant_redemption),
      feat_zero_mc_same_store: Boolean(pJson.feat_zero_mc_same_store),
      feat_loan_available: Boolean(pJson.feat_loan_available),
      feat_goldnest_available: Boolean(pJson.feat_goldnest_available),
      feat_emergency_funds: Boolean(pJson.feat_emergency_funds),
    })
    setProducts(lJson.results ?? [])
  }, [])

  const pollProducts = useCallback(async () => {
    if (busy) return
    const ls = await authFetch('/api/v1/jeweller/marketplace/products/')
    if (!ls.ok) return
    const lJson = (await ls.json()) as { results: ProductRow[] }
    setProducts(lJson.results ?? [])
  }, [busy])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(pollProducts, LIVE_MARKETPLACE_EDITOR_POLL_MS, true)

  const uploadProductImage = async (file: File, productId?: number) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setSuccessMsg('')
      setFormError('Product image must be JPEG, PNG, or WebP.')
      return
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setSuccessMsg('')
      setFormError('Product image must be 4 MB or smaller.')
      return
    }
    setProductImageBusy(true)
    setFormError('')
    const fd = new FormData()
    fd.append('file', file)
    if (productId != null) {
      fd.append('product_id', String(productId))
    }
    let res: Response
    try {
      res = await authUpload('/api/v1/jeweller/marketplace/product-image/', fd)
    } catch {
      setSuccessMsg('')
      setFormError('Not signed in or upload failed to start.')
      setProductImageBusy(false)
      return
    }
    setProductImageBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuccessMsg('')
      setFormError(JSON.stringify(j))
      return
    }
    const body = (await res.json()) as { image_url?: string }
    const url = body.image_url
    if (url && productId == null) {
      setForm((f) => ({ ...f, image_url: url }))
    }
    await refresh()
    flashSuccess(
      productId != null ? 'Product photo saved.' : 'Photo uploaded — confirm SKU fields and submit for review.',
    )
  }

  const uploadLogo = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setSuccessMsg('')
      setFormError('Logo must be JPEG, PNG, or WebP.')
      return
    }
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      setSuccessMsg('')
      setFormError('Logo must be 2 MB or smaller.')
      return
    }
    setLogoBusy(true)
    setFormError('')
    const fd = new FormData()
    fd.append('file', file)
    let res: Response
    try {
      res = await authUpload('/api/v1/jeweller/marketplace/logo/', fd)
    } catch {
      setSuccessMsg('')
      setFormError('Not signed in or upload failed to start.')
      setLogoBusy(false)
      return
    }
    setLogoBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuccessMsg('')
      setFormError(JSON.stringify(j))
      return
    }
    const body = (await res.json()) as { logo_url?: string }
    if (body.logo_url) {
      setCardDraft((p) => ({ ...p, logo_url: body.logo_url ?? p.logo_url }))
    }
    await refresh()
    flashSuccess('Logo uploaded.')
  }

  const saveMarketplaceCard = async () => {
    setBusy(true)
    setFormError('')
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: {
        logo_url: cardDraft.logo_url.trim(),
        minimum_redeemable_grams:
          cardDraft.minimum_redeemable_grams.trim() === ''
            ? null
            : numOrZero(cardDraft.minimum_redeemable_grams),
        same_store_mc_benefit: cardDraft.same_store_mc_benefit.trim(),
        metric_active_users: Math.max(0, Math.floor(parseN(cardDraft.metric_active_users))),
        metric_total_redeemed_gold_grams: numOrZero(cardDraft.metric_total_redeemed_gold_grams),
        metric_years_active: numOrZero(cardDraft.metric_years_active),
        feat_instant_redemption: cardDraft.feat_instant_redemption,
        feat_zero_mc_same_store: cardDraft.feat_zero_mc_same_store,
        feat_loan_available: cardDraft.feat_loan_available,
        feat_goldnest_available: cardDraft.feat_goldnest_available,
        feat_emergency_funds: cardDraft.feat_emergency_funds,
      },
    })
    setBusy(false)
    if (!res.ok) {
      setSuccessMsg('')
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    await refresh()
    flashSuccess('Marketplace card saved.')
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
      setSuccessMsg('')
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
    flashSuccess('SKU submitted for admin review.')
  }

  const removeProduct = async (id: number) => {
    setBusy(true)
    setFormError('')
    const res = await authFetch(`/api/v1/jeweller/marketplace/products/${id}/`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      setSuccessMsg('')
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    await refresh()
    flashSuccess('SKU removed from catalogue.')
  }

  const disableActions = busy || logoBusy || productImageBusy

  return (
    <div className="dash-panel-max jeweller-mkt">
      <p className="dash-panel-lead">
        Manage your public storefront card and product catalogue. Configure{' '}
        <strong>buy rates, markups, sellback</strong>, vault lock-in, and{' '}
        <strong>Golden Scheme</strong> under{' '}
        <Link to="/dashboard/jeweller?section=mkt_policy">Marketplace · Rates &amp; schemes</Link>.
      </p>

      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {successMsg ? (
        <p className="admin-dash-form-success admin-dash-form-success--block" role="status">
          {successMsg}
        </p>
      ) : null}

      <input
        ref={catalogImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disableActions}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          const pid = pendingCatalogProductId
          e.target.value = ''
          setPendingCatalogProductId(null)
          if (f && pid != null) void uploadProductImage(f, pid)
        }}
      />

      <details className="jeweller-mkt-acc card" open>
        <summary>Marketplace storefront card</summary>
        <div className="jeweller-mkt-acc__body">
          <p className="dash-coming__text" style={{ marginTop: 0 }}>
            Logo, minimum redeemable grams, same-store MC line, optional metrics, and marketplace tags — shown on your
            directory card after KYB approval.
          </p>
          <table className="admin-user-table jeweller-mkt-card-table">
            <tbody>
              <tr>
                <th scope="row">Logo</th>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    {cardDraft.logo_url.trim() !== '' ? (
                      <img
                        src={cardDraft.logo_url.trim()}
                        alt=""
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: 'contain',
                          borderRadius: 12,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--veil)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No logo yet</span>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={disableActions}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadLogo(f)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={disableActions}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoBusy ? 'Uploading…' : 'Upload image'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                    JPEG, PNG, or WebP · max 2 MB. Or paste a hosted URL below.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Logo URL</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      value={cardDraft.logo_url}
                      onChange={(e) => setCardDraft((p) => ({ ...p, logo_url: e.target.value }))}
                      placeholder="Set automatically after upload, or paste https://…"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Credibility score</th>
                <td style={{ fontWeight: 700 }}>
                  {cardDraft.credibility_score.trim() === ''
                    ? 'Not set — assigned by Cridora admin'
                    : `${cardDraft.credibility_score.trim()} / 100 (admin only)`}
                </td>
              </tr>
              <tr>
                <th scope="row">Minimum redeemable (g)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.minimum_redeemable_grams}
                      onChange={(e) => setCardDraft((p) => ({ ...p, minimum_redeemable_grams: e.target.value }))}
                      placeholder="e.g. 0.25"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Same-store making benefit</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      value={cardDraft.same_store_mc_benefit}
                      onChange={(e) => setCardDraft((p) => ({ ...p, same_store_mc_benefit: e.target.value }))}
                      placeholder="e.g. 0% MC same store"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Active users (display)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="numeric"
                      value={cardDraft.metric_active_users}
                      onChange={(e) => setCardDraft((p) => ({ ...p, metric_active_users: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Total redeemed gold (g)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.metric_total_redeemed_gold_grams}
                      onChange={(e) =>
                        setCardDraft((p) => ({ ...p, metric_total_redeemed_gold_grams: e.target.value }))
                      }
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Years active (display)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.metric_years_active}
                      onChange={(e) => setCardDraft((p) => ({ ...p, metric_years_active: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="jeweller-mkt-feature-tags">
            <div className="jeweller-mkt-feature-tags__head">
              <h3 className="jeweller-mkt-feature-tags__title">Marketplace highlights</h3>
              <p className="jeweller-mkt-feature-tags__hint">
                Toggle the badges shoppers see on your card. Only enable what you actively offer.
              </p>
            </div>
            <div className="jeweller-mkt-feature-tags__grid" role="group" aria-label="Marketplace feature tags">
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_instant_redemption}
                  onChange={(e) => setCardDraft((p) => ({ ...p, feat_instant_redemption: e.target.checked }))}
                />
                <span>
                  Instant redemption
                  <small>Fast redemption pathway where your process supports it.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_zero_mc_same_store}
                  onChange={(e) => setCardDraft((p) => ({ ...p, feat_zero_mc_same_store: e.target.checked }))}
                />
                <span>
                  0% MC (same store)
                  <small>No making charge when customers redeem with you in-store.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_loan_available}
                  onChange={(e) => setCardDraft((p) => ({ ...p, feat_loan_available: e.target.checked }))}
                />
                <span>
                  Loan available
                  <small>Gold-backed or partner lending you disclose.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_goldnest_available}
                  onChange={(e) => setCardDraft((p) => ({ ...p, feat_goldnest_available: e.target.checked }))}
                />
                <span>
                  GoldNest
                  <small>Vault / fractional savings programme you participate in.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_emergency_funds}
                  onChange={(e) => setCardDraft((p) => ({ ...p, feat_emergency_funds: e.target.checked }))}
                />
                <span>
                  Emergency funds
                  <small>Liquidity or advance options you disclose to verified customers.</small>
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={disableActions}
            onClick={() => void saveMarketplaceCard()}
            style={{ marginTop: '1rem' }}
          >
            Save marketplace card
          </button>
        </div>
      </details>

      <details className="jeweller-mkt-acc card" open>
        <summary>Add catalogue SKU</summary>
        <div className="jeweller-mkt-acc__body">
          <p className="dash-coming__text" style={{ marginTop: 0 }}>
            BIS 916 (22K) only. Making can be fixed ₹/g or percent of gold metal value. Add a product photo (upload or URL)
            before submitting.
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

          <table className="admin-user-table jeweller-mkt-sku-table">
            <tbody>
              <tr>
                <th scope="row">Product photo</th>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    {form.image_url.trim() !== '' ? (
                      <img
                        src={form.image_url.trim()}
                        alt=""
                        style={{
                          width: 88,
                          height: 88,
                          objectFit: 'cover',
                          borderRadius: 12,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--veil)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No image yet</span>
                    )}
                    <input
                      ref={skuImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={disableActions}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadProductImage(f)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={disableActions}
                      onClick={() => skuImageInputRef.current?.click()}
                    >
                      {productImageBusy ? 'Uploading…' : 'Upload photo'}
                    </button>
                  </div>
                  <label className="field" style={{ marginTop: '0.65rem' }}>
                    <span>Or image URL</span>
                    <input
                      value={form.image_url}
                      onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://…"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Product name</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Category</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      list="jeweller-mp-categories"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Ornaments, chains, coins…"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Gold weight (g)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={form.gold_weight_grams}
                      onChange={(e) => setForm((f) => ({ ...f, gold_weight_grams: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Making charge type</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <select
                      value={form.making_charge_mode}
                      onChange={(e) => setForm((f) => ({ ...f, making_charge_mode: e.target.value }))}
                    >
                      <option value={MAKING_FIXED_PER_GRAM}>Fixed (₹ per gram of gold)</option>
                      <option value={MAKING_PERCENT_OF_METAL}>Percentage of gold metal value</option>
                    </select>
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">{form.making_charge_mode === MAKING_PERCENT_OF_METAL ? 'Making (% metal)' : 'Making (₹/g)'}</th>
                <td>
                  {form.making_charge_mode === MAKING_PERCENT_OF_METAL ? (
                    <label className="field" style={{ margin: 0 }}>
                      <input
                        inputMode="decimal"
                        value={form.making_charge_percent}
                        onChange={(e) => setForm((f) => ({ ...f, making_charge_percent: e.target.value }))}
                        placeholder="e.g. 8.5"
                      />
                    </label>
                  ) : (
                    <label className="field" style={{ margin: 0 }}>
                      <input
                        inputMode="decimal"
                        value={form.making_charge_per_gram}
                        onChange={(e) => setForm((f) => ({ ...f, making_charge_per_gram: e.target.value }))}
                      />
                    </label>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Purity</th>
                <td style={{ fontWeight: 700, color: 'var(--gold-light)' }}>BIS 916 (22K) only</td>
              </tr>
              <tr>
                <th scope="row">Same-store benefit note</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <textarea
                      className="dash-textarea"
                      rows={2}
                      value={form.same_store_benefit_note}
                      onChange={(e) => setForm((f) => ({ ...f, same_store_benefit_note: e.target.value }))}
                      placeholder="e.g. 0% MC when you redeem ornaments with us"
                      style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Pricing mode</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <select value={form.pricing_mode} onChange={(e) => setForm((f) => ({ ...f, pricing_mode: e.target.value }))}>
                      <option value="spot_markup">Spot base + markup</option>
                      <option value="manual_rate">Manual gold ₹/g</option>
                    </select>
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">{form.pricing_mode === 'spot_markup' ? 'SKU markup override (%)' : 'Manual gold (₹/g)'}</th>
                <td>
                  {form.pricing_mode === 'spot_markup' ? (
                    <label className="field" style={{ margin: 0 }}>
                      <input
                        inputMode="decimal"
                        value={form.jeweller_markup_percent}
                        onChange={(e) => setForm((f) => ({ ...f, jeweller_markup_percent: e.target.value }))}
                        placeholder="Blank uses default from Rates & schemes"
                      />
                    </label>
                  ) : (
                    <label className="field" style={{ margin: 0 }}>
                      <input
                        inputMode="decimal"
                        value={form.manual_gold_rate_inr_per_gram}
                        onChange={(e) => setForm((f) => ({ ...f, manual_gold_rate_inr_per_gram: e.target.value }))}
                      />
                    </label>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Display rating</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input inputMode="decimal" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Cross-jeweller redemption</th>
                <td>
                  <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={form.is_x_redeem}
                      onChange={(e) => setForm((f) => ({ ...f, is_x_redeem: e.target.checked }))}
                    />
                    <span>X-redeem enabled</span>
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Published</th>
                <td>
                  <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                    />
                    <span>Eligible after approval</span>
                  </label>
                </td>
              </tr>
            </tbody>
          </table>

          <details className="jeweller-mkt-subacc">
            <summary>Stone details (optional)</summary>
            <div className="jeweller-mkt-subacc__body">
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.stone_included}
                  onChange={(e) => setForm((f) => ({ ...f, stone_included: e.target.checked }))}
                />
                <span>Stone included in piece</span>
              </label>
              {form.stone_included ? (
                <table className="admin-user-table jeweller-mkt-sku-table" style={{ marginTop: '1rem' }}>
                  <tbody>
                    <tr>
                      <th scope="row">Stone type</th>
                      <td>
                        <label className="field" style={{ margin: 0 }}>
                          <input value={form.stone_type} onChange={(e) => setForm((f) => ({ ...f, stone_type: e.target.value }))} />
                        </label>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Stone weight (g)</th>
                      <td>
                        <label className="field" style={{ margin: 0 }}>
                          <input
                            inputMode="decimal"
                            value={form.stone_weight_grams}
                            onChange={(e) => setForm((f) => ({ ...f, stone_weight_grams: e.target.value }))}
                          />
                        </label>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Stone cost (₹)</th>
                      <td>
                        <label className="field" style={{ margin: 0 }}>
                          <input
                            inputMode="decimal"
                            value={form.stone_cost_inr}
                            onChange={(e) => setForm((f) => ({ ...f, stone_cost_inr: e.target.value }))}
                          />
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : null}
            </div>
          </details>

          <button
            type="button"
            className="btn btn-primary"
            disabled={disableActions}
            onClick={() => void addProduct()}
            style={{ marginTop: '1rem' }}
          >
            Submit SKU for review
          </button>
        </div>
      </details>

      <details className="jeweller-mkt-acc card" open>
        <summary>Your catalogue</summary>
        <div className="jeweller-mkt-acc__body">
          <div className="dash-table-scroll card" style={{ padding: 0 }}>
            <table className="admin-user-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th scope="col">Photo</th>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Making</th>
                  <th scope="col">Status</th>
                  <th scope="col">Metal ₹/g</th>
                  <th scope="col">Sellback ₹/g</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      No SKUs yet — approved items appear on the public marketplace.
                    </td>
                  </tr>
                ) : (
                  products.map((row) => (
                    <tr key={String(row.id)}>
                      <td>
                        {String(row.image_url ?? '').trim() !== '' ? (
                          <img
                            src={String(row.image_url)}
                            alt=""
                            style={{
                              width: 44,
                              height: 44,
                              objectFit: 'cover',
                              borderRadius: 8,
                              border: '1px solid var(--border-soft)',
                              verticalAlign: 'middle',
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost kyb-btn-sm"
                            disabled={disableActions}
                            onClick={() => {
                              setPendingCatalogProductId(Number(row.id))
                              catalogImageInputRef.current?.click()
                            }}
                          >
                            Photo
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost kyb-btn-sm"
                            disabled={disableActions}
                            onClick={() => void removeProduct(Number(row.id))}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  )
}
