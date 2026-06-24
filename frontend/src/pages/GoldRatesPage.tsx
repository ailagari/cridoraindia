import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeoHead } from '@/components/SeoHead'
import { findAdPlacement, GoldRatesAdSlot } from '@/features/goldRates/GoldRatesAdSlot'
import { GoldRatesCityLinks } from '@/components/GoldRatesCityLinks'
import { GoldRatesPriceChart } from '@/features/goldRates/GoldRatesPriceChart'
import { buildGoldSpotPricePoints } from '@/features/portfolio/PortfolioCharts'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { useGoldRatesSeoContext } from '@/hooks/useGoldRatesSeoContext'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchGoldRatesAds,
  fetchKeralaGoldRates,
  fetchKeralaGoldRatesDaily,
  fetchKeralaGoldRatesHistory,
  type GoldRatesAdsPayload,
  type KeralaGoldRatesDailyRow,
  type KeralaGoldRatesHistoryPayload,
  type KeralaGoldRatesPayload,
} from '@/lib/marketplaceApi'
import { publicRateSourceLabel } from '@/lib/publicRateLabels'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  goldRatesOgImage,
  goldRatesItemListJsonLd,
  goldRatesWebPageJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  PAGE_SEO,
  priceSpecificationJsonLd,
  webSiteJsonLd,
} from '@/lib/seo'
import { useLivePoll } from '@/lib/useLivePoll'
import { GoldJewelleryCalculator } from '@/features/goldRates/GoldJewelleryCalculator'
import '@/styles/gold-rates-page.css'

type HistoryRange = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '2y'
type ChartMetal = '22K' | '24K' | '18K' | 'silver999'

