import type { Dispatch, RefObject, SetStateAction } from 'react'
import { MAKING_FIXED_PER_GRAM, MAKING_PERCENT_OF_METAL } from '@/lib/marketplacePricing'
import type { MarketplaceCatalogMetaDTO, CatalogMetalPurityDTO } from '@/lib/marketplaceApi'
import type { SkuFormState } from '@/features/marketplace/jewellerSkuForm'

type JewellerSkuFormTableProps = {
  form: SkuFormState
  setForm: Dispatch<SetStateAction<SkuFormState>>
  catalogMeta: MarketplaceCatalogMetaDTO | null
  skuMetalOptions: CatalogMetalPurityDTO[]
  disableActions: boolean
  productImageBusy: boolean
  skuImageInputRef: RefObject<HTMLInputElement | null>
  onUploadImage: (file: File) => void
}

export function JewellerSkuFormTable({
  form,
  setForm,
  catalogMeta,
  skuMetalOptions,
  disableActions,
  productImageBusy,
  skuImageInputRef,
  onUploadImage,
}: JewellerSkuFormTableProps) {
  return (
    <>
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
                ref={skuImageInputRef as RefObject<HTMLInputElement>}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={disableActions}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) onUploadImage(f)
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
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://…"
              />
            </label>
          </td>
        </tr>
        <tr>
          <th scope="row">Product name</th>
          <td>
            <label className="field" style={{ margin: 0 }}>
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
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
                onChange={(e) => setForm((prev) => ({ ...prev, product_category_id: e.target.value }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, metal_purity_id: e.target.value }))}
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
              Enable additional purities in <strong>Metal purities offered</strong> above. Default is BIS 916 when none are
              selected.
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
                onChange={(e) => setForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, gold_weight_grams: e.target.value }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, making_charge_mode: e.target.value }))}
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
                  onChange={(e) => setForm((prev) => ({ ...prev, making_charge_percent: e.target.value }))}
                  placeholder="e.g. 8.5"
                />
              </label>
            ) : (
              <label className="field" style={{ margin: 0 }}>
                <input
                  inputMode="decimal"
                  value={form.making_charge_per_gram}
                  onChange={(e) => setForm((prev) => ({ ...prev, making_charge_per_gram: e.target.value }))}
                />
              </label>
            )}
          </td>
        </tr>
        <tr>
          <th scope="row">
            {form.making_charge_mode === MAKING_PERCENT_OF_METAL ? 'Same-shop making (% metal)' : 'Same-shop making (₹/g)'}
          </th>
          <td>
            <label className="field" style={{ margin: 0 }}>
              {form.making_charge_mode === MAKING_PERCENT_OF_METAL ? (
                <input
                  inputMode="decimal"
                  value={form.same_store_making_charge_percent}
                  onChange={(e) => setForm((prev) => ({ ...prev, same_store_making_charge_percent: e.target.value }))}
                  placeholder="Leave blank to use cross purchase rate for everyone"
                />
              ) : (
                <input
                  inputMode="decimal"
                  value={form.same_store_making_charge_per_gram}
                  onChange={(e) => setForm((prev) => ({ ...prev, same_store_making_charge_per_gram: e.target.value }))}
                  placeholder="Leave blank to use cross purchase rate for everyone"
                />
              )}
            </label>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Customers whose default jeweller is you pay this making charge; everyone else pays the cross purchase rate above.
            </p>
          </td>
        </tr>
        <tr>
          <th scope="row">Pricing mode</th>
          <td>
            <label className="field" style={{ margin: 0 }}>
              <select
                value={form.pricing_mode}
                onChange={(e) => setForm((prev) => ({ ...prev, pricing_mode: e.target.value }))}
              >
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
                  onChange={(e) => setForm((prev) => ({ ...prev, jeweller_markup_percent: e.target.value }))}
                  placeholder="Blank uses default from Rates & schemes"
                />
              </label>
            ) : (
              <label className="field" style={{ margin: 0 }}>
                <input
                  inputMode="decimal"
                  value={form.manual_gold_rate_inr_per_gram}
                  onChange={(e) => setForm((prev) => ({ ...prev, manual_gold_rate_inr_per_gram: e.target.value }))}
                />
              </label>
            )}
          </td>
        </tr>
        <tr>
          <th scope="row">Cross-jeweller redemption</th>
          <td>
            <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.is_x_redeem}
                onChange={(e) => setForm((prev) => ({ ...prev, is_x_redeem: e.target.checked }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))}
              />
              <span>Show on marketplace when verified</span>
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
            onChange={(e) => setForm((prev) => ({ ...prev, stone_included: e.target.checked }))}
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
                    <input
                      value={form.stone_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, stone_type: e.target.value }))}
                    />
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
                      onChange={(e) => setForm((prev) => ({ ...prev, stone_weight_grams: e.target.value }))}
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
                      onChange={(e) => setForm((prev) => ({ ...prev, stone_cost_inr: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </div>
    </details>
  </>
  )
}
