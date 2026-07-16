import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GoldRatesCityLinks } from '@/components/GoldRatesCityLinks'
import { SeoHead } from '@/components/SeoHead'
import {
  buildCityPageSeo,
  GOLD_RATE_CITY_BY_SLUG,
  goldRateCityPath,
  isGoldRateCitySlug,
} from '@/content/goldRateCities'
import {
  INDIA_GOLD_RATE_CITY_BY_SLUG,
  buildIndiaCityPageSeo,
  isIndiaGoldRateCitySlug,
} from '@/content/indiaGoldRateCities'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { useGoldRatesSeoContext } from '@/hooks/useGoldRatesSeoContext'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchKeralaGoldRates,
  getCachedKeralaGoldRates,
  type KeralaGoldRatesPayload,
} from '@/lib/marketplaceApi'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  goldRatesWebPageJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  goldRatesOgImage,
  webSiteJsonLd,
} from '@/lib/seo'
import { useLivePoll } from '@/lib/useLivePoll'
import '@/styles/gold-rates-page.css'

function fmtInr(n: number, digits = 2): string {
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

function GoldRatesCityPageInner({ citySlug }: { citySlug: string }) {
  const { t, locale } = usePublicLocale()
  const { seoPath, locale: routeLocale } = useGoldRatesSeoContext()
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(() => getCachedKeralaGoldRates())

  const city = GOLD_RATE_CITY_BY_SLUG[citySlug]
  const path = goldRateCityPath(city.slug)
  const seoStatic = buildCityPageSeo(city)
  const cityLabel = locale === 'ml' ? city.nameMl : city.nameEn

  const pageTitle =
    routeLocale === 'ml'
      ? t('goldRatesCity.pageTitleMl', { city: city.nameMl })
      : t('goldRatesCity.pageTitle', { city: city.nameEn })
  const pageDescription =
    routeLocale === 'ml'
      ? t('goldRatesCity.pageDescriptionMl', { city: city.nameMl, goldPrice: city.goldPriceMl })
      : t('goldRatesCity.pageDescription', { city: city.nameEn })

  const loadRates = useCallback(() => {
    void fetchKeralaGoldRates().then((payload) => {
      setRates((prev) => payload ?? prev)
    })
  }, [])

  useEffect(() => {
    loadRates()
  }, [loadRates])

  useLivePoll(loadRates, LIVE_PRICE_POLL_MS, true)

  const r22 = parseNum(rates?.gold['22K'])
  const r24 = parseNum(rates?.gold['24K'])
  const r18 = parseNum(rates?.gold['18K'])
  const silver = parseNum(rates?.silver?.['999'])

  const jsonLd = useMemo(
    () => [
      organizationJsonLd(),
      webSiteJsonLd(),
      goldRatesWebPageJsonLd({
        title: pageTitle,
        description: pageDescription,
        path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      newsArticleJsonLd({
        headline: `${city.nameEn} Gold Rate Today — Live Kerala Board Rates`,
        description: pageDescription,
        path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Kerala gold rates', path: '/gold-rates/kerala' },
        { name: `${city.nameEn} gold rate`, path },
      ]),
      faqJsonLd([
        {
          question: t('goldRatesCity.faq1q', { city: city.nameEn }),
          answer: t('goldRatesCity.faq1a', { city: city.nameEn }),
        },
        { question: t('goldRates.faq2q'), answer: t('goldRates.faq2a') },
        { question: t('goldRatesCity.faq3q', { city: city.nameEn }), answer: t('goldRatesCity.faq3a') },
        { question: t('goldRates.faq4q'), answer: t('goldRates.faq4a') },
        { question: t('goldRates.faq5q'), answer: t('goldRates.faq5a') },
        { question: t('goldRates.faq6q'), answer: t('goldRates.faq6a') },
      ]),
    ],
    [pageTitle, pageDescription, path, rates, city, r22, r24, r18, t],
  )

  return (
    <div className="gr-page">
      <SeoHead
        title={pageTitle}
        description={pageDescription}
        path={seoPath}
        keywords={seoStatic.keywords}
        ogImage={goldRatesOgImage(`${city.nameEn} Gold Rate Today`)}
        jsonLd={jsonLd}
        locale={routeLocale}
      />

      <div className="container gr-page__hero">
        <nav className="gr-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden>›</span>
          <Link to="/gold-rates/kerala">{t('goldRates.breadcrumb')}</Link>
          <span aria-hidden>›</span>
          <span>{cityLabel}</span>
        </nav>
        <h1 className="gr-page__title">
          {locale === 'ml'
            ? t('goldRatesCity.headingMl', { city: city.nameMl, goldPrice: city.goldPriceMl })
            : t('goldRatesCity.heading', { city: city.nameEn })}
        </h1>
        <p className="gr-page__sub">
          {t('goldRatesCity.subheading', { city: city.nameEn, cityMl: city.nameMl })}
        </p>
        {locale === 'ml' ? (
          <p className="gr-page__meta gr-page__meta--ml" lang="ml">
            {city.goldPriceMl} · {t('goldRates.lastUpdated')}:{' '}
            <strong>{rates?.source_updated_at || rates?.rate_date || t('goldRates.updatedUnknown')}</strong>
          </p>
        ) : null}
        <p className="gr-page__meta">
          {t('goldRates.lastUpdated')}:{' '}
          <strong>{rates?.source_updated_at || rates?.rate_date || t('goldRates.updatedUnknown')}</strong>
        </p>
      </div>

      <div className="container gr-page__layout">
        <div className="gr-page__main">
          <section className="gr-section" aria-labelledby="gr-city-live">
            <h2 id="gr-city-live" className="gr-section__title">
              {t('goldRatesCity.todayRates', { city: city.nameEn })}
            </h2>
            <div className="gr-rate-grid">
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>24K Gold</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r24 != null ? `₹${fmtInr(r24)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>22K Gold (916)</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r22 != null ? `₹${fmtInr(r22)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>18K Gold</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r18 != null ? `₹${fmtInr(r18)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--silver">
                <header className="gr-rate-card__head"><h3>Silver 999</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{silver != null ? `₹${fmtInr(silver)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
            </div>
            <p className="gr-disclaimer">{t('goldRatesCity.cityDisclaimer', { city: city.nameEn })}</p>
          </section>

          <section className="gr-section" aria-labelledby="gr-city-detail">
            <h2 id="gr-city-detail" className="gr-section__title">
              {t('goldRatesCity.detailSection', { city: city.nameEn })}
            </h2>
            <p className="gr-section__lead">{t('goldRatesCity.detailLead', { city: city.nameEn })}</p>
            <div className="gr-section__actions">
              <Link to="/gold-rates/kerala" className="btn btn-gold">
                {t('goldRatesCity.keralaChartsCta')}
              </Link>
              <Link to="/gold-calculator" className="btn btn-ghost">
                {t('nav.goldCalculator')}
              </Link>
            </div>
          </section>

          <GoldRatesCityLinks titleKey="goldRatesCity.linksTitleCompact" />

          <section className="gr-section gr-faq" aria-labelledby="gr-city-faq">
            <h2 id="gr-city-faq" className="gr-section__title">{t('goldRates.faqTitle')}</h2>
            <dl className="gr-faq__list">
              <div>
                <dt>{t('goldRatesCity.faq1q', { city: city.nameEn })}</dt>
                <dd>{t('goldRatesCity.faq1a', { city: city.nameEn })}</dd>
              </div>
              <div>
                <dt>{t('goldRates.faq2q')}</dt>
                <dd>{t('goldRates.faq2a')}</dd>
              </div>
              <div>
                <dt>{t('goldRatesCity.faq3q', { city: city.nameEn })}</dt>
                <dd>{t('goldRatesCity.faq3a')}</dd>
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
            </dl>
          </section>
        </div>

        <aside className="gr-page__sidebar" aria-label={t('goldRates.sidebar')}>
          <div className="gr-sidebar-card">
            <h3>{t('goldRates.sidebarCridora')}</h3>
            <p>{t('goldRates.sidebarCridoraBody')}</p>
            <Link to="/signup" className="btn btn-gold btn-sm">{t('nav.signUp')}</Link>
            <Link to="/jewellers" className="btn btn-ghost btn-sm">{t('nav.jewellers')}</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function GoldRatesIndiaCityPageInner({ citySlug }: { citySlug: string }) {
  const { t } = usePublicLocale()
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(() => getCachedKeralaGoldRates())

  const city = INDIA_GOLD_RATE_CITY_BY_SLUG[citySlug]
  const path = `/gold-rates/${city.slug}`
  const seoStatic = buildIndiaCityPageSeo(city)

  const loadRates = useCallback(() => {
    void fetchKeralaGoldRates().then((payload) => {
      setRates((prev) => payload ?? prev)
    })
  }, [])

  useEffect(() => { loadRates() }, [loadRates])
  useLivePoll(loadRates, LIVE_PRICE_POLL_MS, true)

  const r22 = parseNum(rates?.gold['22K'])
  const r24 = parseNum(rates?.gold['24K'])
  const r18 = parseNum(rates?.gold['18K'])
  const silver = parseNum(rates?.silver?.['999'])

  const altNote = city.altName ? ` (${city.altName})` : ''

  const jsonLd = useMemo(
    () => [
      organizationJsonLd(),
      webSiteJsonLd(),
      goldRatesWebPageJsonLd({
        title: seoStatic.title,
        description: seoStatic.description,
        path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      newsArticleJsonLd({
        headline: `${city.nameEn} Gold Rate Today — Live 22K 24K Price`,
        description: seoStatic.description,
        path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Gold rate India', path: '/gold-rates/india' },
        { name: `${city.nameEn} gold rate`, path },
      ]),
      faqJsonLd([
        {
          question: `What is the gold rate in ${city.nameEn} today?`,
          answer: `Today's gold rate in ${city.nameEn}, ${city.state} per gram: 22K (916) gold is ₹${r22 != null ? r22.toFixed(2) : '—'}/g and 24K gold is ₹${r24 != null ? r24.toFixed(2) : '—'}/g based on live India reference rates. Actual jewellery prices in ${city.nameEn} may include making charges and GST.`,
        },
        { question: t('goldRates.faq2q'), answer: t('goldRates.faq2a') },
        {
          question: `How does gold rate in ${city.nameEn} compare to other cities?`,
          answer: `Gold rates in ${city.nameEn} and across India are primarily set by MCX (Multi Commodity Exchange) and major jeweller associations. Prices are nearly identical across all Indian cities with minor regional variations in making charges and local demand.`,
        },
        { question: t('goldRates.faq4q'), answer: t('goldRates.faq4a') },
        { question: t('goldRates.faq5q'), answer: t('goldRates.faq5a') },
        { question: t('goldRates.faq6q'), answer: t('goldRates.faq6a') },
        { question: t('goldRates.faq7q'), answer: t('goldRates.faq7a') },
        {
          question: `Where can I buy gold in ${city.nameEn}?`,
          answer: `You can buy gold jewellery from verified jewellers in ${city.nameEn} through Cridora India. Compare live gold rates, calculate jewellery prices with GST, and track your purchases digitally.`,
        },
      ]),
    ],
    [seoStatic, path, rates, city, r22, r24, r18, t],
  )

  return (
    <div className="gr-page">
      <SeoHead
        title={seoStatic.title}
        description={seoStatic.description}
        path={path}
        keywords={seoStatic.keywords}
        ogImage={goldRatesOgImage(`${city.nameEn} Gold Rate Today`)}
        jsonLd={jsonLd}
        noindex={seoStatic.noindex}
      />

      <div className="container gr-page__hero">
        <nav className="gr-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden>›</span>
          <Link to="/gold-rates/india">Gold rate India</Link>
          <span aria-hidden>›</span>
          <span>{city.nameEn}</span>
        </nav>
        <h1 className="gr-page__title">{city.nameEn} Gold Rate Today{altNote}</h1>
        <p className="gr-page__sub">
          Live gold and silver rate in {city.nameEn}, {city.state} — 22K, 24K, 18K per gram.
          Jewellery calculator with GST included.
        </p>
        <p className="gr-page__meta">
          {t('goldRates.lastUpdated')}:{' '}
          <strong>{rates?.source_updated_at || rates?.rate_date || t('goldRates.updatedUnknown')}</strong>
        </p>
      </div>

      <div className="container gr-page__layout">
        <div className="gr-page__main">
          <section className="gr-section" aria-labelledby="gr-india-city-live">
            <h2 id="gr-india-city-live" className="gr-section__title">
              Today's gold rate in {city.nameEn} (₹ per gram)
            </h2>
            <div className="gr-rate-grid">
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>24K Gold</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r24 != null ? `₹${fmtInr(r24)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
                <ul className="gr-rate-card__extras">
                  <li><span>8 g (sovereign)</span><strong>{r24 != null ? `₹${fmtInr(r24 * 8, 0)}` : '—'}</strong></li>
                  <li><span>10 g</span><strong>{r24 != null ? `₹${fmtInr(r24 * 10, 0)}` : '—'}</strong></li>
                </ul>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>22K Gold (916)</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r22 != null ? `₹${fmtInr(r22)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
                <ul className="gr-rate-card__extras">
                  <li><span>8 g (sovereign)</span><strong>{r22 != null ? `₹${fmtInr(r22 * 8, 0)}` : '—'}</strong></li>
                  <li><span>10 g</span><strong>{r22 != null ? `₹${fmtInr(r22 * 10, 0)}` : '—'}</strong></li>
                </ul>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head"><h3>18K Gold</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r18 != null ? `₹${fmtInr(r18)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--silver">
                <header className="gr-rate-card__head"><h3>Silver 999</h3></header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{silver != null ? `₹${fmtInr(silver)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
            </div>
            <p className="gr-disclaimer">
              Indicative gold rate based on India reference prices (MCX/Kerala board). Jeweller showroom
              prices in {city.nameEn} include making charges, wastage, and GST.{' '}
              <Link to="/gold-calculator">Use our calculator</Link> for final estimates.
            </p>
          </section>

          <section className="gr-section" aria-labelledby="gr-india-city-about">
            <h2 id="gr-india-city-about" className="gr-section__title">
              {city.nameEn} gold rate — charts &amp; full history
            </h2>
            <p className="gr-section__lead">
              View interactive 22K and 24K gold price charts, up to 2-year daily history, and a free
              jewellery calculator with GST on our full gold rates page.
            </p>
            <div className="gr-section__actions">
              <Link to="/gold-rates/india" className="btn btn-gold">India gold rate</Link>
              <Link to="/gold-calculator" className="btn btn-ghost">{t('nav.goldCalculator')}</Link>
            </div>
          </section>

          <GoldRatesCityLinks showIndiaCities />

          <section className="gr-section gr-faq" aria-labelledby="gr-india-city-faq">
            <h2 id="gr-india-city-faq" className="gr-section__title">{t('goldRates.faqTitle')}</h2>
            <dl className="gr-faq__list">
              <div>
                <dt>What is the gold rate in {city.nameEn} today?</dt>
                <dd>
                  Today&apos;s gold rate in {city.nameEn}, {city.state}: 22K (916 BIS) is{' '}
                  <strong>{r22 != null ? `₹${fmtInr(r22)}/g` : '—'}</strong> and 24K is{' '}
                  <strong>{r24 != null ? `₹${fmtInr(r24)}/g` : '—'}</strong>. Rates are live and updated every
                  few minutes.
                </dd>
              </div>
              <div>
                <dt>{t('goldRates.faq2q')}</dt>
                <dd>{t('goldRates.faq2a')}</dd>
              </div>
              <div>
                <dt>How is gold price determined in {city.nameEn}?</dt>
                <dd>
                  Gold prices in {city.nameEn} and across India are primarily determined by MCX (Multi
                  Commodity Exchange) spot prices, international London Bullion Market rates, and
                  USD/INR exchange rate. Local jeweller associations may set daily board rates adding
                  minor regional premiums.
                </dd>
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
          <div className="gr-sidebar-card">
            <h3>{t('goldRates.sidebarCridora')}</h3>
            <p>{t('goldRates.sidebarCridoraBody')}</p>
            <Link to="/signup" className="btn btn-gold btn-sm">{t('nav.signUp')}</Link>
            <Link to="/gold-rates/india" className="btn btn-ghost btn-sm">India gold rates</Link>
            <Link to="/gold-calculator" className="btn btn-ghost btn-sm">{t('nav.goldCalculator')}</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function GoldRatesCityPage() {
  const { citySlug } = useParams<{ citySlug: string }>()
  if (isGoldRateCitySlug(citySlug)) {
    return <GoldRatesCityPageInner citySlug={citySlug} />
  }
  if (isIndiaGoldRateCitySlug(citySlug)) {
    return <GoldRatesIndiaCityPageInner citySlug={citySlug} />
  }
  return <Navigate to="/gold-rates/india" replace />
}
