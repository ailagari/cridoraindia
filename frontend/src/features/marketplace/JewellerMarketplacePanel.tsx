import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authFetch, authUpload } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'
import {
  fetchMarketplaceCatalogMeta,
  type MarketplaceCatalogMetaDTO,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'
import { numOrZero } from '@/features/marketplace/jewellerMarketplaceShared'

const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024

type ProductRow = Record<string, unknown>

export function JewellerMarketplacePanel() {
  const { user } = useAuth()
  const skuImageInputRef = useRef<HTMLInputElement>(null)
  const catalogImageInputRef = useRef<HTMLInputElement>(null)
  const catalogDefaultsDoneRef = useRef(false)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [catalogMeta, setCatalogMeta] = useState<MarketplaceCatalogMetaDTO | null>(null)
  const [profileMetalIds, setProfileMetalIds] = useState<number[]>([])
  const [purityDraftIds, setPurityDraftIds] = useState<number[]>([])
  const [purityOfferBusy, setPurityOfferBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [productImageBusy, setProductImageBusy] = useState(false)
  const [pendingCatalogProductId, setPendingCatalogProductId] = useState<number | null>(null)

  const [form, setForm] = useState({
    name: '',
    product_category_id: '',
    metal_purity_id: '',
    stock_quantity: '1',
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
    same_store_making_charge_percent: '',
    same_store_making_charge_per_gram: '',
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
    const ls = await authFetch('/api/v1/jeweller/marketplace/products/')
    if (!ls.ok) {
      const j = await ls.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load products.')
      return
    }
    const lJson = (await ls.json()) as { results: ProductRow[] }
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

  useEffect(() => {
    void (async () => {
      const m = await fetchMarketplaceCatalogMeta()
      setCatalogMeta(m)
    })()
  }, [])

  const refreshPricingProfileMetals = useCallback(async () => {
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/')
    if (!res.ok) return
    const j = (await res.json()) as { metal_purities_offered?: { id: number }[] }
    const ids = (j.metal_purities_offered ?? []).map((x) => x.id)
    setProfileMetalIds(ids)
    const bisId = catalogMeta?.metal_purities.find((x) => x.slug === 'bis916')?.id
    if (ids.length > 0) {
      setPurityDraftIds(ids)
    } else if (bisId != null) {
      setPurityDraftIds([bisId])
    }
  }, [catalogMeta])

  useEffect(() => {
    void refreshPricingProfileMetals()
  }, [refreshPricingProfileMetals])

  useEffect(() => {
    if (!catalogMeta || catalogDefaultsDoneRef.current) return
    catalogDefaultsDoneRef.current = true
    const bis = catalogMeta.metal_purities.find((x) => x.slug === 'bis916')
    const cat0 = catalogMeta.product_categories[0]
    setForm((f) => ({
      ...f,
      product_category_id: cat0 ? String(cat0.id) : '',
      metal_purity_id: bis ? String(bis.id) : f.metal_purity_id,
    }))
  }, [catalogMeta])

  const skuMetalOptions = useMemo(() => {
    if (!catalogMeta) return []
    const metals = catalogMeta.metal_purities
    if (profileMetalIds.length > 0) {
      const allow = new Set(profileMetalIds)
      return metals.filter((m) => allow.has(m.id))
    }
    return metals.filter((m) => m.slug === 'bis916')
  }, [catalogMeta, profileMetalIds])

  const saveMetalPuritiesOffered = async () => {
    setPurityOfferBusy(true)
    setFormError('')
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: { metal_purity_ids: purityDraftIds },
    })
    setPurityOfferBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuccessMsg('')
      setFormError(JSON.stringify(j))
      return
    }
    await refreshPricingProfileMetals()
    flashSuccess('Metal purities saved for your storefront.')
  }

  const togglePurityDraft = (id: number, checked: boolean) => {
    setPurityDraftIds((prev) => {
      if (checked) return [...new Set([...prev, id])].sort((a, b) => a - b)
      return prev.filter((x) => x !== id)
    })
  }

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
      productId != null ? 'Product photo saved.' : 'Photo uploaded — finish SKU fields and add to catalogue.',
    )
  }

  const addProduct = async () => {
    setBusy(true)
    setFormError('')
    const pcId = Number.parseInt(form.product_category_id, 10)
    const mpId = Number.parseInt(form.metal_purity_id, 10)
    const stockN = Number.parseInt(form.stock_quantity, 10)
    if (!Number.isFinite(pcId) || pcId < 1) {
      setBusy(false)
      setSuccessMsg('')
      setFormError('Choose a category from the dropdown.')
      return
    }
    if (!Number.isFinite(mpId) || mpId < 1) {
      setBusy(false)
      setSuccessMsg('')
      setFormError('Choose a metal purity.')
      return
    }
    if (!Number.isFinite(stockN) || stockN < 0) {
      setBusy(false)
      setSuccessMsg('')
      setFormError('Stock quantity must be a whole number (0 or more).')
      return
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      product_category: pcId,
      metal_purity: mpId,
      stock_quantity: stockN,
      gold_weight_grams: numOrZero(form.gold_weight_grams),
      making_charge_mode: form.making_charge_mode,
      image_url: form.image_url.trim(),
      pricing_mode: form.pricing_mode,
      is_x_redeem: form.is_x_redeem,
      is_published: form.is_published,
      rating: numOrZero(form.rating),
      stone_included: form.stone_included,
      stone_type: form.stone_type.trim(),
    }
    if (form.making_charge_mode === MAKING_PERCENT_OF_METAL) {
      body.making_charge_percent = numOrZero(form.making_charge_percent)
      body.making_charge_per_gram = '0'
      const ss = form.same_store_making_charge_percent.trim()
      body.same_store_making_charge_percent = ss !== '' ? numOrZero(ss) : null
      body.same_store_making_charge_per_gram = null
    } else {
      body.making_charge_per_gram = numOrZero(form.making_charge_per_gram)
      body.making_charge_percent = null
      const ss = form.same_store_making_charge_per_gram.trim()
      body.same_store_making_charge_per_gram = ss !== '' ? numOrZero(ss) : null
      body.same_store_making_charge_percent = null
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
      same_store_making_charge_percent: '',
      same_store_making_charge_per_gram: '',
      stock_quantity: '1',
    }))
    await refresh()
    flashSuccess('SKU added to your catalogue.')
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

  const disableActions = busy || productImageBusy

  return (
    <div className="dash-panel-max jeweller-mkt">
      <p className="dash-panel-lead">
        Verified jewellers publish SKUs directly (no admin product approval). Categories and hallmark purities are maintained in Django admin; tick which purities you stock below, then list SKUs with weight, purity, and stock.
        Configure <strong>rates &amp; sellback</strong> under{' '}
        <Link to="/dashboard/jeweller?section=mkt_policy">Marketplace · Rates &amp; schemes</Link>. Shop card under{' '}
        <Link to="/dashboard/jeweller?section=prof_more">Profile · Shop &amp; business</Link>.
      </p>

      {user?.user_type === 'jeweller' && user.kyc_status !== 'verified' ? (
        <p className="form-error" role="status">
          KYB must be verified before you can upload catalogue SKUs or photos.
        </p>
      ) : null}

      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {successMsg ? (
        <p className="admin-dash-form-success admin-dash-form-success--block" role="status">
          {successMsg}
        </p>
      ) : null}

      <details className="jeweller-mkt-acc card" style={{ marginBottom: '1rem' }} open>
        <summary>Metal purities offered at your storefront</summary>
        <div className="jeweller-mkt-acc__body">
          <p style={{ marginTop: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Admin defines hallmark options (Django admin → Marketplace → Metal purities). Customers only see purities you enable here.
            Leave only <strong>BIS 916</strong> checked if you sell 22K only.
          </p>
          {!catalogMeta ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading purity catalogue…</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem 1rem', alignItems: 'center' }}>
              {catalogMeta.metal_purities.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={purityDraftIds.includes(m.id)}
                    disabled={purityOfferBusy || disableActions}
                    onChange={(e) => togglePurityDraft(m.id, e.target.checked)}
                  />
                  {m.label}
                </label>
              ))}
              <button
                type="button"
                className="btn btn-ghost kyb-btn-sm"
                disabled={purityOfferBusy || disableActions}
                onClick={() => void saveMetalPuritiesOffered()}
              >
                {purityOfferBusy ? 'Saving…' : 'Save purities'}
              </button>
            </div>
          )}
        </div>
      </details>

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
        <summary>Add catalogue SKU</summary>
        <div className="jeweller-mkt-acc__body">
          <p className="dash-coming__text" style={{ marginTop: 0 }}>
            Choose category and hallmark purity from the lists admin maintains. Metal quotes still use your storefront&apos;s 22K
            board ₹/g; lower purity adjusts fine-gold value automatically. Add a photo (upload or URL) before publishing.
          </p>

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
                    <select
                      style={{ width: '100%', maxWidth: '100%' }}
                      value={form.product_category_id}
                      onChange={(e) => setForm((f) => ({ ...f, product_category_id: e.target.value }))}
                      disabled={!catalogMeta}
                    >
                      {catalogMeta?.product_categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Metal purity</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <select
                      style={{ width: '100%', maxWidth: '100%' }}
                      value={form.metal_purity_id}
                      onChange={(e) => setForm((f) => ({ ...f, metal_purity_id: e.target.value }))}
                      disabled={skuMetalOptions.length === 0}
                    >
                      {skuMetalOptions.length === 0 ? (
                        <option value="">Loading purities…</option>
                      ) : (
                        skuMetalOptions.map((m) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Enable additional purities in <strong>Metal purities offered</strong> above. Default is BIS 916 when none are selected.
                  </p>
                </td>
              </tr>
              <tr>
                <th scope="row">Stock (units)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="numeric"
                      value={form.stock_quantity}
                      onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                      placeholder="e.g. 12"
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
                <th scope="row">
                  {form.making_charge_mode === MAKING_PERCENT_OF_METAL
                    ? 'Same-shop making (% metal)'
                    : 'Same-shop making (₹/g)'}
                </th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    {form.making_charge_mode === MAKING_PERCENT_OF_METAL ? (
                      <input
                        inputMode="decimal"
                        value={form.same_store_making_charge_percent}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, same_store_making_charge_percent: e.target.value }))
                        }
                        placeholder="Leave blank to use cross purchase rate for everyone"
                      />
                    ) : (
                      <input
                        inputMode="decimal"
                        value={form.same_store_making_charge_per_gram}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, same_store_making_charge_per_gram: e.target.value }))
                        }
                        placeholder="Leave blank to use cross purchase rate for everyone"
                      />
                    )}
                  </label>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Customers whose default jeweller is you pay this making charge; everyone else pays the cross purchase
                    rate above.
                  </p>
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
            Add SKU to catalogue
          </button>
        </div>
      </details>

      <details className="jeweller-mkt-acc card" open>
        <summary>Your catalogue</summary>
        <div className="jeweller-mkt-acc__body">
          <div className="dash-table-scroll card" style={{ padding: 0 }}>
            <table className="admin-user-table" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th scope="col">Photo</th>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Purity</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Making</th>
                  <th scope="col">Same-shop MC</th>
                  <th scope="col">Pub.</th>
                  <th scope="col">Metal ₹/g</th>
                  <th scope="col">Sellback ₹/g</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      No SKUs yet — published listings appear on the public marketplace for verified jewellers.
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
                      <td style={{ fontSize: '0.72rem', maxWidth: 120 }}>
                        {String(row.metal_purity_label ?? '').trim() ||
                          String(row.metal_purity_slug ?? '').trim() ||
                          '—'}
                      </td>
                      <td className="tabular">{String(row.stock_quantity ?? '')}</td>
                      <td className="tabular">{String(row.gold_weight_grams ?? '')}</td>
                      <td className="tabular">
                        {String(row.making_charge_mode ?? MAKING_FIXED_PER_GRAM) === MAKING_PERCENT_OF_METAL
                          ? `${String(row.making_charge_percent ?? '')}% metal`
                          : String(row.making_charge_per_gram ?? '')}
                      </td>
                      <td className="tabular">
                        {String(row.making_charge_mode ?? MAKING_FIXED_PER_GRAM) === MAKING_PERCENT_OF_METAL ? (
                          String(row.same_store_making_charge_percent ?? '').trim() !== '' ? (
                            `${String(row.same_store_making_charge_percent)}% metal`
                          ) : (
                            '—'
                          )
                        ) : String(row.same_store_making_charge_per_gram ?? '').trim() !== '' ? (
                          `₹${String(row.same_store_making_charge_per_gram)}/g`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tabular">{row.is_published ? 'yes' : 'no'}</td>
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