const CHART_PRESETS: { key: HistoryRange; label: string }[] = [
  { key: '1w', label: 'Weekly' },
  { key: '1m', label: 'Monthly' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
]

const METAL_LABELS: Record<ChartMetal, string> = {
  '22K': '22K Gold',
  '24K': '24K Gold',
  '18K': '18K Gold',
  silver999: 'Silver 999',
}

const METAL_TABS: { key: ChartMetal; label: string }[] = [
  { key: '22K', label: '22K' },
  { key: '24K', label: '24K' },
  { key: '18K', label: '18K' },
  { key: 'silver999', label: 'Silver' },
]

const SOVEREIGN_GRAMS = 8

function fmtInr(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function parseNum(s: string | number | undefined | null): number | null {
  if (s == null) return null
  const n = typeof s === 'number' ? s : Number.parseFloat(String(s))
  return Number.isFinite(n) ? n : null
}

function ChangeBadge({ changePct }: { changePct: string | null | undefined }) {
  const n = changePct != null ? Number.parseFloat(changePct) : NaN
  if (!Number.isFinite(n)) return <span className="gr-change gr-change--flat">—</span>
  const up = n >= 0
  return (
    <span className={`gr-change${up ? ' gr-change--up' : ' gr-change--down'}`}>
      {up ? '+' : ''}
      {n.toFixed(2)}%
    </span>
  )
}

function RateCard({
  title,
  perGram,
  changePct,
  accent,
}: {
  title: string
  perGram: number | null
  changePct?: string | null
  accent?: 'gold' | 'silver'
}) {
  const g8 = perGram != null ? perGram * SOVEREIGN_GRAMS : null
  const g10 = perGram != null ? perGram * 10 : null
  return (
    <article className={`gr-rate-card gr-rate-card--${accent ?? 'gold'}`}>
      <header className="gr-rate-card__head">
        <h3>{title}</h3>
        <ChangeBadge changePct={changePct} />
      </header>
      <p className="gr-rate-card__main">
        <span className="gr-rate-card__val">{perGram != null ? `₹${fmtInr(perGram, 2)}` : '—'}</span>
        <span className="gr-rate-card__unit">/ gram</span>
      </p>
      <ul className="gr-rate-card__extras">
        <li>
          <span>8 g (sovereign)</span>
          <strong>{g8 != null ? `₹${fmtInr(g8, 0)}` : '—'}</strong>
        </li>
        <li>
          <span>10 g</span>
          <strong>{g10 != null ? `₹${fmtInr(g10, 0)}` : '—'}</strong>
        </li>
      </ul>
    </article>
  )
}

export function GoldRatesPage() {
  const { t, locale } = usePublicLocale()
  const { seoPath, locale: routeLocale } = useGoldRatesSeoContext()
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(null)
  const [ads, setAds] = useState<GoldRatesAdsPayload | null>(null)
  const [historyRange, setHistoryRange] = useState<HistoryRange>('1m')
  const [chartMetal, setChartMetal] = useState<ChartMetal>('22K')
  const [history, setHistory] = useState<KeralaGoldRatesHistoryPayload | null>(null)
  const [dailyRows, setDailyRows] = useState<KeralaGoldRatesDailyRow[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [dailyLoading, setDailyLoading] = useState(false)

  const loadRates = useCallback(() => {
    void fetchKeralaGoldRates().then((payload) => {
      setRates((prev) => {
        const prev22 = prev?.gold?.['22K']
        const next22 = payload?.gold?.['22K']
        if (prev22 != null && next22 != null && Math.abs(prev22 - next22) > 0.005) {
          void fetchKeralaGoldRatesHistory(historyRange, chartMetal).then(setHistory)
        }
        return payload
      })
    })
  }, [historyRange, chartMetal])

  const refreshHistory = useCallback(() => {
    void fetchKeralaGoldRatesHistory(historyRange, chartMetal).then(setHistory)
  }, [historyRange, chartMetal])

  useEffect(() => {
    void fetchGoldRatesAds().then(setAds)
    loadRates()
  }, [loadRates])

  useLivePoll(loadRates, LIVE_PRICE_POLL_MS, true)

  const pageTitle =
    routeLocale === 'ml'
      ? t('goldRates.pageTitleMl')
      : ads?.page_title || t('goldRates.pageTitle')
  const pageDescription =
    routeLocale === 'ml'
      ? t('goldRates.pageDescriptionMl')
      : ads?.page_description || t('goldRates.pageDescription')
  const seoBase = PAGE_SEO['/gold-rates/kerala']

  const r22Live = useMemo(() => {
    const v = rates?.gold['22K']
    return v != null ? Number(v) : null
  }, [rates])
  const r24Live = useMemo(() => {
    const v = rates?.gold['24K']
    return v != null ? Number(v) : null
  }, [rates])
  const r18Live = useMemo(() => {
    const v = rates?.gold['18K']
    return v != null ? Number(v) : null
  }, [rates])

  const rate22ContextLine = useMemo(() => {
    const raw = rates?.daily_change?.['22K']?.change_pct
    if (raw == null) return t('goldRates.rateContextFallback')
    const pct = Number.parseFloat(raw)
    if (!Number.isFinite(pct)) return t('goldRates.rateContextFallback')
    if (Math.abs(pct) < 0.05) return t('goldRates.rateContextSteady')
    return pct > 0 ? t('goldRates.rateContextUp') : t('goldRates.rateContextDown')
  }, [rates, t])

  const jsonLd = useMemo(
    () => [
      organizationJsonLd(),
      webSiteJsonLd(),
      goldRatesWebPageJsonLd({
        title: pageTitle,
        description: pageDescription,
        path: '/gold-rates/kerala',
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      newsArticleJsonLd({
        headline: pageTitle,
        description: pageDescription,
        path: '/gold-rates/kerala',
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      goldRatesItemListJsonLd(),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Kerala gold rates', path: '/gold-rates/kerala' },
      ]),
      ...priceSpecificationJsonLd({ r22: r22Live, r24: r24Live, r18: r18Live, city: 'Kerala, India' }),
      faqJsonLd([
        { question: t('goldRates.faq1q'), answer: t('goldRates.faq1a') },
        { question: t('goldRates.faq2q'), answer: t('goldRates.faq2a') },
        { question: t('goldRates.faq3q'), answer: t('goldRates.faq3a') },
        { question: t('goldRates.faq4q'), answer: t('goldRates.faq4a') },
        { question: t('goldRates.faq5q'), answer: t('goldRates.faq5a') },
        { question: t('goldRates.faq6q'), answer: t('goldRates.faq6a') },
        { question: t('goldRates.faq7q'), answer: t('goldRates.faq7a') },
      ]),
    ],
    [pageTitle, pageDescription, rates, r22Live, r24Live, r18Live, t, locale],
  )

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    const id = window.setInterval(() => {
      refreshHistory()
    }, LIVE_PRICE_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshHistory])

  const loadDaily = useCallback(async (append: boolean) => {
    setDailyLoading(true)
    try {
      const offset = append ? dailyRows.length : 0
      const payload = await fetchKeralaGoldRatesDaily(30, offset)
      if (!payload) return
      setDailyTotal(payload.total)
      setDailyRows((prev) => (append ? [...prev, ...payload.rows] : payload.rows))
    } finally {
      setDailyLoading(false)
    }
  }, [dailyRows.length])

  useEffect(() => {
    void (async () => {
      setDailyLoading(true)
      try {
        const payload = await fetchKeralaGoldRatesDaily(30, 0)
        if (!payload) return
        setDailyTotal(payload.total)
        setDailyRows(payload.rows)
      } finally {
        setDailyLoading(false)
      }
    })()
  }, [])

  const livePrice = useMemo(() => {
    if (chartMetal === 'silver999') return parseNum(rates?.silver?.['999'])
    return parseNum(rates?.gold[chartMetal])
  }, [rates, chartMetal])

  const chartPoints = useMemo(
    () => buildGoldSpotPricePoints(history, livePrice),
    [history, livePrice],
  )

  const placements = ads?.placements ?? []
  const ad = (slot: string) =>
    findAdPlacement(placements, slot)

  const updatedLabel =
    rates?.source_updated_at || rates?.rate_date
      ? `${rates?.source_updated_at || rates?.rate_date}`
      : t('goldRates.updatedUnknown')

  return (
    <div className="gr-page">
      <SeoHead
        title={pageTitle}
        description={pageDescription}
        path={seoPath}
        keywords={seoBase.keywords}
        ogImage={goldRatesOgImage('Kerala Gold Rate Today')}
        jsonLd={jsonLd}
        locale={routeLocale}
      />
      <div className="container gr-page__hero">
        <nav className="gr-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden>›</span>
          <span>{t('goldRates.breadcrumb')}</span>
        </nav>
        <h1 className="gr-page__title">{t('goldRates.heading')}</h1>
        <p className="gr-page__sub">{t('goldRates.subheading')}</p>
        <p className="gr-page__meta">
          {t('goldRates.lastUpdated')}: <strong>{updatedLabel}</strong>
          {rates?.source || rates?.source_label ? (
            <>
              {' '}
              · {t('goldRates.source')}:{' '}
              <em>{publicRateSourceLabel(rates?.source, rates?.source_label)}</em>
            </>
          ) : null}
        </p>
      </div>

      <GoldRatesAdSlot
        placement={ad('top_banner')}
        adsenseClientId={ads?.adsense_client_id ?? ''}
        adsenseEnabled={ads?.adsense_enabled ?? false}
        className="container"
      />

      <div className="container gr-page__layout">
        <div className="gr-page__main">
          <section className="gr-section" aria-labelledby="gr-live-rates">
            <h2 id="gr-live-rates" className="gr-section__title">
              {t('goldRates.todayRates')}
            </h2>
            <div className="gr-rate-grid">
              <RateCard
                title="24K Gold"
                perGram={parseNum(rates?.gold['24K'])}
                changePct={rates?.daily_change?.['24K']?.change_pct}
              />
              <RateCard
                title="22K Gold (916)"
                perGram={parseNum(rates?.gold['22K'])}
                changePct={rates?.daily_change?.['22K']?.change_pct}
              />
              <RateCard
                title="18K Gold"
                perGram={parseNum(rates?.gold['18K'])}
                changePct={rates?.daily_change?.['18K']?.change_pct}
              />
              <RateCard
                title="Silver 999"
                perGram={parseNum(rates?.silver?.['999'])}
                changePct={rates?.daily_change?.silver999?.change_pct}
                accent="silver"
              />
            </div>
            <p className="gr-rate-context">{rate22ContextLine}</p>
            <p className="gr-disclaimer">{t('goldRates.disclaimer')}</p>
          </section>

          <GoldRatesAdSlot
            placement={ad('in_content_1')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
          />

          <section className="gr-section gr-section--chart" aria-labelledby="gr-chart">
            <div className="gr-section__head-row">
              <div>
                <h2 id="gr-chart" className="gr-section__title">
                  {t('goldRates.priceChart')}
                </h2>
                <p className="gr-section__chart-lead">{t('goldRates.chartLead')}</p>
              </div>
              <div className="gr-tabs" role="tablist" aria-label={t('goldRates.metalTabs')}>
                {METAL_TABS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={chartMetal === m.key}
                    className={`gr-tab${chartMetal === m.key ? ' gr-tab--active' : ''}`}
                    onClick={() => setChartMetal(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="gr-ranges" role="group" aria-label={t('goldRates.chartRange')}>
              <button
                type="button"
                className={`gr-range${historyRange === '1d' ? ' gr-range--active' : ''}`}
                aria-pressed={historyRange === '1d'}
                onClick={() => setHistoryRange('1d')}
              >
                1D
              </button>
              {CHART_PRESETS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`gr-range${historyRange === r.key ? ' gr-range--active' : ''}`}
                  aria-pressed={historyRange === r.key}
                  onClick={() => setHistoryRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="gr-chart-wrap">
              {chartPoints.length >= 2 ? (
                <GoldRatesPriceChart
                  points={chartPoints}
                  granularity={history?.granularity === 'intraday' ? 'intraday' : 'daily'}
                  metalLabel={METAL_LABELS[chartMetal]}
                  rangeLabel={historyRange === '1d' ? '1D' : CHART_PRESETS.find((p) => p.key === historyRange)?.label ?? historyRange.toUpperCase()}
                  ariaLabel={`${METAL_LABELS[chartMetal]} Kerala rate chart, ${historyRange} range`}
                />
              ) : (
                <p className="gr-chart-empty">{t('goldRates.chartEmpty')}</p>
              )}
            </div>
            {history?.note ? <p className="gr-chart-note">{history.note}</p> : null}
          </section>

          <GoldRatesAdSlot
            placement={ad('in_content_2')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
          />

          <GoldJewelleryCalculator rates={rates} />
          <p className="gr-section__lead">
            <Link to="/gold-calculator">{t('goldRates.calculatorDedicatedCta')}</Link>
          </p>

          <section className="gr-section" aria-labelledby="gr-history-table">
            <h2 id="gr-history-table" className="gr-section__title">
              {t('goldRates.historyTable')}
            </h2>
            <p className="gr-section__lead">{t('goldRates.historyTableLead')}</p>
            <div className="gr-table-wrap">
              <table className="gr-table">
                <thead>
                  <tr>
                    <th>{t('goldRates.colDate')}</th>
                    <th>24K</th>
                    <th>22K</th>
                    <th>18K</th>
                    <th>{t('goldRates.colSilver')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.gold_24k ? `₹${fmtInr(Number.parseFloat(row.gold_24k), 2)}` : '—'}</td>
                      <td>{row.gold_22k ? `₹${fmtInr(Number.parseFloat(row.gold_22k), 2)}` : '—'}</td>
                      <td>{row.gold_18k ? `₹${fmtInr(Number.parseFloat(row.gold_18k), 2)}` : '—'}</td>
                      <td>
                        {row.silver_999 ? `₹${fmtInr(Number.parseFloat(row.silver_999), 2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dailyRows.length < dailyTotal ? (
              <button
                type="button"
                className="btn btn-ghost gr-load-more"
                disabled={dailyLoading}
                onClick={() => void loadDaily(true)}
              >
                {dailyLoading ? t('goldRates.loading') : t('goldRates.loadMore')}
              </button>
            ) : null}
          </section>

          <GoldRatesCityLinks />

          <section className="gr-section gr-faq" aria-labelledby="gr-faq">
            <h2 id="gr-faq" className="gr-section__title">
              {t('goldRates.faqTitle')}
            </h2>
            <dl className="gr-faq__list">
              <div>
                <dt>{t('goldRates.faq1q')}</dt>
                <dd>{t('goldRates.faq1a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq2q')}</dt>
                <dd>{t('goldRates.faq2a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq3q')}</dt>
                <dd>{t('goldRates.faq3a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq4q')}</dt>
                <dd>{t('goldRates.faq4a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq5q')}</dt>
                <dd>{t('goldRates.faq5a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq6q')}</dt>
                <dd>{t('goldRates.faq6a')}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq7q')}</dt>
                <dd>{t('goldRates.faq7a')}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="gr-page__sidebar" aria-label={t('goldRates.sidebar')}>
          <GoldRatesAdSlot
            placement={ad('sidebar')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
          />
          <div className="gr-sidebar-card">
            <h3>{t('goldRates.sidebarCridora')}</h3>
            <p>{t('goldRates.sidebarCridoraBody')}</p>
            <Link to="/signup" className="btn btn-gold btn-sm">
              {t('nav.signUp')}
            </Link>
            <Link to="/marketplace" className="btn btn-ghost btn-sm">
              {t('nav.products')}
            </Link>
            <Link to="/gold-calculator" className="btn btn-ghost btn-sm">
              {t('nav.goldCalculator')}
            </Link>
            <Link to="/gold-rates/india" className="btn btn-ghost btn-sm">
              {t('goldRatesIndia.breadcrumb')}
            </Link>
          </div>
        </aside>
      </div>

      <GoldRatesAdSlot
        placement={ad('footer')}
        adsenseClientId={ads?.adsense_client_id ?? ''}
        adsenseEnabled={ads?.adsense_enabled ?? false}
        className="container"
      />
    </div>
  )
}
