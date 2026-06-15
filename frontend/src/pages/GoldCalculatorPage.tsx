import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeoHead } from '@/components/SeoHead'
import { findAdPlacement, GoldRatesAdSlot } from '@/features/goldRates/GoldRatesAdSlot'
import { GOLD_CALCULATOR_AD_SLOT_SPECS } from '@/features/goldRates/goldCalculatorAdSpecs'
import { GoldJewelleryCalculator } from '@/features/goldRates/GoldJewelleryCalculator'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { useGoldRatesSeoContext } from '@/hooks/useGoldRatesSeoContext'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchGoldCalculatorAds,
  fetchKeralaGoldRates,
  type GoldRatesAdsPayload,
  type KeralaGoldRatesPayload,
} from '@/lib/marketplaceApi'
import { publicRateSourceLabel } from '@/lib/publicRateLabels'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  goldCalculatorHowToJsonLd,
  goldCalculatorWebAppJsonLd,
  goldRatesOgImage,
  goldRatesWebPageJsonLd,
  organizationJsonLd,
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

export function GoldCalculatorPage() {
  const { t } = usePublicLocale()
  const { seoPath, locale: routeLocale } = useGoldRatesSeoContext()
  const [rates, setRates] = useState<KeralaGoldRatesPayload | null>(null)
  const [ads, setAds] = useState<GoldRatesAdsPayload | null>(null)
  const seo = PAGE_SEO['/gold-calculator']

  const pageTitle =
    routeLocale === 'ml'
      ? t('goldCalculator.pageTitleMl')
      : ads?.page_title || seo.title
  const pageDescription =
    routeLocale === 'ml'
      ? t('goldCalculator.pageDescriptionMl')
      : ads?.page_description || seo.description

  const loadRates = useCallback(() => {
    void fetchKeralaGoldRates().then(setRates)
  }, [])

  useEffect(() => {
    void fetchGoldCalculatorAds().then(setAds)
    loadRates()
  }, [loadRates])

  useLivePoll(loadRates, LIVE_PRICE_POLL_MS, true)

  const jsonLd = useMemo(
    () => [
      organizationJsonLd(),
      webSiteJsonLd(),
      goldCalculatorWebAppJsonLd(seoPath),
      goldCalculatorHowToJsonLd(),
      goldRatesWebPageJsonLd({
        title: pageTitle,
        description: pageDescription,
        path: '/gold-calculator',
        dateModified: rates?.source_updated_at ?? rates?.rate_date ?? undefined,
      }),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Gold calculator', path: '/gold-calculator' },
      ]),
      faqJsonLd([
        { question: t('goldCalculator.faq1q'), answer: t('goldCalculator.faq1a') },
        { question: t('goldCalculator.faq2q'), answer: t('goldCalculator.faq2a') },
        { question: t('goldCalculator.faq3q'), answer: t('goldCalculator.faq3a') },
        { question: t('goldCalculator.faq4q'), answer: t('goldCalculator.faq4a') },
      ]),
    ],
    [pageTitle, pageDescription, seoPath, rates, t],
  )

  const placements = ads?.placements ?? []
  const ad = (slot: string) => findAdPlacement(placements, slot)

  const r22 = parseNum(rates?.gold['22K'])
  const r24 = parseNum(rates?.gold['24K'])

  return (
    <div className="gr-page">
      <SeoHead
        title={pageTitle}
        description={pageDescription}
        path={seoPath}
        keywords={seo.keywords}
        ogImage={goldRatesOgImage('Gold Calculator India')}
        jsonLd={jsonLd}
        locale={routeLocale}
      />

      <div className="container gr-page__hero">
        <nav className="gr-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden>›</span>
          <span>{t('goldCalculator.breadcrumb')}</span>
        </nav>
        <h1 className="gr-page__title">{t('goldCalculator.heading')}</h1>
        <p className="gr-page__sub">{t('goldCalculator.subheading')}</p>
        <p className="gr-page__meta">
          {t('goldRates.lastUpdated')}:{' '}
          <strong>{rates?.source_updated_at || rates?.rate_date || t('goldRates.updatedUnknown')}</strong>
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
        slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
      />

      <div className="container gr-page__layout">
        <div className="gr-page__main">
          <GoldJewelleryCalculator rates={rates} sectionId="gr-calculator-main" showHeading={false} />

          <GoldRatesAdSlot
            placement={ad('in_content_1')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
            slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
          />

          <section className="gr-section" aria-labelledby="gr-calc-live-rates">
            <h2 id="gr-calc-live-rates" className="gr-section__title">
              {t('goldCalculator.liveRatesTitle')}
            </h2>
            <p className="gr-section__lead">{t('goldCalculator.liveRatesLead')}</p>
            <div className="gr-rate-grid">
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
                  <h3>24K Gold</h3>
                </header>
                <p className="gr-rate-card__main">
                  <span className="gr-rate-card__val">{r24 != null ? `₹${fmtInr(r24)}` : '—'}</span>
                  <span className="gr-rate-card__unit">/ gram</span>
                </p>
              </article>
            </div>
            <Link to="/gold-rates/kerala" className="btn btn-gold">
              {t('goldCalculator.keralaRatesCta')}
            </Link>
          </section>

          <GoldRatesAdSlot
            placement={ad('in_content_2')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
            slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
          />

          <section className="gr-section" aria-labelledby="gr-calc-howto">
            <h2 id="gr-calc-howto" className="gr-section__title">
              {t('goldCalculator.howToTitle')}
            </h2>
            <ol className="gr-faq__list" style={{ listStyle: 'decimal', paddingLeft: '1.25rem' }}>
              <li>{t('goldCalculator.howTo1')}</li>
              <li>{t('goldCalculator.howTo2')}</li>
              <li>{t('goldCalculator.howTo3')}</li>
              <li>{t('goldCalculator.howTo4')}</li>
            </ol>
          </section>

          <section className="gr-section gr-faq" aria-labelledby="gr-calc-faq">
            <h2 id="gr-calc-faq" className="gr-section__title">
              {t('goldRates.faqTitle')}
            </h2>
            <dl className="gr-faq__list">
              <div>
                <dt>{t('goldCalculator.faq1q')}</dt>
                <dd>{t('goldCalculator.faq1a')}</dd>
              </div>
              <div>
                <dt>{t('goldCalculator.faq2q')}</dt>
                <dd>{t('goldCalculator.faq2a')}</dd>
              </div>
              <div>
                <dt>{t('goldCalculator.faq3q')}</dt>
                <dd>{t('goldCalculator.faq3a')}</dd>
              </div>
              <div>
                <dt>{t('goldCalculator.faq4q')}</dt>
                <dd>{t('goldCalculator.faq4a')}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="gr-page__sidebar" aria-label={t('goldRates.sidebar')}>
          <GoldRatesAdSlot
            placement={ad('sidebar')}
            adsenseClientId={ads?.adsense_client_id ?? ''}
            adsenseEnabled={ads?.adsense_enabled ?? false}
            slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
          />
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

      <GoldRatesAdSlot
        placement={ad('footer')}
        adsenseClientId={ads?.adsense_client_id ?? ''}
        adsenseEnabled={ads?.adsense_enabled ?? false}
        className="container"
        slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
      />
    </div>
  )
}
