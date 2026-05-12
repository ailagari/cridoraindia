import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { userDashboardPath } from '@/lib/routes'

function topForPath(pathname: string): { to: string; label: string }[] {
  if (pathname === '/') {
    return [
      { to: '/', label: 'Overview' },
      { to: '/why-cridora', label: 'Story' },
      { to: '/features', label: 'Features' },
    ]
  }
  if (pathname.startsWith('/why-cridora')) {
    return [
      { to: '/why-cridora', label: 'Why' },
      { to: '/features', label: 'Features' },
      { to: '/jewellers', label: 'Jewellers' },
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
      { to: '/why-cridora', label: 'Why' },
      { to: '/marketplace', label: 'Shop' },
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

  const dashboardHref = user ? userDashboardPath(user) : '/login'
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
          Home
        </NavLink>
        <NavLink
          to="/why-cridora"
          className={({ isActive }) =>
            `public-bottom-item${isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          Discover
        </NavLink>
        <NavLink
          to="/marketplace"
          className={() => `public-bottom-item${isShopPath ? ' public-bottom-item--active' : ''}`}
        >
          Shop
        </NavLink>
        <NavLink to="/signup" className={() => `public-bottom-item${isJoinPath ? ' public-bottom-item--active' : ''}`}>
          Join
        </NavLink>
        <NavLink to={dashboardHref} className={() => `public-bottom-item${accountActive ? ' public-bottom-item--active' : ''}`}>
          {user ? 'App' : 'Account'}
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
