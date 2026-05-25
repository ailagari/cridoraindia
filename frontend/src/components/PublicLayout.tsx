import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { PublicMobileUserMenu } from '@/components/PublicMobileUserMenu'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { PublicMobileSegmentBar } from '@/components/PublicMobileSegmentBar'
import { ThemeToggle } from '@/components/ThemeToggle'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="pub-ref app-shell">
      <header className="nav" role="banner">
        <button
          type="button"
          className="nav-burger"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {drawerOpen ? (
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <Link to="/" className="nav-logo" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setDrawerOpen(false)}>
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

        <div className="nav-end public-header-end">
          <LanguageSwitcher />
          <ThemeToggle />
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

      {drawerOpen ? (
        <button
          type="button"
          className="nav-drawer__backdrop is-open"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <div className={`nav-drawer${drawerOpen ? ' is-open' : ''}`} id="pub-nav-drawer">
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="drawer-link"
            onClick={() => setDrawerOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="drawer-divider" />
        {user ? (
          <>
            <NavLink to={dashboardHref} className="drawer-link" onClick={() => setDrawerOpen(false)}>
              {t('nav.dashboard')}
            </NavLink>
            <button
              type="button"
              className="drawer-link"
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={async () => {
                setDrawerOpen(false)
                await logout()
                navigate('/')
              }}
            >
              {t('nav.logOut')}
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="drawer-link" onClick={() => setDrawerOpen(false)}>
              {t('nav.login')}
            </NavLink>
            <NavLink to="/signup" className="drawer-link" onClick={() => setDrawerOpen(false)}>
              {t('nav.signUp')}
            </NavLink>
            <NavLink to="/jeweller/apply" className="drawer-link" onClick={() => setDrawerOpen(false)}>
              {t('nav.applyJeweller')}
            </NavLink>
          </>
        )}
      </div>

      <div className="pub-ref__ticker-sticky">
        <GoldTickerStrip variant="public" />
      </div>
      <PublicMobileSegmentBar />
      <PublicMobileChrome />
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="pub-footer">
        <div className="inner">
          <p style={{ margin: '0 0 1rem', color: 'var(--ink2)', maxWidth: '56ch', lineHeight: 1.55 }}>
            {t('footer.blurb')}
          </p>
          <p style={{ margin: '0 0 1rem', color: 'var(--ink3)', maxWidth: '72ch', fontSize: '0.78rem' }}>
            {crossRedemptionMasterDisclaimer}
          </p>
          <div className="nav-links" style={{ gap: '0.75rem 1.25rem', flexWrap: 'wrap' }}>
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
