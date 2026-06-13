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
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { useGoldRatesSeoContext } from '@/hooks/useGoldRatesSeoContext'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchKeralaGoldRates,
  type KeralaGoldRatesPayload,
} from '@/lib/marketplaceApi'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  goldRatesWebPageJsonLd,
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
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(null)

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
    void fetchKeralaGoldRates().then(setRates)
  }, [])

  useEffect(() => {
    loadRates()
  }, [loadRates])

  useLivePoll(loadRates, LIVE_PRICE_POLL_MS, true)

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
        {
          question: t('goldRates.faq2q'),
          answer: t('goldRates.faq2a'),
        },
        {
          question: t('goldRatesCity.faq3q', { city: city.nameEn }),
          answer: t('goldRatesCity.faq3a'),
        },
      ]),
    ],
    [pageTitle, pageDescription, path, rates, city, t],
  )

  const r22 = parseNum(rates?.gold['22K'])
  const r24 = parseNum(rates?.gold['24K'])
  const r18 = parseNum(rates?.gold['18K'])
  const silver = parseNum(rates?.silver?.['999'])

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
                <header className="gr-rate-card__head">
                  <h3>24K Gold</h3>
                </header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r24 != null ? `₹${fmtInr(r24)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head">
                  <h3>22K Gold (916)</h3>
                </header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r22 != null ? `₹${fmtInr(r22)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--gold">
                <header className="gr-rate-card__head">
                  <h3>18K Gold</h3>
                </header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r18 != null ? `₹${fmtInr(r18)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
              <article className="gr-rate-card gr-rate-card--silver">
                <header className="gr-rate-card__head">
                  <h3>Silver 999</h3>
                </header>
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
            <Link to="/gold-rates/kerala" className="btn btn-gold">
              {t('goldRatesCity.keralaChartsCta')}
            </Link>
          </section>

          <GoldRatesCityLinks titleKey="goldRatesCity.linksTitleCompact" />

          <section className="gr-section gr-faq" aria-labelledby="gr-city-faq">
            <h2 id="gr-city-faq" className="gr-section__title">
              {t('goldRates.faqTitle')}
            </h2>
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
            </dl>
          </section>
        </div>

        <aside className="gr-page__sidebar" aria-label={t('goldRates.sidebar')}>
          <div className="gr-sidebar-card">
            <h3>{t('goldRates.sidebarCridora')}</h3>
            <p>{t('goldRates.sidebarCridoraBody')}</p>
            <Link to="/signup" className="btn btn-gold btn-sm">
              {t('nav.signUp')}
            </Link>
            <Link to="/jewellers" className="btn btn-ghost btn-sm">
              {t('nav.jewellers')}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function GoldRatesCityPage() {
  const { citySlug } = useParams<{ citySlug: string }>()
  if (!isGoldRateCitySlug(citySlug)) {
    return <Navigate to="/gold-rates/kerala" replace />
  }
  return <GoldRatesCityPageInner citySlug={citySlug} />
}
