import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoldRatesCityLinks } from '@/components/GoldRatesCityLinks'
import { SeoHead } from '@/components/SeoHead'
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
  newsArticleJsonLd,
  organizationJsonLd,
  goldRatesOgImage,
  PAGE_SEO,
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

export function GoldRatesIndiaPage() {
  const { t } = usePublicLocale()
  const { seoPath, locale: routeLocale } = useGoldRatesSeoContext()
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(null)
  const seo = PAGE_SEO['/gold-rates/india']
  const pageTitle = routeLocale === 'ml' ? t('goldRatesIndia.pageTitleMl') : seo.title
  const pageDescription = routeLocale === 'ml' ? t('goldRatesIndia.pageDescriptionMl') : seo.description

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
        path: seo.path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      newsArticleJsonLd({
        headline: pageTitle,
        description: pageDescription,
        path: seo.path,
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Gold rates India', path: '/gold-rates/india' },
      ]),
      faqJsonLd([
        { question: t('goldRatesIndia.faq1q'), answer: t('goldRatesIndia.faq1a') },
        { question: t('goldRatesIndia.faq2q'), answer: t('goldRatesIndia.faq2a') },
        { question: t('goldRatesIndia.faq3q'), answer: t('goldRatesIndia.faq3a') },
      ]),
    ],
    [pageTitle, pageDescription, seo, rates, t],
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
        keywords={seo.keywords}
        ogImage={goldRatesOgImage('Gold Rate India Today')}
        jsonLd={jsonLd}
        locale={routeLocale}
      />

      <div className="container gr-page__hero">
        <nav className="gr-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden>›</span>
          <span>{t('goldRatesIndia.breadcrumb')}</span>
        </nav>
        <h1 className="gr-page__title">{t('goldRatesIndia.heading')}</h1>
        <p className="gr-page__sub">{t('goldRatesIndia.subheading')}</p>
        <p className="gr-page__meta">
          {t('goldRates.lastUpdated')}:{' '}
          <strong>{rates?.source_updated_at || rates?.rate_date || t('goldRates.updatedUnknown')}</strong>
        </p>
      </div>

      <div className="container gr-page__layout">
        <div className="gr-page__main">
          <section className="gr-section" aria-labelledby="gr-india-live">
            <h2 id="gr-india-live" className="gr-section__title">
              {t('goldRatesIndia.todayRates')}
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
            <p className="gr-disclaimer">{t('goldRates.disclaimer')}</p>
          </section>

          <section className="gr-section" aria-labelledby="gr-india-kerala">
            <h2 id="gr-india-kerala" className="gr-section__title">
              {t('goldRatesIndia.keralaSection')}
            </h2>
            <p className="gr-section__lead">{t('goldRatesIndia.keralaLead')}</p>
            <Link to="/gold-rates/kerala" className="btn btn-gold">
              {t('goldRatesIndia.keralaCta')}
            </Link>
          </section>

          <GoldRatesCityLinks />

          <section className="gr-section gr-faq" aria-labelledby="gr-india-faq">
            <h2 id="gr-india-faq" className="gr-section__title">
              {t('goldRates.faqTitle')}
            </h2>
            <dl className="gr-faq__list">
              <div>
                <dt>{t('goldRatesIndia.faq1q')}</dt>
                <dd>{t('goldRatesIndia.faq1a')}</dd>
              </div>
              <div>
                <dt>{t('goldRatesIndia.faq2q')}</dt>
                <dd>{t('goldRatesIndia.faq2a')}</dd>
              </div>
              <div>
                <dt>{t('goldRatesIndia.faq3q')}</dt>
                <dd>{t('goldRatesIndia.faq3a')}</dd>
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
            <Link to="/gold-rates/kerala" className="btn btn-ghost btn-sm">
              {t('nav.goldRates')}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
