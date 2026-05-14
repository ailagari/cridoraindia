import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  totalBuybackDeductionPerGram,
  type MetalBuybackDraft,
  type MetalCode,
  type MetalPricingDraft,
  type MetalPricingMode,
} from '@/features/marketplace/jewellerMetalRates'

type ProfileApi = Record<string, unknown>

type SectionKey = 'metals' | 'ornaments' | 'deposit' | 'golden'

const modeOptions: { value: MetalPricingMode; label: string }[] = [
  { value: 'match_cridora', label: 'Match Cridora reference' },
  { value: 'markup_on_cridora', label: 'Cridora + markup (% / ₹g)' },
  { value: 'manual_board_inr', label: 'Fixed board ₹/g' },
  { value: 'external_api', label: 'External rate feed (URL)' },
]

const thHead: CSSProperties = {
  textAlign: 'left',
  padding: '0.55rem 0.75rem',
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  borderBottom: '1px solid var(--border-soft)',
  background: 'var(--veil)',
}

const tdCell: CSSProperties = {
  padding: '0.65rem 0.75rem',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border-soft)',
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 8,
        background: 'var(--veil)',
        border: '1px solid var(--border-soft)',
        fontSize: '0.65rem',
        color: 'var(--gold-light)',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      ▼
    </span>
  )
}

