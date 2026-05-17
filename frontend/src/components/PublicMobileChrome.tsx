import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { PublicTabIcon } from '@/components/PublicTabIcon'

function topForPath(pathname: string): { to: string; label: string }[] {
  if (pathname === '/') {
    return [
      { to: '/', label: 'Overview' },
      { to: '/how-it-works', label: 'Flow' },
      { to: '/waitlist', label: 'Waitlist' },
    ]
  }
  if (pathname.startsWith('/discover') || pathname.startsWith('/why-cridora') || pathname.startsWith('/features')) {
    return [
      { to: '/discover/customers', label: 'Users' },
      { to: '/discover/jewellers', label: 'Jewellers' },
      { to: '/why-cridora', label: 'Why' },
      { to: '/features', label: 'Features' },
    ]
  }
  if (pathname.startsWith('/jewellers') || pathname.startsWith('/marketplace')) {
    return [
      { to: '/jewellers', label: 'Jewellers' },
      { to: '/marketplace', label: 'Products' },
    ]
  }
  if (pathname.startsWith('/join') || pathname.startsWith('/signup') || pathname.startsWith('/jeweller/apply')) {
    return [
      { to: '/join', label: 'Hub' },
      { to: '/signup', label: 'Saver' },
      { to: '/jeweller/apply', label: 'Jeweller' },
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
  const pills = topForPath(pathname)

  const isShopPath =
    pathname.startsWith('/shop') || pathname.startsWith('/marketplace') || pathname.startsWith('/jewellers')
  const isJoinPath =
    pathname.startsWith('/join') || pathname.startsWith('/signup') || pathname.startsWith('/jeweller/apply')
  const discoverActive =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/why-cridora') ||
    pathname.startsWith('/features')

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
          to="/discover/customers"
          className={({ isActive }) =>
            `public-bottom-item${discoverActive || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="discover" active={discoverActive || isActive} />
              </span>
              <span className="mobile-tab-label">Discover</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/jewellers"
          className={({ isActive }) =>
            `public-bottom-item${isShopPath || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="shop" active={isShopPath || isActive} />
              </span>
              <span className="mobile-tab-label">Shop</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/how-it-works"
          className={({ isActive }) =>
            `public-bottom-item${isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="how" active={isActive} />
              </span>
              <span className="mobile-tab-label">How</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/join"
          className={({ isActive }) =>
            `public-bottom-item${isJoinPath || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="join" active={isJoinPath || isActive} />
              </span>
              <span className="mobile-tab-label">Join</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  )
}

export function PublicHeaderActions() {
  return (
    <div className="public-header-actions">
      <NotificationBell compact />
    </div>
  )
}
