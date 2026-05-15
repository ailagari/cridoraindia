import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { PublicTabIcon } from '@/components/PublicTabIcon'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath, isDashboardPath } from '@/lib/routes'

function topForPath(pathname: string): { to: string; label: string }[] {
  if (pathname === '/') {
    return [
      { to: '/', label: 'Overview' },
      { to: '/how-it-works', label: 'Flow' },
      { to: '/waitlist', label: 'Waitlist' },
    ]
  }
  if (pathname.startsWith('/why-cridora')) {
    return [
      { to: '/why-cridora', label: 'Why' },
      { to: '/how-it-works', label: 'Flow' },
      { to: '/jewellers', label: 'Network' },
    ]
  }
  if (pathname.startsWith('/jewellers') || pathname.startsWith('/marketplace')) {
    return [
      { to: '/jewellers', label: 'Jewellers' },
      { to: '/marketplace', label: 'Products' },
    ]
  }
  if (pathname.startsWith('/signup') || pathname.startsWith('/jeweller/apply')) {
    return [
      { to: '/signup', label: 'Saver' },
      { to: '/jeweller/apply', label: 'Jeweller' },
    ]
  }
  if (pathname.startsWith('/features')) {
    return [
      { to: '/features', label: 'Overview' },
      { to: '/how-it-works', label: 'Flow' },
      { to: '/marketplace', label: 'Shop' },
    ]
  }
  if (pathname.startsWith('/how-it-works')) {
    return [
      { to: '/how-it-works', label: 'Flow' },
      { to: '/jewellers', label: 'Network' },
      { to: '/waitlist', label: 'Waitlist' },
    ]
  }
  return []
}

export function PublicMobileChrome() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const pills = topForPath(pathname)

  const isShopPath = pathname.startsWith('/marketplace') || pathname.startsWith('/jewellers')
  const isJoinPath = pathname.startsWith('/signup') || pathname.startsWith('/jeweller/apply')
  const joinTabActive = user ? isDashboardPath(pathname) : isJoinPath
  const discoverActive =
    pathname.startsWith('/why-cridora') ||
    pathname.startsWith('/features') ||
    pathname.startsWith('/how-it-works')

  const dashboardHref = user ? dashboardLandingPath(user) : '/login'
  const accountActive =
    !!(user && (pathname.startsWith('/userdashboard') || pathname.startsWith('/dashboard'))) ||
    (!user && pathname.startsWith('/login'))

  return (
    <>
      {pills.length > 0 ? (
        <div className="public-hub-tabs container" aria-label="Section shortcuts">
          {pills.map((p) => (
            <NavLink
              key={p.label + p.to}
              to={p.to}
              className={({ isActive }) =>
                `public-hub-pill${isActive ? ' public-hub-pill--active' : ''}`
              }
            >
              {p.label}
            </NavLink>
          ))}
        </div>
      ) : null}
      <nav className="public-bottom-nav" aria-label="Primary navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `public-bottom-item${isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="home" active={isActive} />
              </span>
              <span className="mobile-tab-label">Home</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/how-it-works"
          className={() => `public-bottom-item${discoverActive ? ' public-bottom-item--active' : ''}`}
        >
          {() => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="discover" active={discoverActive} />
              </span>
              <span className="mobile-tab-label">Discover</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/marketplace"
          className={() => `public-bottom-item${isShopPath ? ' public-bottom-item--active' : ''}`}
        >
          {() => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="shop" active={isShopPath} />
              </span>
              <span className="mobile-tab-label">Shop</span>
            </>
          )}
        </NavLink>
        <NavLink
          to={user ? dashboardHref : '/signup'}
          className={() => `public-bottom-item${joinTabActive ? ' public-bottom-item--active' : ''}`}
        >
          {() => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab={user ? 'dashboard' : 'join'} active={joinTabActive} />
              </span>
              <span className="mobile-tab-label">{user ? 'Dashboard' : 'Join'}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to={dashboardHref}
          className={() => `public-bottom-item${accountActive ? ' public-bottom-item--active' : ''}`}
        >
          {() => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab={user ? 'dashboard' : 'account'} active={accountActive} />
              </span>
              <span className="mobile-tab-label">{user ? 'Dashboard' : 'Account'}</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  )
}

export function PublicHeaderActions() {
  const { user } = useAuth()
  return (
    <div className="public-header-actions">{user ? <NotificationBell compact /> : null}</div>
  )
}
