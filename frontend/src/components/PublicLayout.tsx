import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'

const primaryNav = [
  { to: '/', label: 'Home' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/jewellers', label: 'Jewellers' },
  { to: '/marketplace', label: 'Products' },
  { to: '/waitlist', label: 'Waitlist' },
] as const

export function PublicLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const dashboardHref = user ? dashboardLandingPath(user) : '/'

  return (
    <div className="app-shell">
      <div className="public-sticky-stack">
        <header className="public-sticky-stack__header">
          <div
            className="container public-sticky-stack__header-inner"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 0',
              gap: '1rem',
            }}
          >
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <CridoraLogo size="sm" />
          </Link>
          <nav className="nav-links public-nav-desktop" aria-label="Primary">
            {primaryNav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="public-header-end">
            <div className="public-mobile-actions">
              <PublicHeaderActions />
            </div>
            <div className="public-desktop-bell">
              <PublicHeaderActions />
            </div>
            <nav className="nav-links public-nav-desktop public-account-nav" aria-label="Account">
              {user ? (
                <>
                  <NavLink to={dashboardHref} className="nav-link">
                    Dashboard
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
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className="nav-link">
                    Login
                  </NavLink>
                  <NavLink to="/signup" className="nav-link">
                    Sign up
                  </NavLink>
                  <NavLink to="/jeweller/apply" className="nav-link">
                    Apply as jeweller
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          </div>
        </header>
        <GoldTickerStrip variant="public" />
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
            Cridora connects verified jewellers and savers for India-first gold vaults, marketplace discovery, and supervised
            redemption.
          </p>
          <div className="nav-links" style={{ gap: '0.75rem 1.25rem' }}>
            <Link to="/why-cridora">Why Cridora</Link>
            <Link to="/features">Features</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/investors">Investors</Link>
            <Link to="/jewellers">Jewellers</Link>
            <Link to="/marketplace">Products</Link>
            <Link to="/waitlist">Waitlist</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
