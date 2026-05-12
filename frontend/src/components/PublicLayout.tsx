import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { PublicHeaderActions, PublicMobileChrome } from '@/components/PublicMobileChrome'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { userDashboardPath } from '@/lib/routes'

const primaryNav = [
  { to: '/', label: 'Home' },
  { to: '/why-cridora', label: 'Why Cridora' },
  { to: '/features', label: 'Features' },
  { to: '/jewellers', label: 'Jeweller marketplace' },
  { to: '/marketplace', label: 'Product marketplace' },
] as const

export function PublicLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const dashboardHref = user ? userDashboardPath(user) : '/'

  return (
    <div className="app-shell">
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--veil-88)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
        <div
          className="container"
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
            <ThemeToggle />
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
          <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)' }}>
            Cridora connects savers and verified jewellers for live gold savings, portfolio tracking, and redemption (BIS 916,
            India). Customers buy, track, use, and redeem; jewellers manage storefronts, rates, and listings; Cridora
            administers KYC/KYB, listing review, and network safeguards.
          </p>
          <div className="nav-links" style={{ gap: '0.75rem 1.25rem' }}>
            <Link to="/why-cridora">Why Cridora</Link>
            <Link to="/features">Features</Link>
            <Link to="/jewellers">Jeweller marketplace</Link>
            <Link to="/marketplace">Product marketplace</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
