import { Link } from 'react-router-dom'
import { GOLD_RATE_CITIES, goldRateCityPath } from '@/content/goldRateCities'
import { INDIA_GOLD_RATE_CITIES } from '@/content/indiaGoldRateCities'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

type Props = {
  titleKey?: 'goldRatesCity.linksTitle' | 'goldRatesCity.linksTitleCompact'
  className?: string
  /** When true, show a second section linking to major India city gold rate pages */
  showIndiaCities?: boolean
}

export function GoldRatesCityLinks({ titleKey = 'goldRatesCity.linksTitle', className, showIndiaCities }: Props) {
  const { t, locale } = usePublicLocale()

  return (
    <>
      <section className={className ?? 'gr-section'} aria-labelledby="gr-city-links">
        <h2 id="gr-city-links" className="gr-section__title">
          {t(titleKey)}
        </h2>
        <p className="gr-section__lead">{t('goldRatesCity.linksLead')}</p>
        <nav className="gr-city-links" aria-label={t('goldRatesCity.linksTitle')}>
          <ul className="gr-city-links__list">
            {GOLD_RATE_CITIES.map((city) => (
              <li key={city.slug}>
                <Link to={goldRateCityPath(city.slug)} className="gr-city-links__link">
                  {locale === 'ml' ? city.nameMl : city.nameEn}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/gold-rates/kerala" className="gr-city-links__link gr-city-links__link--all">
                {t('goldRatesCity.allKerala')}
              </Link>
            </li>
            <li>
              <Link to="/gold-rates/india" className="gr-city-links__link gr-city-links__link--all">
                {t('goldRatesCity.allIndia')}
              </Link>
            </li>
          </ul>
        </nav>
      </section>

      {showIndiaCities && (
        <section className="gr-section" aria-labelledby="gr-india-city-links">
          <h2 id="gr-india-city-links" className="gr-section__title">
            Gold rate in major Indian cities
          </h2>
          <p className="gr-section__lead">
            Check today&apos;s gold rate in top cities across India — live 22K and 24K prices per gram.
          </p>
          <nav className="gr-city-links" aria-label="Gold rate in Indian cities">
            <ul className="gr-city-links__list">
              {INDIA_GOLD_RATE_CITIES.map((city) => (
                <li key={city.slug}>
                  <Link to={`/gold-rates/${city.slug}`} className="gr-city-links__link">
                    {city.nameEn}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/gold-rates/india" className="gr-city-links__link gr-city-links__link--all">
                  All India rates
                </Link>
              </li>
            </ul>
          </nav>
        </section>
      )}
    </>
  )
}
