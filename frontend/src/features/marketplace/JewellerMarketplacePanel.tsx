import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authFetch, authUpload } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'
import { default916PurityId } from '@/features/jeweller/catalogPuritySpot'
import {
  fetchMarketplaceCatalogMeta,
  type MarketplaceCatalogMetaDTO,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  INITIAL_SKU_FORM,
  buildSkuPayload,
  rowToEditForm,
  type ProductRow,
  type SkuFormState,
} from '@/features/marketplace/jewellerSkuForm'
import { JewellerSkuFormTable } from '@/features/marketplace/JewellerSkuFormTable'

const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024

export function JewellerMarketplacePanel() {
  const { user } = useAuth()
  const skuImageInputRef = useRef<HTMLInputElement>(null)
  const catalogImageInputRef = useRef<HTMLInputElement>(null)
  const editSkuImageInputRef = useRef<HTMLInputElement>(null)
  const catalogDefaultsDoneRef = useRef(false)
  const editSectionRef = useRef<HTMLDetailsElement>(null)
  const editingProductIdRef = useRef<number | null>(null)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [catalogMeta, setCatalogMeta] = useState<MarketplaceCatalogMetaDTO | null>(null)
  const [profileMetalIds, setProfileMetalIds] = useState<number[]>([])
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [productImageBusy, setProductImageBusy] = useState(false)
  const [pendingCatalogProductId, setPendingCatalogProductId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [form, setForm] = useState<SkuFormState>(() => ({ ...INITIAL_SKU_FORM }))
  const [editForm, setEditForm] = useState<SkuFormState>(() => ({ ...INITIAL_SKU_FORM }))

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
  }, [])

  useEffect(() => {
    void refreshPricingProfileMetals()
  }, [refreshPricingProfileMetals])

  useEffect(() => {
    const onSaved = () => void refreshPricingProfileMetals()
    window.addEventListener('jeweller-selling-purities-saved', onSaved)
    return () => window.removeEventListener('jeweller-selling-purities-saved', onSaved)
  }, [refreshPricingProfileMetals])

  useEffect(() => {
    if (!catalogMeta || catalogDefaultsDoneRef.current) return
    catalogDefaultsDoneRef.current = true
    const defaultPurity = default916PurityId(catalogMeta.metal_purities)
    const cat0 = catalogMeta.product_categories[0]
    setForm((f) => ({
      ...f,
      product_category_id: cat0 ? String(cat0.id) : '',
      metal_purity_id: defaultPurity != null ? String(defaultPurity) : f.metal_purity_id,
    }))
  }, [catalogMeta])

  const skuMetalOptions = useMemo(() => {
    if (!catalogMeta) return []
    const metals = catalogMeta.metal_purities
    if (profileMetalIds.length > 0) {
      const allow = new Set(profileMetalIds)
      return metals.filter((m) => allow.has(m.id))
    }
    const defaultId = default916PurityId(metals)
    if (defaultId == null) return []
    return metals.filter((m) => m.id === defaultId)
  }, [catalogMeta, profileMetalIds])

  const editSkuMetalOptions = useMemo(() => {
    if (editingId == null || !catalogMeta) return skuMetalOptions
    const row = products.find((p) => Number(p.id) === editingId)
    const rawMp = row?.metal_purity_id
    if (rawMp == null) return skuMetalOptions
    const mpNum = Number(rawMp)
    if (!Number.isFinite(mpNum)) return skuMetalOptions
    if (skuMetalOptions.some((m) => m.id === mpNum)) return skuMetalOptions
    const extra = catalogMeta.metal_purities.find((m) => m.id === mpNum)
    return extra ? [...skuMetalOptions, extra] : skuMetalOptions
  }, [catalogMeta, editingId, products, skuMetalOptions])

  useEffect(() => {
    editingProductIdRef.current = editingId
  }, [editingId])

  useEffect(() => {
    if (editingId == null) return
    editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editingId])

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
    const editTarget = editingProductIdRef.current
    if (url) {
      if (productId == null) {
      setForm((f) => ({ ...f, image_url: url }))
      } else if (editTarget != null && productId === editTarget) {
        setEditForm((f) => ({ ...f, image_url: url }))
      }
    }
    await refresh()
    flashSuccess(
      productId != null ? 'Product photo saved.' : 'Photo uploaded — finish SKU fields and add to catalogue.',
    )
  }

  const addProduct = async () => {
    setBusy(true)
    setFormError('')
    const built = buildSkuPayload(form)
    if (!built.ok) {
      setBusy(false)
      setSuccessMsg('')
      setFormError(built.error)
      return
    }

    const res = await authFetch('/api/v1/jeweller/marketplace/products/', {
      method: 'POST',
      jsonBody: built.body,
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

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ ...INITIAL_SKU_FORM })
  }

  const saveEdit = async () => {
    const id = editingId
    if (id == null) return
    setBusy(true)
    setFormError('')
    const built = buildSkuPayload(editForm)
    if (!built.ok) {
      setBusy(false)
      setSuccessMsg('')
      setFormError(built.error)
      return
    }
    const res = await authFetch(`/api/v1/jeweller/marketplace/products/${id}/`, {
      method: 'PATCH',
      jsonBody: built.body,
    })
    setBusy(false)
    if (!res.ok) {
      setSuccessMsg('')
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    cancelEdit()
    await refresh()
    flashSuccess('SKU updated.')
  }

  const beginEdit = (row: ProductRow) => {
    setFormError('')
    setEditingId(Number(row.id))
    setEditForm(rowToEditForm(row))
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
    if (editingId === id) {
      cancelEdit()
    }
    await refresh()
    flashSuccess('SKU removed from catalogue.')
  }

  const disableActions = busy || productImageBusy

  return (
    <div className="dash-panel-max jeweller-mkt">
      <p className="dash-panel-lead">
        Verified jewellers publish SKUs directly (no admin product approval). Set which purities you sell under{' '}
        <Link to="/dashboard/jeweller?section=prof_more">Profile · Shop &amp; business</Link>, then list SKUs with category,
        purity, weight, and stock. Configure <strong>rates &amp; sellback</strong> under{' '}
        <Link to="/dashboard/jeweller?section=mkt_policy">Marketplace · Rates &amp; schemes</Link>.
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

      {profileMetalIds.length === 0 && catalogMeta ? (
        <p className="form-error" role="status" style={{ marginBottom: '1rem' }}>
          Choose selling purities under{' '}
          <Link to="/dashboard/jeweller?section=prof_more">Profile · Shop &amp; business</Link> before adding catalogue SKUs.
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
        <summary>Add catalogue SKU</summary>
        <div className="jeweller-mkt-acc__body">
          <p className="dash-coming__text" style={{ marginTop: 0 }}>
            Choose category and hallmark purity from the lists admin maintains. Metal quotes still use your storefront&apos;s 22K
            board ₹/g; lower purity adjusts fine-gold value automatically. Add a photo (upload or URL) before publishing.
          </p>

          <JewellerSkuFormTable
            form={form}
            setForm={setForm}
            catalogMeta={catalogMeta}
            skuMetalOptions={skuMetalOptions}
            disableActions={disableActions}
            productImageBusy={productImageBusy}
            skuImageInputRef={skuImageInputRef}
            onUploadImage={(f) => void uploadProductImage(f)}
          />

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

      {editingId !== null ? (
        <details ref={editSectionRef} className="jeweller-mkt-acc card" open style={{ marginBottom: '1rem' }}>
          <summary>Edit catalogue SKU</summary>
          <div className="jeweller-mkt-acc__body">
            <p className="dash-coming__text" style={{ marginTop: 0 }}>
              Update stock, pricing, and other fields, then save. Photo upload sets this SKU&apos;s listing image.
            </p>
            <JewellerSkuFormTable
              form={editForm}
              setForm={setEditForm}
              catalogMeta={catalogMeta}
              skuMetalOptions={editSkuMetalOptions}
              disableActions={disableActions}
              productImageBusy={productImageBusy}
              skuImageInputRef={editSkuImageInputRef}
              onUploadImage={(f) => void uploadProductImage(f, editingId)}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary" disabled={disableActions} onClick={() => void saveEdit()}>
                Save changes
              </button>
              <button type="button" className="btn btn-ghost" disabled={disableActions} onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        </details>
      ) : null}

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
                            onClick={() => beginEdit(row)}
                          >
                            Edit
                          </button>
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
