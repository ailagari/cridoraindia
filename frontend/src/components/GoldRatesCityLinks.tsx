import { Link } from 'react-router-dom'
import { GOLD_RATE_CITIES, goldRateCityPath } from '@/content/goldRateCities'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

type Props = {
  titleKey?: 'goldRatesCity.linksTitle' | 'goldRatesCity.linksTitleCompact'
  className?: string
}

export function GoldRatesCityLinks({ titleKey = 'goldRatesCity.linksTitle', className }: Props) {
  const { t, locale } = usePublicLocale()

  return (
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
  )
}
