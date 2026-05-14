import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { authFetch } from '@/lib/api'
import { fetchGoldTicker, fetchSpotPrices, type GoldTickerPayload, type SpotPricesPayload } from '@/lib/marketplaceApi'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatInr, numOrZero, parseN } from '@/features/marketplace/jewellerMarketplaceShared'
import {
  buybackDraftFromApi,
  computeJewellerBoardInrPerGram,
  cridoraRefInrForMetal,
  defaultBuybackDraft,
  defaultPricingDraft,
  JEWELLER_METAL_ROWS,
  previewBuybackInrPerGram,
  pricingDraftFromApi,
  type MetalBuybackDraft,
  type MetalCode,
  type MetalPricingDraft,
  type MetalPricingMode,
} from '@/features/marketplace/jewellerMetalRates'

type ProfileApi = Record<string, unknown>

const modeOptions: { value: MetalPricingMode; label: string }[] = [
  { value: 'match_cridora', label: 'Match Cridora reference' },
  { value: 'markup_on_cridora', label: 'Cridora + markup (% / ₹g)' },
  { value: 'manual_board_inr', label: 'Fixed board ₹/g' },
  { value: 'external_api', label: 'External rate feed (URL)' },
]

export function JewellerRatesSchemesPanel() {
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [jewellerRatePolicyAsOf, setJewellerRatePolicyAsOf] = useState('')
  const [ticker, setTicker] = useState<GoldTickerPayload | null>(null)
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)

  const [pricingByMetal, setPricingByMetal] = useState<
    Record<MetalCode, MetalPricingDraft>
  >(() => {
    const o = {} as Record<MetalCode, MetalPricingDraft>
    for (const { code } of JEWELLER_METAL_ROWS) o[code] = defaultPricingDraft()
    return o
  })
  const [buybackByMetal, setBuybackByMetal] = useState<
    Record<MetalCode, MetalBuybackDraft>
  >(() => {
    const o = {} as Record<MetalCode, MetalBuybackDraft>
    for (const { code } of JEWELLER_METAL_ROWS) o[code] = defaultBuybackDraft()
    return o
  })

  const [ratesDraft, setRatesDraft] = useState({
    default_gold_markup_percent: '',
    gold_deposit_note: '',
    representative_making_charge_inr_per_gram: '',
    buyback_headline_inr_per_gram: '',
    gold_loan_jeweller_deduction_inr_per_gram: '',
    golden_scheme_enabled: false,
    golden_scheme_duration_months: '',
    golden_scheme_min_monthly_inr: '',
    golden_scheme_lock_in_note: '',
    golden_scheme_benefits: '',
    golden_scheme_rate_application_note: '',
  })

  const [platformDisclosures, setPlatformDisclosures] = useState({
    gold_deposit_yield_apr_percent: '0',
    gold_loan_interest_apr_percent: '0',
    gold_loan_processing_fee_inr: '0',
  })

  const refresh = useCallback(async () => {
    setLoadError('')
    const [pr, tk, sp] = await Promise.all([
      authFetch('/api/v1/jeweller/marketplace/profile/'),
      fetchGoldTicker(),
      fetchSpotPrices(),
    ])
    setTicker(tk)
    setSpot(sp)
    if (!pr.ok) {
      const j = await pr.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load pricing profile.')
      return
    }
    const pJson = (await pr.json()) as ProfileApi
    setJewellerRatePolicyAsOf(String(pJson.jeweller_metal_rate_effective_updated_at ?? ''))
    setPricingByMetal(pricingDraftFromApi(pJson.metal_pricing_json))
    setBuybackByMetal(buybackDraftFromApi(pJson.metal_buyback_json))
    setRatesDraft({
      default_gold_markup_percent: String(pJson.default_gold_markup_percent ?? ''),
      gold_deposit_note: String(pJson.gold_deposit_note ?? ''),
      representative_making_charge_inr_per_gram: String(
        pJson.representative_making_charge_inr_per_gram ?? '0',
      ),
      buyback_headline_inr_per_gram:
        pJson.buyback_headline_inr_per_gram != null && String(pJson.buyback_headline_inr_per_gram) !== ''
          ? String(pJson.buyback_headline_inr_per_gram)
          : '',
      gold_loan_jeweller_deduction_inr_per_gram: String(
        pJson.gold_loan_jeweller_deduction_inr_per_gram ?? '0',
      ),
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
    setPlatformDisclosures({
      gold_deposit_yield_apr_percent: String(pJson.gold_deposit_yield_apr_percent ?? '0'),
      gold_loan_interest_apr_percent: String(pJson.gold_loan_interest_apr_percent ?? '0'),
      gold_loan_processing_fee_inr: String(pJson.gold_loan_processing_fee_inr ?? '0'),
    })
  }, [])

  const pollLive = useCallback(async () => {
    if (busy) return
    const [tk, sp] = await Promise.all([fetchGoldTicker(), fetchSpotPrices()])
    setTicker(tk)
    setSpot(sp)
  }, [busy])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(pollLive, LIVE_MARKETPLACE_EDITOR_POLL_MS, true)

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
    const ref = cridoraRefInrForMetal('gold_22k', platformBaseInr, spot)
    return computeJewellerBoardInrPerGram(ref, pricingByMetal.gold_22k)
  }, [platformBaseInr, spot, pricingByMetal])

  const referenceMetalInr = useMemo(() => {
    const m = parseN(ratesDraft.default_gold_markup_percent)
    return jewellerStore22k * (1 + m / 100)
  }, [jewellerStore22k, ratesDraft.default_gold_markup_percent])

  const indicativeBuybackGoldDisplay = useMemo(() => {
    if (ratesDraft.buyback_headline_inr_per_gram.trim() !== '') {
      return parseN(ratesDraft.buyback_headline_inr_per_gram)
    }
    return previewBuybackInrPerGram(referenceMetalInr, buybackByMetal.gold_22k)
  }, [referenceMetalInr, buybackByMetal, ratesDraft.buyback_headline_inr_per_gram])

  const saveRatesAndSchemes = async () => {
    setBusy(true)
    setFormError('')
    const durRaw = ratesDraft.golden_scheme_duration_months.trim()
    const durParsed = Number.parseInt(durRaw, 10)
    const durNum =
      durRaw === '' || Number.isNaN(durParsed) ? null : Math.max(0, Math.floor(durParsed))
    const minMonthlyRaw = ratesDraft.golden_scheme_min_monthly_inr.trim()

    const metal_pricing_json: Record<string, Record<string, string>> = {}
    for (const { code } of JEWELLER_METAL_ROWS) {
      const p = pricingByMetal[code]
      metal_pricing_json[code] = {
        mode: p.mode,
        markup_percent: numOrZero(p.markup_percent),
        markup_inr_per_gram: numOrZero(p.markup_inr_per_gram),
        manual_inr_per_gram:
          p.mode === 'manual_board_inr' ? numOrZero(p.manual_inr_per_gram) : '0',
        external_api_url: p.external_api_url.trim().slice(0, 512),
      }
    }

    const metal_buyback_json: Record<string, Record<string, string>> = {}
    for (const { code } of JEWELLER_METAL_ROWS) {
      const b = buybackByMetal[code]
      metal_buyback_json[code] = {
        deduction_percent: numOrZero(b.deduction_percent),
        fixed_inr_per_gram: numOrZero(b.fixed_inr_per_gram),
        jeweller_deduction_inr_per_gram: numOrZero(b.jeweller_deduction_inr_per_gram),
      }
    }

    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: {
        metal_pricing_json,
        metal_buyback_json,
        gold_loan_jeweller_deduction_inr_per_gram: numOrZero(
          ratesDraft.gold_loan_jeweller_deduction_inr_per_gram,
        ),
        default_gold_markup_percent: numOrZero(ratesDraft.default_gold_markup_percent),
        gold_deposit_note: ratesDraft.gold_deposit_note.trim(),
        representative_making_charge_inr_per_gram: numOrZero(
          ratesDraft.representative_making_charge_inr_per_gram,
        ),
        buyback_headline_inr_per_gram:
          ratesDraft.buyback_headline_inr_per_gram.trim() === ''
            ? null
            : numOrZero(ratesDraft.buyback_headline_inr_per_gram),
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

  const inp: CSSProperties = {
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

  const setPricing = (code: MetalCode, patch: Partial<MetalPricingDraft>) => {
    setPricingByMetal((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  const setBuyback = (code: MetalCode, patch: Partial<MetalBuybackDraft>) => {
    setBuybackByMetal((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  return (
    <div className="dash-panel-max jeweller-rates-schemes">
      <p className="dash-panel-lead">
        Set how each metal tracks the <strong>Cridora reference</strong> (live ticker or admin manual board), your{' '}
        <strong>buyback spreads</strong> per purity, and disclosures. Default SKU markup still applies on{' '}
        <strong>gold 22K ornaments</strong> only — configure SKUs under{' '}
        <Link to="/dashboard/jeweller?section=mkt_products">Marketplace · Listings</Link>.
      </p>

      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Cridora reference (what customers compare against)
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          The platform publishes a single <strong>resolved 22K ₹/g</strong> from live spot or the admin manual ticker
          (plus admin markup rules). That value is your <strong>gold 22K reference</strong>. Other purities use the same
          spot curve (or sane derivation when silver spot is briefly unavailable).
        </p>
        {jewellerRatePolicyAsOf.trim() !== '' ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Quotes reference this policy as last effective{' '}
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
            Platform ticker snapshot
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
                <span style={{ color: 'var(--text-muted)' }}>Admin benchmark 22K </span>
                <strong className="tabular">₹{formatInr(reference22kInr, 2)}/g</strong>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Admin markup </span>
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
              Ticker unavailable — retry after opening this page.
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {JEWELLER_METAL_ROWS.map(({ code, label, sub }) => {
            const cridoraRef = cridoraRefInrForMetal(code, platformBaseInr, spot)
            const board = computeJewellerBoardInrPerGram(cridoraRef, pricingByMetal[code])
            const buy = previewBuybackInrPerGram(board, buybackByMetal[code])
            const pr = pricingByMetal[code]
            const bb = buybackByMetal[code]
            return (
              <div
                key={code}
                className="card"
                style={{
                  padding: '1rem 1.1rem',
                  borderRadius: 16,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil-35)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{label}</h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub}</p>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '0.65rem',
                      fontSize: '0.8rem',
                      textAlign: 'right',
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.62rem', fontWeight: 800 }}>CRIDORA REF</div>
                      <div className="tabular" style={{ fontWeight: 700 }}>
                        ₹{formatInr(cridoraRef, 2)}/g
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.62rem', fontWeight: 800 }}>YOUR BOARD</div>
                      <div className="tabular" style={{ fontWeight: 800, color: 'var(--gold-light)' }}>
                        ₹{formatInr(board, 2)}/g
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.62rem', fontWeight: 800 }}>
                        BUYBACK PREVIEW
                      </div>
                      <div className="tabular" style={{ fontWeight: 700 }}>
                        ₹{formatInr(buy, 2)}/g
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.78rem' }}>Pricing vs Cridora</span>
                    <select
                      style={{ ...inp, maxWidth: '100%' }}
                      value={pr.mode}
                      onChange={(e) =>
                        setPricing(code, { mode: e.target.value as MetalPricingMode })
                      }
                    >
                      {modeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {pr.mode === 'markup_on_cridora' ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '0.65rem',
                      }}
                    >
                      <label className="field" style={{ margin: 0 }}>
                        <span>Markup % on reference</span>
                        <input
                          style={inp}
                          inputMode="decimal"
                          value={pr.markup_percent}
                          onChange={(e) => setPricing(code, { markup_percent: e.target.value })}
                        />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Plus ₹/g after %</span>
                        <input
                          style={inp}
                          inputMode="decimal"
                          value={pr.markup_inr_per_gram}
                          onChange={(e) => setPricing(code, { markup_inr_per_gram: e.target.value })}
                        />
                      </label>
                    </div>
                  ) : null}

                  {pr.mode === 'manual_board_inr' ? (
                    <label className="field" style={{ margin: 0 }}>
                      <span>Your fixed board ₹/g</span>
                      <input
                        style={inp}
                        inputMode="decimal"
                        value={pr.manual_inr_per_gram}
                        onChange={(e) => setPricing(code, { manual_inr_per_gram: e.target.value })}
                      />
                    </label>
                  ) : null}

                  {pr.mode === 'external_api' ? (
                    <label className="field" style={{ margin: 0 }}>
                      <span>HTTPS endpoint for your internal quote (not polled yet)</span>
                      <input
                        type="url"
                        style={{ ...inp, maxWidth: '100%' }}
                        value={pr.external_api_url}
                        onChange={(e) => setPricing(code, { external_api_url: e.target.value })}
                        placeholder="https://api.your-system.example/gold-rate"
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Preview still follows Cridora until Cridora connects this feed.
                      </span>
                    </label>
                  ) : null}

                  <div
                    style={{
                      borderTop: '1px solid var(--border-soft)',
                      paddingTop: '0.65rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 0.5rem',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        color: 'var(--text-faint)',
                      }}
                    >
                      Buyback vs your board ₹/g
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '0.65rem',
                      }}
                    >
                      <label className="field" style={{ margin: 0 }}>
                        <span>Deduct %</span>
                        <input
                          style={inp}
                          inputMode="decimal"
                          value={bb.deduction_percent}
                          onChange={(e) => setBuyback(code, { deduction_percent: e.target.value })}
                        />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Less ₹/g (fixed)</span>
                        <input
                          style={inp}
                          inputMode="decimal"
                          value={bb.fixed_inr_per_gram}
                          onChange={(e) => setBuyback(code, { fixed_inr_per_gram: e.target.value })}
                        />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Less ₹/g (your extra)</span>
                        <input
                          style={inp}
                          inputMode="decimal"
                          value={bb.jeweller_deduction_inr_per_gram}
                          onChange={(e) =>
                            setBuyback(code, { jeweller_deduction_inr_per_gram: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Gold 22K ornaments — default markup &amp; card buyback
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          Listings inherit <strong>default gold markup %</strong> on top of your gold 22K board rate unless a SKU
          overrides it. Storefront buyback headline uses this ladder unless you set an explicit headline override.
        </p>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="field">
            <span>Default ornament markup (% on your 22K board)</span>
            <input
              inputMode="decimal"
              value={ratesDraft.default_gold_markup_percent}
              onChange={(e) =>
                setRatesDraft((p) => ({ ...p, default_gold_markup_percent: e.target.value }))
              }
            />
          </label>
          <div className="card" style={{ padding: '0.75rem', borderRadius: 12, margin: 0 }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 800 }}>REFERENCE METAL</p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
              ₹{formatInr(referenceMetalInr, 2)}/g
            </p>
          </div>
          <div className="card" style={{ padding: '0.75rem', borderRadius: 12, margin: 0 }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 800 }}>
              INDICATIVE BUYBACK
            </p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }} className="tabular">
              ₹{formatInr(indicativeBuybackGoldDisplay, 2)}/g
            </p>
          </div>
        </div>
        <label className="field" style={{ marginTop: '1rem' }}>
          <span>Optional buyback headline ₹/g (overrides derived rate on cards)</span>
          <input
            inputMode="decimal"
            value={ratesDraft.buyback_headline_inr_per_gram}
            onChange={(e) =>
              setRatesDraft((p) => ({ ...p, buyback_headline_inr_per_gram: e.target.value }))
            }
            placeholder="Leave blank to derive from reference metal + gold 22K buyback row"
          />
        </label>
        <label className="field" style={{ marginTop: '0.85rem' }}>
          <span>Typical making charge ₹/g (comparison cards)</span>
          <input
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
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Deposit &amp; loan disclosures (platform + your adjustment)
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          Gold deposit yield and headline loan APR / processing fee are configured by <strong>Cridora admins</strong>{' '}
          (market-linked benchmarks). You may disclose an extra <strong>₹/g</strong> adjustment customers see beside
          loan quotes.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)' }}>
              DEPOSIT YIELD (% APR)
            </p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
              {formatInr(parseN(platformDisclosures.gold_deposit_yield_apr_percent), 3)}%
            </p>
          </div>
          <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)' }}>
              LOAN APR (% · PLATFORM)
            </p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
              {formatInr(parseN(platformDisclosures.gold_loan_interest_apr_percent), 3)}%
            </p>
          </div>
          <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)' }}>
              PROCESSING FEE (₹ · PLATFORM)
            </p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
              ₹{formatInr(parseN(platformDisclosures.gold_loan_processing_fee_inr), 0)}
            </p>
          </div>
        </div>
        <label className="field">
          <span>Your loan disclosure: extra ₹/g vs live reference (optional)</span>
          <input
            inputMode="decimal"
            value={ratesDraft.gold_loan_jeweller_deduction_inr_per_gram}
            onChange={(e) =>
              setRatesDraft((p) => ({
                ...p,
                gold_loan_jeweller_deduction_inr_per_gram: e.target.value,
              }))
            }
          />
        </label>
        <label className="field" style={{ marginTop: '0.85rem' }}>
          <span>Gold deposit / vault note</span>
          <textarea
            className="dash-textarea"
            rows={3}
            value={ratesDraft.gold_deposit_note}
            onChange={(e) => setRatesDraft((p) => ({ ...p, gold_deposit_note: e.target.value }))}
            style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}
          />
        </label>
      </section>

      <section className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: 18 }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Golden Scheme (jewellery savings)
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
          MVP disclosure only — surfaces on your public jeweller card when enabled.
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
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>How gold rate applies</span>
            <input
              value={ratesDraft.golden_scheme_rate_application_note}
              onChange={(e) =>
                setRatesDraft((p) => ({ ...p, golden_scheme_rate_application_note: e.target.value }))
              }
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Benefits</span>
            <textarea
              className="dash-textarea"
              rows={4}
              value={ratesDraft.golden_scheme_benefits}
              onChange={(e) => setRatesDraft((p) => ({ ...p, golden_scheme_benefits: e.target.value }))}
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
