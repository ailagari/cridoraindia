import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { PublicMobileUserMenu } from '@/components/PublicMobileUserMenu'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { PublicMobileSegmentBar } from '@/components/PublicMobileSegmentBar'
import { useAuth, type AuthUser } from '@/context/AuthContext'
import { crossRedemptionMasterDisclaimer } from '@/features/crossRedemption/legalCopy'
import { LanguageSwitcher, PublicLocaleProvider, usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath } from '@/lib/routes'

function publicDisplayName(user: AuthUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || user.email
}

function PublicLayoutInner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = usePublicLocale()

  const primaryNav = [
    { to: '/', label: t('nav.home') },
    { to: '/how-it-works', label: t('nav.howItWorks') },
    { to: '/jewellers', label: t('nav.jewellers') },
    { to: '/marketplace', label: t('nav.products') },
    { to: '/waitlist', label: t('nav.waitlist') },
  ] as const

  const dashboardHref = user ? dashboardLandingPath(user) : '/'
  const guestLabel = t('nav.guest')
  const mobileTitle = user ? publicDisplayName(user) : guestLabel

  return (
    <div className="app-shell">
      <div className="public-sticky-stack">
        <header className="public-sticky-stack__header">
          <div className="container public-sticky-stack__header-inner">
            <Link to="/" className="public-logo-slot" style={{ textDecoration: 'none', color: 'inherit' }}>
              <CridoraLogo size="sm" />
            </Link>
            <nav className="nav-links public-nav-desktop" aria-label="Primary">
              {primaryNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <span
              className="public-mobile-username"
              title={mobileTitle !== guestLabel ? mobileTitle : undefined}
            >
              {mobileTitle}
            </span>
            <div className="public-header-end">
              <LanguageSwitcher />
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
          </div>
        </header>
        <GoldTickerStrip variant="public" />
        <PublicMobileSegmentBar />
      </div>
      <PublicMobileChrome />
      <main className="public-main">
        <Outlet />
      </main>
      <footer
        className="public-footer"
        style={{
          borderTop: '1px solid var(--border-soft)',
          marginTop: '3rem',
          padding: '2rem 0',
          color: 'var(--text-faint)',
          fontSize: '0.85rem',
        }}
      >
        <div className="container">
          <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', maxWidth: '56ch', lineHeight: 1.55 }}>
            {t('footer.blurb')}
          </p>
          <p style={{ margin: '0 0 1rem', color: 'var(--text-faint)', maxWidth: '72ch', fontSize: '0.78rem' }}>
            {crossRedemptionMasterDisclaimer}
          </p>
          <div className="nav-links" style={{ gap: '0.75rem 1.25rem' }}>
            <Link to="/why-cridora">{t('footer.whyCridora')}</Link>
            <Link to="/features">{t('footer.features')}</Link>
            <Link to="/how-it-works">{t('nav.howItWorks')}</Link>
            <Link to="/investors">{t('footer.investors')}</Link>
            <Link to="/jewellers">{t('nav.jewellers')}</Link>
            <Link to="/marketplace">{t('nav.products')}</Link>
            <Link to="/waitlist">{t('nav.waitlist')}</Link>
          </div>
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