export function JewellerRatesSchemesPanel() {
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [jewellerRatePolicyAsOf, setJewellerRatePolicyAsOf] = useState('')
  const [ticker, setTicker] = useState<GoldTickerPayload | null>(null)
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)

  const [openSection, setOpenSection] = useState<SectionKey | null>('metals')
  const [openMetal, setOpenMetal] = useState<MetalCode | null>(null)

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

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSection((prev) => (prev === key ? null : key))
    setOpenMetal(null)
  }, [])

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

  const ornamentTotalDeductionPerGram = useMemo(() => {
    if (ratesDraft.buyback_headline_inr_per_gram.trim() !== '') return null
    const buy = previewBuybackInrPerGram(referenceMetalInr, buybackByMetal.gold_22k)
    return Math.max(0, referenceMetalInr - buy)
  }, [referenceMetalInr, buybackByMetal.gold_22k, ratesDraft.buyback_headline_inr_per_gram])

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

  const metalsSummary =
    ticker != null
      ? `Cridora 22K ₹${formatInr(platformBaseInr, 2)}/g · ${JEWELLER_METAL_ROWS.length} purities`
      : 'Loading reference…'

  const ornamentsSummary = `Ref metal ₹${formatInr(referenceMetalInr, 2)}/g · Buy ₹${formatInr(indicativeBuybackGoldDisplay, 2)}/g`

  const depositSummary = `Deposit ${formatInr(parseN(platformDisclosures.gold_deposit_yield_apr_percent), 2)}% APR · Loan ${formatInr(parseN(platformDisclosures.gold_loan_interest_apr_percent), 2)}%`

  const goldenSummary = ratesDraft.golden_scheme_enabled ? 'Offer enabled — edit terms' : 'Disabled'

  const toggleMetal = (code: MetalCode) => {
    setOpenMetal((prev) => (prev === code ? null : code))
  }

  return (
    <div className="dash-panel-max jeweller-rates-schemes">
      <style>{`
        .jeweller-rates-unified tbody tr.jeweller-rates-acc-head:hover { background: var(--veil-35); }
        .jeweller-rates-unified tbody tr.jeweller-rates-acc-head.is-active { background: rgba(212, 175, 55, 0.08); }
        .jeweller-rates-unified tbody tr.jeweller-metal-row:hover { background: var(--veil-35); }
        .jeweller-rates-unified tbody tr.jeweller-metal-row.is-picked { background: rgba(212, 175, 55, 0.06); }
      `}</style>
      <p className="dash-panel-lead">
        Every metal tracks the <strong>Cridora reference</strong> admins publish. Use the table below —{' '}
        <strong>one section open at a time</strong>; inside Metals, <strong>one purity row open at a time</strong>. Ornament
        SKUs:{' '}
        <Link to="/dashboard/jeweller?section=mkt_products">Marketplace · Listings</Link>.
      </p>

      {loadError ? <p className="form-error">{loadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <div
        className="card jeweller-rates-unified"
        style={{
          marginBottom: '1.25rem',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--border-soft)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr>
              <th style={{ ...thHead, width: '34%' }}>Section</th>
              <th style={{ ...thHead }}>Summary</th>
              <th style={{ ...thHead, width: 52, textAlign: 'center' }} aria-hidden>
                {' '}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Metals */}
            <tr
              className={`jeweller-rates-acc-head${openSection === 'metals' ? ' is-active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('metals')}
            >
              <td style={{ ...tdCell, fontWeight: 800 }}>Metal rates &amp; buyback</td>
              <td style={{ ...tdCell, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{metalsSummary}</td>
              <td style={{ ...tdCell, textAlign: 'center' }}>
                <Chevron open={openSection === 'metals'} />
              </td>
            </tr>
            {openSection === 'metals' ? (
              <tr>
                <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid var(--border-soft)' }}>
                  <div
                    style={{ padding: '1rem 1.15rem 1.15rem', background: 'var(--veil)' }}
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      One platform reference (effective 22K ₹/g). Other purities scale from it.
                      {jewellerRatePolicyAsOf.trim() !== '' ? (
                        <>
                          {' '}
                          Policy effective{' '}
                          <strong>
                            {new Date(jewellerRatePolicyAsOf).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </strong>
                          .
                        </>
                      ) : null}
                    </p>
                    <div
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 12,
                        border: '1px solid var(--border-soft)',
                        background: 'var(--veil-35)',
                      }}
                    >
                      <p
                        style={{
                          margin: '0 0 0.35rem',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          letterSpacing: '0.1em',
                          color: 'var(--text-faint)',
                        }}
                      >
                        Cridora reference 22K (admin-published)
                      </p>
                      {ticker ? (
                        <strong className="tabular" style={{ color: 'var(--gold-light)', fontSize: '1.1rem' }}>
                          ₹{formatInr(platformBaseInr, 2)}/g
                        </strong>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Unavailable</span>
                      )}
                      {ticker ? (
                        <span style={{ marginLeft: 12, fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                          Updated{' '}
                          {new Date(ticker.updated_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th style={{ ...thHead, borderRadius: '8px 0 0 0' }}>Metal</th>
                            <th style={{ ...thHead, textAlign: 'right' }}>Ref ₹/g</th>
                            <th style={{ ...thHead, textAlign: 'right' }}>Board ₹/g</th>
                            <th style={{ ...thHead, textAlign: 'right' }}>Buy ₹/g</th>
                            <th style={{ ...thHead, textAlign: 'right' }}>Ded ₹/g</th>
                            <th style={{ ...thHead, width: 48, textAlign: 'center', borderRadius: '0 8px 0 0' }}>
                              {' '}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {JEWELLER_METAL_ROWS.map(({ code, label, sub }) => {
                            const cridoraRef = cridoraRefInrForMetal(code, platformBaseInr, spot)
                            const board = computeJewellerBoardInrPerGram(cridoraRef, pricingByMetal[code])
                            const buy = previewBuybackInrPerGram(board, buybackByMetal[code])
                            const totalDed = totalBuybackDeductionPerGram(board, buybackByMetal[code])
                            const pr = pricingByMetal[code]
                            const bb = buybackByMetal[code]
                            const picked = openMetal === code
                            return (
                              <Fragment key={code}>
                                <tr
                                  className={`jeweller-metal-row${picked ? ' is-picked' : ''}`}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => toggleMetal(code)}
                                >
                                  <td style={{ ...tdCell, fontWeight: 700 }}>{label}</td>
                                  <td style={{ ...tdCell, textAlign: 'right' }} className="tabular">
                                    ₹{formatInr(cridoraRef, 2)}
                                  </td>
                                  <td style={{ ...tdCell, textAlign: 'right', color: 'var(--gold-light)', fontWeight: 700 }} className="tabular">
                                    ₹{formatInr(board, 2)}
                                  </td>
                                  <td style={{ ...tdCell, textAlign: 'right', fontWeight: 600 }} className="tabular">
                                    ₹{formatInr(buy, 2)}
                                  </td>
                                  <td style={{ ...tdCell, textAlign: 'right', fontWeight: 600 }} className="tabular">
                                    ₹{formatInr(totalDed, 2)}
                                  </td>
                                  <td style={{ ...tdCell, textAlign: 'center' }}>
                                    <Chevron open={picked} />
                                  </td>
                                </tr>
                                {picked ? (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '0 0 1rem', borderBottom: '1px solid var(--border-soft)' }}>
                                      <div
                                        style={{
                                          padding: '1rem',
                                          margin: '0 0.25rem',
                                          borderRadius: 12,
                                          border: '1px solid var(--border-soft)',
                                          background: 'var(--veil-35)',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <p style={{ margin: '0 0 1rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                          {sub}
                                        </p>
                                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                                          <label className="field" style={{ margin: 0 }}>
                                            <span style={{ fontSize: '0.78rem' }}>Pricing vs Cridora reference</span>
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
                                                  onChange={(e) =>
                                                    setPricing(code, { markup_percent: e.target.value })
                                                  }
                                                />
                                              </label>
                                              <label className="field" style={{ margin: 0 }}>
                                                <span>Plus ₹/g after %</span>
                                                <input
                                                  style={inp}
                                                  inputMode="decimal"
                                                  value={pr.markup_inr_per_gram}
                                                  onChange={(e) =>
                                                    setPricing(code, { markup_inr_per_gram: e.target.value })
                                                  }
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
                                                onChange={(e) =>
                                                  setPricing(code, { manual_inr_per_gram: e.target.value })
                                                }
                                              />
                                            </label>
                                          ) : null}

                                          {pr.mode === 'external_api' ? (
                                            <label className="field" style={{ margin: 0 }}>
                                              <span>HTTPS endpoint (not polled yet)</span>
                                              <input
                                                type="url"
                                                style={{ ...inp, maxWidth: '100%' }}
                                                value={pr.external_api_url}
                                                onChange={(e) =>
                                                  setPricing(code, { external_api_url: e.target.value })
                                                }
                                                placeholder="https://…"
                                              />
                                            </label>
                                          ) : null}

                                          <div
                                            style={{
                                              borderTop: '1px solid var(--border-soft)',
                                              paddingTop: '0.65rem',
                                            }}
                                          >
                                            <p
                                              style={{
                                                margin: '0 0 0.5rem',
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.08em',
                                                color: 'var(--text-faint)',
                                              }}
                                            >
                                              Buyback vs board ₹/g
                                            </p>
                                            <div
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                                gap: '0.65rem',
                                              }}
                                            >
                                              <label className="field" style={{ margin: 0 }}>
                                                <span>Deduct %</span>
                                                <input
                                                  style={inp}
                                                  inputMode="decimal"
                                                  value={bb.deduction_percent}
                                                  onChange={(e) =>
                                                    setBuyback(code, { deduction_percent: e.target.value })
                                                  }
                                                />
                                              </label>
                                              <label className="field" style={{ margin: 0 }}>
                                                <span>Less ₹/g (fixed)</span>
                                                <input
                                                  style={inp}
                                                  inputMode="decimal"
                                                  value={bb.fixed_inr_per_gram}
                                                  onChange={(e) =>
                                                    setBuyback(code, { fixed_inr_per_gram: e.target.value })
                                                  }
                                                />
                                              </label>
                                              <label className="field" style={{ margin: 0 }}>
                                                <span>Less ₹/g (extra)</span>
                                                <input
                                                  style={inp}
                                                  inputMode="decimal"
                                                  value={bb.jeweller_deduction_inr_per_gram}
                                                  onChange={(e) =>
                                                    setBuyback(code, {
                                                      jeweller_deduction_inr_per_gram: e.target.value,
                                                    })
                                                  }
                                                />
                                              </label>
                                            </div>
                                            <p
                                              style={{
                                                margin: '0.65rem 0 0',
                                                fontSize: '0.85rem',
                                                fontWeight: 800,
                                              }}
                                            >
                                              Total deductions vs board:{' '}
                                              <span className="tabular" style={{ color: 'var(--gold-light)' }}>
                                                ₹{formatInr(totalDed, 2)}/g
                                              </span>
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            ) : null}

            {/* Ornaments */}
            <tr
              className={`jeweller-rates-acc-head${openSection === 'ornaments' ? ' is-active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('ornaments')}
            >
              <td style={{ ...tdCell, fontWeight: 800 }}>Gold 22K ornaments &amp; card buyback</td>
              <td style={{ ...tdCell, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{ornamentsSummary}</td>
              <td style={{ ...tdCell, textAlign: 'center' }}>
                <Chevron open={openSection === 'ornaments'} />
              </td>
            </tr>
            {openSection === 'ornaments' ? (
              <tr>
                <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ padding: '1rem 1.15rem', background: 'var(--veil)' }} onClick={(e) => e.stopPropagation()}>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Default SKU markup on your 22K board unless a listing overrides it.
                    </p>
                    <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <label className="field">
                        <span>Default ornament markup (%)</span>
                        <input
                          inputMode="decimal"
                          value={ratesDraft.default_gold_markup_percent}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, default_gold_markup_percent: e.target.value }))
                          }
                        />
                      </label>
                      <div className="card" style={{ padding: '0.75rem', borderRadius: 12, margin: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)' }}>
                          REFERENCE METAL
                        </p>
                        <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
                          ₹{formatInr(referenceMetalInr, 2)}/g
                        </p>
                      </div>
                      <div className="card" style={{ padding: '0.75rem', borderRadius: 12, margin: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)' }}>
                          INDICATIVE BUYBACK
                        </p>
                        <p style={{ margin: '0.35rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }} className="tabular">
                          ₹{formatInr(indicativeBuybackGoldDisplay, 2)}/g
                        </p>
                        {ornamentTotalDeductionPerGram != null ? (
                          <p style={{ margin: '0.45rem 0 0', fontSize: '0.78rem', fontWeight: 700 }} className="tabular">
                            Total deductions vs ref metal: ₹{formatInr(ornamentTotalDeductionPerGram, 2)}/g
                          </p>
                        ) : (
                          <p style={{ margin: '0.45rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Headline override — totals N/A
                          </p>
                        )}
                      </div>
                    </div>
                    <label className="field" style={{ marginTop: '1rem' }}>
                      <span>Optional buyback headline ₹/g</span>
                      <input
                        inputMode="decimal"
                        value={ratesDraft.buyback_headline_inr_per_gram}
                        onChange={(e) =>
                          setRatesDraft((p) => ({ ...p, buyback_headline_inr_per_gram: e.target.value }))
                        }
                      />
                    </label>
                    <label className="field" style={{ marginTop: '0.85rem' }}>
                      <span>Typical making charge ₹/g</span>
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
                  </div>
                </td>
              </tr>
            ) : null}

            {/* Deposit */}
            <tr
              className={`jeweller-rates-acc-head${openSection === 'deposit' ? ' is-active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('deposit')}
            >
              <td style={{ ...tdCell, fontWeight: 800 }}>Deposit &amp; loan disclosures</td>
              <td style={{ ...tdCell, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{depositSummary}</td>
              <td style={{ ...tdCell, textAlign: 'center' }}>
                <Chevron open={openSection === 'deposit'} />
              </td>
            </tr>
            {openSection === 'deposit' ? (
              <tr>
                <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ padding: '1rem 1.15rem', background: 'var(--veil)' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                      <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-faint)' }}>
                          DEPOSIT YIELD (% APR)
                        </p>
                        <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
                          {formatInr(parseN(platformDisclosures.gold_deposit_yield_apr_percent), 3)}%
                        </p>
                      </div>
                      <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-faint)' }}>
                          LOAN APR (%)
                        </p>
                        <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
                          {formatInr(parseN(platformDisclosures.gold_loan_interest_apr_percent), 3)}%
                        </p>
                      </div>
                      <div className="card" style={{ padding: '0.85rem', borderRadius: 12, margin: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-faint)' }}>
                          PROCESSING (₹)
                        </p>
                        <p style={{ margin: '0.35rem 0 0', fontWeight: 800 }} className="tabular">
                          ₹{formatInr(parseN(platformDisclosures.gold_loan_processing_fee_inr), 0)}
                        </p>
                      </div>
                    </div>
                    <label className="field">
                      <span>Your loan disclosure: extra ₹/g (optional)</span>
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
                        style={{ width: '100%', marginTop: '0.35rem' }}
                      />
                    </label>
                  </div>
                </td>
              </tr>
            ) : null}

            {/* Golden */}
            <tr
              className={`jeweller-rates-acc-head${openSection === 'golden' ? ' is-active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('golden')}
            >
              <td style={{ ...tdCell, fontWeight: 800 }}>Golden Scheme</td>
              <td style={{ ...tdCell, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{goldenSummary}</td>
              <td style={{ ...tdCell, textAlign: 'center' }}>
                <Chevron open={openSection === 'golden'} />
              </td>
            </tr>
            {openSection === 'golden' ? (
              <tr>
                <td colSpan={3} style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.15rem', background: 'var(--veil)' }} onClick={(e) => e.stopPropagation()}>
                    <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={ratesDraft.golden_scheme_enabled}
                        onChange={(e) =>
                          setRatesDraft((p) => ({ ...p, golden_scheme_enabled: e.target.checked }))
                        }
                      />
                      <span>Offer on storefront</span>
                    </label>
                    <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                      <label className="field">
                        <span>Duration (months)</span>
                        <input
                          inputMode="numeric"
                          value={ratesDraft.golden_scheme_duration_months}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, golden_scheme_duration_months: e.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Min monthly (₹)</span>
                        <input
                          inputMode="decimal"
                          value={ratesDraft.golden_scheme_min_monthly_inr}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, golden_scheme_min_monthly_inr: e.target.value }))
                          }
                        />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Lock-in note</span>
                        <input
                          value={ratesDraft.golden_scheme_lock_in_note}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, golden_scheme_lock_in_note: e.target.value }))
                          }
                        />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>How gold rate applies</span>
                        <input
                          value={ratesDraft.golden_scheme_rate_application_note}
                          onChange={(e) =>
                            setRatesDraft((p) => ({
                              ...p,
                              golden_scheme_rate_application_note: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Benefits</span>
                        <textarea
                          className="dash-textarea"
                          rows={4}
                          value={ratesDraft.golden_scheme_benefits}
                          onChange={(e) =>
                            setRatesDraft((p) => ({ ...p, golden_scheme_benefits: e.target.value }))
                          }
                          style={{ width: '100%', marginTop: '0.35rem' }}
                        />
                      </label>
                    </div>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
