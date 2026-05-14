import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { authFetch } from '@/lib/api'
import { fetchGoldTicker, type GoldTickerPayload } from '@/lib/marketplaceApi'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  formatInr,
  inferSellbackMode,
  numOrZero,
  parseN,
  previewIndicativeBuyback,
  type SellbackMode,
} from '@/features/marketplace/jewellerMarketplaceShared'

type ProfileApi = Record<string, unknown>

export function JewellerRatesSchemesPanel() {
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [jewellerRatePolicyAsOf, setJewellerRatePolicyAsOf] = useState('')
  const [sellbackDeductionMode, setSellbackDeductionMode] = useState<SellbackMode>('percent')
  const [ticker, setTicker] = useState<GoldTickerPayload | null>(null)

  const [ratesDraft, setRatesDraft] = useState({
    gold_rate_source: 'live_cridora' as 'live_cridora' | 'manual',
    gold_rate_external_api_url: '',
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
    golden_scheme_enabled: false,
    golden_scheme_duration_months: '',
    golden_scheme_min_monthly_inr: '',
    golden_scheme_lock_in_note: '',
    golden_scheme_benefits: '',
    golden_scheme_rate_application_note: '',
  })

  const refresh = useCallback(async () => {
    setLoadError('')
    const [pr, tk] = await Promise.all([
      authFetch('/api/v1/jeweller/marketplace/profile/'),
      fetchGoldTicker(),
    ])
    setTicker(tk)
    if (!pr.ok) {
      const j = await pr.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load pricing profile.')
      return
    }
    const pJson = (await pr.json()) as ProfileApi
    setJewellerRatePolicyAsOf(String(pJson.jeweller_metal_rate_effective_updated_at ?? ''))
    setRatesDraft({
      gold_rate_source: pJson.gold_rate_source === 'manual' ? 'manual' : 'live_cridora',
      gold_rate_external_api_url: String(pJson.gold_rate_external_api_url ?? ''),
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
      golden_scheme_enabled: Boolean(pJson.golden_scheme_enabled),
      golden_scheme_duration_months:
        pJson.golden_scheme_duration_months != null && String(pJson.golden_scheme_duration_months) !== ''
          ? String(pJson.golden_scheme_duration_months)
          : '',
      golden_scheme_min_monthly_inr:
        pJson.golden_scheme_min_monthly_inr != null && String(pJson.golden_scheme_min_monthly_inr) !== ''
          ? String(pJson.golden_scheme_min_monthly_inr)
          : '',
      golden_scheme_lock_in_note: String(pJson.golden_scheme_lock_in_note ?? ''),
      golden_scheme_benefits: String(pJson.golden_scheme_benefits ?? ''),
      golden_scheme_rate_application_note: String(pJson.golden_scheme_rate_application_note ?? ''),
    })
    setSellbackDeductionMode(
      inferSellbackMode(
        String(pJson.sellback_deduction_percent ?? ''),
        String(pJson.sellback_fixed_inr_per_gram ?? ''),
      ),
    )
  }, [])

  const pollTicker = useCallback(async () => {
    if (busy) return
    setTicker(await fetchGoldTicker())
  }, [busy])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(pollTicker, LIVE_MARKETPLACE_EDITOR_POLL_MS, true)

  const saveRatesAndSchemes = async () => {
    setBusy(true)
    setFormError('')
    const sellbackPct =
      sellbackDeductionMode === 'percent' ? numOrZero(ratesDraft.sellback_deduction_percent) : '0'
    const sellbackFix =
      sellbackDeductionMode === 'fixed' ? numOrZero(ratesDraft.sellback_fixed_inr_per_gram) : '0'
    const durRaw = ratesDraft.golden_scheme_duration_months.trim()
    const durParsed = Number.parseInt(durRaw, 10)
    const durNum =
      durRaw === '' || Number.isNaN(durParsed) ? null : Math.max(0, Math.floor(durParsed))
    const minMonthlyRaw = ratesDraft.golden_scheme_min_monthly_inr.trim()
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: {
        gold_rate_source: ratesDraft.gold_rate_source,
        gold_rate_external_api_url: ratesDraft.gold_rate_external_api_url.trim(),
        manual_gold_rate_inr_per_gram:
          ratesDraft.gold_rate_source === 'manual' && ratesDraft.manual_gold_rate_inr_per_gram.trim() !== ''
            ? numOrZero(ratesDraft.manual_gold_rate_inr_per_gram)
            : null,
        live_markup_percent: numOrZero(ratesDraft.live_markup_percent),
        live_markup_inr_per_gram: numOrZero(ratesDraft.live_markup_inr_per_gram),
        default_gold_markup_percent: numOrZero(ratesDraft.default_gold_markup_percent),
        sellback_deduction_percent: sellbackPct,
        sellback_fixed_inr_per_gram: sellbackFix,
        gold_deposit_note: ratesDraft.gold_deposit_note.trim(),
        representative_making_charge_inr_per_gram: numOrZero(
          ratesDraft.representative_making_charge_inr_per_gram,
        ),
        buyback_headline_inr_per_gram:
          ratesDraft.buyback_headline_inr_per_gram.trim() === ''
            ? null
            : numOrZero(ratesDraft.buyback_headline_inr_per_gram),
        gold_deposit_yield_apr_percent: numOrZero(ratesDraft.gold_deposit_yield_apr_percent),
        gold_loan_interest_apr_percent: numOrZero(ratesDraft.gold_loan_interest_apr_percent),
        golden_scheme_enabled: ratesDraft.golden_scheme_enabled,
        golden_scheme_duration_months: durNum,
        golden_scheme_min_monthly_inr: minMonthlyRaw === '' ? null : numOrZero(minMonthlyRaw),
        golden_scheme_lock_in_note: ratesDraft.golden_scheme_lock_in_note.trim(),
        golden_scheme_benefits: ratesDraft.golden_scheme_benefits.trim(),
        golden_scheme_rate_application_note: ratesDraft.golden_scheme_rate_application_note.trim(),
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

  const platformBaseInr = useMemo(
    () => (ticker ? parseN(ticker.platform_base_inr_per_gram_22k) : 0),
    [ticker],
  )
  const reference22kInr = useMemo(
    () => (ticker ? parseN(ticker.reference_price_inr_per_gram_22k) : 0),
    [ticker],
  )
  const adminMarkupTicker = useMemo(() => (ticker ? parseN(ticker.admin_markup_percent) : 0), [ticker])

  const jewellerStore22k = useMemo(() => {
    if (ratesDraft.gold_rate_source === 'manual') {
      const m = parseN(ratesDraft.manual_gold_rate_inr_per_gram)
      return m > 0 ? m : platformBaseInr
    }
    const lp = parseN(ratesDraft.live_markup_percent)
    const lf = parseN(ratesDraft.live_markup_inr_per_gram)
    return platformBaseInr * (1 + lp / 100) + lf
  }, [
    ratesDraft.gold_rate_source,
    ratesDraft.manual_gold_rate_inr_per_gram,
    ratesDraft.live_markup_percent,
    ratesDraft.live_markup_inr_per_gram,
    platformBaseInr,
  ])

  const referenceMetalInr = useMemo(() => {
    const m = parseN(ratesDraft.default_gold_markup_percent)
    return jewellerStore22k * (1 + m / 100)
  }, [jewellerStore22k, ratesDraft.default_gold_markup_percent])

  const indicativeBuybackPreview = useMemo(
    () =>
      previewIndicativeBuyback(
        jewellerStore22k,
        parseN(ratesDraft.default_gold_markup_percent),
        sellbackDeductionMode,
        ratesDraft.sellback_deduction_percent,
        ratesDraft.sellback_fixed_inr_per_gram,
      ),
    [
      jewellerStore22k,
      ratesDraft.default_gold_markup_percent,
      sellbackDeductionMode,
      ratesDraft.sellback_deduction_percent,
      ratesDraft.sellback_fixed_inr_per_gram,
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
    <div className="dash-panel-max jeweller-rates-schemes">
      <p className="dash-panel-lead">
        Phase 1 MVP: configure <strong>buy-side metal reference</strong>, <strong>sellback</strong>, making comparison,
        deposit disclosures, and <strong>Golden Scheme</strong> (monthly jewellery savings) copy shown on your storefront.
        Product SKUs stay under{' '}
        <Link to="/dashboard/jeweller?section=mkt_products">Marketplace · Listings</Link>.
      </p>

      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Gold rate management &amp; sellback
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          Cridora benchmark 22K plus your <strong>percentage</strong> and/or <strong>fixed ₹/g</strong> markups, or a{' '}
          <strong>manual 22K ₹/g</strong>. Default SKU markup applies on top for ornament listings. Cash sellback uses your
          deduction spread vs reference metal; optional headline buyback overrides the derived rate on cards.
        </p>
        {jewellerRatePolicyAsOf.trim() !== '' ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Customer quotes reference this policy as last effective{' '}
            <strong>
              {new Date(jewellerRatePolicyAsOf).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </strong>
            .
          </p>
        ) : null}

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
            Platform ticker (reference only · jewellers see customer rates elsewhere)
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
                <span style={{ color: 'var(--text-muted)' }}>Resolved 22K base </span>
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
              Ticker unavailable — retry after opening this page.
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
                  From live base + your markups, or manual 22K.
                </td>
              </tr>
              <tr>
                <td>Gold rate source</td>
                <td colSpan={2}>
                  <select
                    style={{ ...tableInput, maxWidth: 280 }}
                    value={ratesDraft.gold_rate_source}
                    onChange={(e) =>
                      setRatesDraft((p) => ({
                        ...p,
                        gold_rate_source: e.target.value === 'manual' ? 'manual' : 'live_cridora',
                      }))
                    }
                  >
                    <option value="live_cridora">Live benchmark 22K + my markups</option>
                    <option value="manual">Manual 22K ₹/g (fixed)</option>
                  </select>
                </td>
              </tr>
              {ratesDraft.gold_rate_source === 'live_cridora' ? (
                <>
                  <tr>
                    <td>Markup on benchmark 22K (%)</td>
                    <td>
                      <input
                        style={tableInput}
                        inputMode="decimal"
                        value={ratesDraft.live_markup_percent}
                        onChange={(e) => setRatesDraft((p) => ({ ...p, live_markup_percent: e.target.value }))}
                      />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Before ₹/g add-on.</td>
                  </tr>
                  <tr>
                    <td>Extra on benchmark (₹/g)</td>
                    <td>
                      <input
                        style={tableInput}
                        inputMode="decimal"
                        value={ratesDraft.live_markup_inr_per_gram}
                        onChange={(e) => setRatesDraft((p) => ({ ...p, live_markup_inr_per_gram: e.target.value }))}
                      />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Added after percent markup.</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td>Manual 22K rate (₹/g)</td>
                  <td>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={ratesDraft.manual_gold_rate_inr_per_gram}
                      onChange={(e) =>
                        setRatesDraft((p) => ({ ...p, manual_gold_rate_inr_per_gram: e.target.value }))
                      }
                    />
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Drives SKUs and fractional quotes when not overridden per SKU.
                  </td>
                </tr>
              )}
              <tr>
                <td>Optional external rate API (URL)</td>
                <td colSpan={2}>
                  <input
                    type="url"
                    style={{ ...tableInput, maxWidth: 'min(100%, 420px)', width: '100%' }}
                    value={ratesDraft.gold_rate_external_api_url}
                    onChange={(e) =>
                      setRatesDraft((p) => ({ ...p, gold_rate_external_api_url: e.target.value }))
                    }
                    placeholder="https://example.com/your-internal-gold-quote"
                  />
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Stored for your records — Cridora does not poll automatically yet.
                  </p>
                </td>
              </tr>
              <tr>
                <td>Default gold markup (ornaments)</td>
                <td>
                  <label className="field" style={{ margin: 0, gap: '0.35rem' }}>
                    <span className="sr-only">Default gold markup percent</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={ratesDraft.default_gold_markup_percent}
                      onChange={(e) =>
                        setRatesDraft((p) => ({ ...p, default_gold_markup_percent: e.target.value }))
                      }
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>% on your store 22K</span>
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Applied when a SKU does not override markup.
                </td>
              </tr>
              <tr>
                <td>Reference metal (after default SKU markup)</td>
                <td className="tabular" style={{ fontWeight: 700 }}>
                  ₹{formatInr(referenceMetalInr, 2)}/g
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Basis for sellback preview when no headline override.
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
                          value={ratesDraft.sellback_deduction_percent}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, sellback_deduction_percent: e.target.value }))
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
                          value={ratesDraft.sellback_fixed_inr_per_gram}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, sellback_fixed_inr_per_gram: e.target.value }))
                          }
                          aria-label="Sellback fixed rupees per gram"
                        />
                      </label>
                    )}
                  </div>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Only the selected mode is saved; the other is stored as 0.
                </td>
              </tr>
              <tr>
                <td>Preview indicative buyback</td>
                <td className="tabular" style={{ fontWeight: 700, color: 'var(--gold-light)' }}>
                  ₹{formatInr(indicativeBuybackPreview, 2)}/g
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Before headline override.</td>
              </tr>
              <tr>
                <td>Typical making charge (comparison)</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Typical making charge per gram</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={ratesDraft.representative_making_charge_inr_per_gram}
                      onChange={(e) =>
                        setRatesDraft((p) => ({
                          ...p,
                          representative_making_charge_inr_per_gram: e.target.value,
                        }))
                      }
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Shown on your jeweller card.</td>
              </tr>
              <tr>
                <td>Optional buyback headline ₹/g</td>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="sr-only">Optional buyback headline</span>
                    <input
                      style={tableInput}
                      inputMode="decimal"
                      value={ratesDraft.buyback_headline_inr_per_gram}
                      onChange={(e) =>
                        setRatesDraft((p) => ({ ...p, buyback_headline_inr_per_gram: e.target.value }))
                      }
                      placeholder="Leave blank to derive"
                    />
                  </label>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Overrides derived buyback on storefront when set.
                </td>
              </tr>
              <tr>
                <td>Gold deposit yield (% APR)</td>
                <td>
                  <input
                    style={tableInput}
                    inputMode="decimal"
                    value={ratesDraft.gold_deposit_yield_apr_percent}
                    onChange={(e) =>
                      setRatesDraft((p) => ({ ...p, gold_deposit_yield_apr_percent: e.target.value }))
                    }
                  />
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Directory disclosure.</td>
              </tr>
              <tr>
                <td>Gold loan interest (% APR)</td>
                <td>
                  <input
                    style={tableInput}
                    inputMode="decimal"
                    value={ratesDraft.gold_loan_interest_apr_percent}
                    onChange={(e) =>
                      setRatesDraft((p) => ({ ...p, gold_loan_interest_apr_percent: e.target.value }))
                    }
                  />
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Use 0 if zero-interest programme.</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                  <label className="field" style={{ margin: 0, width: '100%' }}>
                    <span>Gold deposit note (marketplace)</span>
                    <textarea
                      className="dash-textarea"
                      rows={3}
                      value={ratesDraft.gold_deposit_note}
                      onChange={(e) => setRatesDraft((p) => ({ ...p, gold_deposit_note: e.target.value }))}
                      style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}
                    />
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Golden Scheme (jewellery savings)
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          MVP disclosure only: customers contribute monthly toward ornament savings; gold rate may apply at investment or
          redemption per your policy. Admin scheme moderation can be layered later — today this copy surfaces on your public
          jeweller card when enabled.
        </p>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={ratesDraft.golden_scheme_enabled}
            onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_enabled: e.target.checked }))}
          />
          <span>Offer Golden Scheme on storefront</span>
        </label>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label className="field">
            <span>Typical duration (months)</span>
            <input
              inputMode="numeric"
              value={ratesDraft.golden_scheme_duration_months}
              onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_duration_months: e.target.value }))}
              placeholder="e.g. 11"
            />
          </label>
          <label className="field">
            <span>Minimum monthly contribution (₹)</span>
            <input
              inputMode="decimal"
              value={ratesDraft.golden_scheme_min_monthly_inr}
              onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_min_monthly_inr: e.target.value }))}
              placeholder="e.g. 1000"
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Lock-in / tenure note</span>
            <input
              value={ratesDraft.golden_scheme_lock_in_note}
              onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_lock_in_note: e.target.value }))}
              placeholder="e.g. 30-day gap after 11th installment before ornament closing"
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>How gold rate applies</span>
            <input
              value={ratesDraft.golden_scheme_rate_application_note}
              onChange={(e) =>
                setRatesDraft((p) => ({ ...p, golden_scheme_rate_application_note: e.target.value }))
              }
              placeholder="e.g. Board rate on installment date · ornament close at month-end rate"
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Benefits</span>
            <textarea
              className="dash-textarea"
              rows={4}
              value={ratesDraft.golden_scheme_benefits}
              onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_benefits: e.target.value }))}
              placeholder="Bonus months, MC waivers, ornament bonus grams…"
              style={{ width: '100%', marginTop: '0.35rem' }}
            />
          </label>
        </div>
      </section>

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void saveRatesAndSchemes()}
        style={{ marginBottom: '1.5rem' }}
      >
        Save rates &amp; schemes
      </button>
    </div>
  )
}
