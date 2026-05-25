import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { PublicMobileUserMenu } from '@/components/PublicMobileUserMenu'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { PublicMobileSegmentBar } from '@/components/PublicMobileSegmentBar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth, type AuthUser } from '@/context/AuthContext'
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
      <footer className="pub-footer ref-index-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="nav-logo" onClick={() => setDrawerOpen(false)}>
              <div className="nav-mark-mini" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7.5" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />
                  <path d="M7.5 10.5C7.5 8.84 8.84 7.5 10.5 7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                  <path
                    d="M12.5 9.5C12.5 11.16 11.16 12.5 9.5 12.5"
                    stroke="rgba(255,255,255,.65)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="nav-brand">
                Cridora <span>India</span>
              </div>
            </Link>
            <p>
              India&apos;s gold savings infrastructure. Linking verified jewellers to digital gold records, live rates,
              and real redemption tools.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className="badge badge-gold">KYC Secured</span>
              <span className="badge badge-ok">BIS 916</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <Link className="footer-link" to={{ pathname: '/', hash: 'home' }}>
              Home
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'discover' }}>
              Discover
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'how' }}>
              How it works
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'invest' }}>
              Invest
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'trust' }}>
              Trust &amp; safety
            </Link>
          </div>

          <div className="footer-col">
            <h4>For customers</h4>
            <Link className="footer-link" to="/login">
              Log in
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'join' }}>
              Sign up
            </Link>
            <Link className="footer-link" to={{ pathname: '/', hash: 'jewellers' }}>
              Find jewellers
            </Link>
            <Link className="footer-link" to="/marketplace">
              Marketplace
            </Link>
            <Link className="footer-link" to="/waitlist">
              Waitlist
            </Link>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <Link className="footer-link" to="/jeweller/apply">
              For jewellers
            </Link>
            <Link className="footer-link" to="/investors">
              Investor relations
            </Link>
            <Link className="footer-link" to="/features">
              Features
            </Link>
            <Link className="footer-link" to="/why-cridora">
              Why Cridora
            </Link>
            <Link className="footer-link" to="/waitlist">
              Contact
            </Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Cridora India. All rights reserved.</span>
          <div className="fb-links">
            <a className="fb-link" href="#">
              Privacy policy
            </a>
            <a className="fb-link" href="#">
              Terms of use
            </a>
            <a className="fb-link" href="#">
              Disclaimer
            </a>
            <a className="fb-link" href="#">
              Grievance
            </a>
          </div>
          <span style={{ color: 'var(--ink3)', fontSize: '0.68rem' }}>
            Gold rates are indicative. Not SEBI regulated investment advice.
          </span>
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
