import { useId, useMemo } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { GOLD_RATE_CITIES, goldRateCityPath } from '@/content/goldRateCities'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { PublicMobileUserMenu } from '@/components/PublicMobileUserMenu'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { PublicMobileSegmentBar } from '@/components/PublicMobileSegmentBar'
import { MarketplaceCartNavIcon } from '@/components/MarketplaceCartNavIcon'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { useMarketplaceCartBadgeCount } from '@/hooks/useMarketplaceCartBadgeCount'
import { LanguageSwitcher, PublicLocaleProvider, usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath } from '@/lib/routes'
import { marketplaceListingCartHref } from '@/lib/marketplaceCartStorage'

function PublicLayoutInner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, locale } = usePublicLocale()
  const footerMarkGradId = useId().replace(/:/g, '')

  const primaryNav = [
    { to: '/', label: t('nav.home') },
    { to: '/gold-rates/kerala', label: t('nav.goldRates') },
    { to: '/gold-calculator', label: t('nav.goldCalculator') },
    { to: '/how-it-works', label: t('nav.howItWorks') },
    { to: '/jewellers', label: t('nav.jewellers') },
    { to: '/marketplace', label: t('nav.products') },
    { to: '/waitlist', label: t('nav.waitlist') },
  ] as const

  const dashboardHref = user ? dashboardLandingPath(user) : '/'
  const marketplaceCartCount = useMarketplaceCartBadgeCount()
  const location = useLocation()
  const cartLinkTo = useMemo(
    () => marketplaceListingCartHref(location.pathname, location.search),
    [location.pathname, location.search],
  )

  return (
    <div className="pub-ref app-shell">
      <header className={`nav${user ? ' nav--signed-in' : ''}`} role="banner">
        <Link to="/" className="nav-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <CridoraLogo size="sm" />
        </Link>

        <nav className="nav-links public-nav-desktop" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-end public-header-end">
          {user ? (
            <MarketplaceCartNavIcon to={cartLinkTo} count={marketplaceCartCount} label={t('nav.cart')} />
          ) : null}
          <div className="public-header-utility">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="public-mobile-actions">
            <PublicHeaderActions />
            <PublicMobileUserMenu />
          </div>
          <div className="public-desktop-bell">
            <PublicHeaderActions />
          </div>
          <nav className="nav-links public-nav-desktop public-account-nav" aria-label="Account">
            {user ? (
              <>
                <NavLink to={dashboardHref} className="nav-link">
                  {t('nav.dashboard')}
                </NavLink>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.65rem' }}
                  onClick={async () => {
                    await logout()
                    navigate('/')
                  }}
                >
                  {t('nav.logOut')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-link">
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/signup" className="nav-link">
                  {t('nav.signUp')}
                </NavLink>
                <NavLink to="/jeweller/apply" className="nav-link">
                  {t('nav.applyJeweller')}
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="pub-ref__ticker-sticky">
        <GoldTickerStrip variant="public" />
      </div>
      <PublicMobileSegmentBar />
      <PublicMobileChrome />
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="pub-footer ref-index-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="nav-logo">
              <div className="nav-mark-mini" aria-hidden>
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="18" stroke={`url(#${footerMarkGradId})`} strokeWidth="2.5" />
                  <path d="M14 20C14 16.6863 16.6863 14 20 14" stroke="#d4a85c" strokeWidth="3" strokeLinecap="round" />
                  <path d="M26 20C26 23.3137 23.3137 26 20 26" stroke="#a67a28" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id={footerMarkGradId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#e0bc78" />
                      <stop offset="55%" stopColor="#a67a28" />
                      <stop offset="100%" stopColor="#5c2f0a" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="nav-brand">
                Cridora<span className="cridora-logo__aindia">India</span>
              </div>
            </Link>
            <p>{t('footer.blurb')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className="badge badge-gold">{t('footer.kycBadge')}</span>
              <span className="badge badge-ok">{t('footer.bisBadge')}</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>{t('footer.platform')}</h4>
            <Link className="footer-link" to={{ pathname: '/', hash: 'home' }}>
              {t('footer.home')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'discover' }}>
              {t('footer.discover')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'how' }}>
              {t('footer.howItWorks')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'portfolio' }}>
              {t('footer.portfolio')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'integration' }}>
              {t('footer.integration')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'trust' }}>
              {t('footer.trust')}
            </Link>
          </div>

          <div className="footer-col">
            <h4>{t('footer.customers')}</h4>
            <Link className="footer-link" to="/login">
              {t('footer.logIn')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'join' }}>
              {t('footer.signUp')}
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'jewellers' }}>
              {t('footer.findJewellers')}
            </Link>
            <Link className="footer-link" to="/gold-rates/kerala">
              {t('nav.goldRates')}
            </Link>
            <Link className="footer-link" to="/gold-calculator">
              {t('nav.goldCalculator')}
            </Link>
            <Link className="footer-link" to="/gold-rates/india">
              {t('goldRatesCity.allIndia')}
            </Link>
            <Link className="footer-link" to="/marketplace">
              {t('footer.marketplace')}
            </Link>
            <Link className="footer-link" to="/waitlist">
              {t('footer.waitlist')}
            </Link>
          </div>

          <div className="footer-col">
            <h4>{t('footer.goldRatesCities')}</h4>
            {GOLD_RATE_CITIES.map((city) => (
              <Link key={city.slug} className="footer-link" to={goldRateCityPath(city.slug)}>
                {locale === 'ml' ? city.nameMl : city.nameEn}
              </Link>
            ))}
            <Link className="footer-link" to="/gold-rates/kerala">
              {t('goldRatesCity.allKerala')}
            </Link>
          </div>

          <div className="footer-col">
            <h4>{t('footer.company')}</h4>
            <Link className="footer-link" to="/jeweller/apply">
              {t('footer.forJewellers')}
            </Link>
            <Link className="footer-link" to="/investors">
              {t('footer.investors')}
            </Link>
            <Link className="footer-link" to="/features">
              {t('footer.features')}
            </Link>
            <Link className="footer-link" to="/why-cridora">
              {t('footer.whyCridora')}
            </Link>
            <Link className="footer-link" to="/waitlist">
              {t('footer.contact')}
            </Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>{t('footer.copyright')}</span>
          <div className="fb-links">
            <a className="fb-link" href="#">
              {t('footer.privacy')}
            </a>
            <a className="fb-link" href="#">
              {t('footer.terms')}
            </a>
            <a className="fb-link" href="#">
              {t('footer.disclaimer')}
            </a>
            <a className="fb-link" href="#">
              {t('footer.grievance')}
            </a>
          </div>
          <span style={{ color: 'var(--ink3)', fontSize: '0.68rem' }}>{t('footer.ratesNote')}</span>
        </div>
      </footer>
    </div>
  )
}

export function PublicLayout() {
  return (
    <PublicLocaleProvider>
      <PublicLayoutInner />
    </PublicLocaleProvider>
  )
}
