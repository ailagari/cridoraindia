import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { PublicTabIcon } from '@/components/PublicTabIcon'
import { useAuth } from '@/context/AuthContext'
import { useMarketplaceCartBadgeCount } from '@/hooks/useMarketplaceCartBadgeCount'
import { marketplaceListingCartHref } from '@/lib/marketplaceCartStorage'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

function topForPath(
  pathname: string,
  search: string,
  t: (key: string) => string,
  marketplaceCartCount: number,
  loggedIn: boolean,
): { to: string; label: string }[] {
  if (pathname === '/') {
    return [
      { to: '/', label: t('mobile.overview') },
      { to: '/gold-rates/kerala', label: t('mobile.rates') },
      { to: '/how-it-works', label: t('mobile.flow') },
      { to: '/waitlist', label: t('nav.waitlist') },
    ]
  }
  if (pathname.startsWith('/gold-rates')) {
    return [
      { to: '/gold-rates/kerala', label: t('mobile.rates') },
      { to: '/marketplace', label: t('nav.products') },
      { to: '/jewellers', label: t('nav.jewellers') },
    ]
  }
  if (pathname.startsWith('/discover') || pathname.startsWith('/why-cridora') || pathname.startsWith('/features')) {
    return [
      { to: '/discover', label: t('mobile.hub') },
      { to: '/why-cridora', label: t('mobile.why') },
      { to: '/features', label: t('mobile.features') },
    ]
  }
  if (pathname.startsWith('/shop') || pathname.startsWith('/jewellers') || pathname.startsWith('/marketplace')) {
    const cartLbl =
      marketplaceCartCount > 0 ? `${t('nav.cart')} · ${marketplaceCartCount}` : t('nav.cart')
    const pills = [
      { to: '/shop', label: t('mobile.hub') },
      { to: '/jewellers', label: t('nav.jewellers') },
      { to: '/marketplace', label: t('nav.products') },
    ]
    if (loggedIn) {
      pills.push({ to: marketplaceListingCartHref(pathname, search), label: cartLbl })
    }
    return pills
  }
  if (pathname.startsWith('/join') || pathname.startsWith('/signup') || pathname.startsWith('/jeweller/apply')) {
    return [
      { to: '/join', label: t('mobile.hub') },
      { to: '/signup', label: t('mobile.saver') },
      { to: '/jeweller/apply', label: t('mobile.jeweller') },
    ]
  }
  if (pathname.startsWith('/how-it-works')) {
    return [
      { to: '/how-it-works', label: t('mobile.flow') },
      { to: '/jewellers', label: t('mobile.network') },
      { to: '/waitlist', label: t('nav.waitlist') },
    ]
  }
  if (pathname.startsWith('/login')) {
    return [
      { to: '/login', label: t('nav.login') },
      { to: '/signup', label: t('nav.signUp') },
      { to: '/join', label: t('mobile.hub') },
    ]
  }
  if (pathname.startsWith('/waitlist')) {
    return [
      { to: '/', label: t('mobile.overview') },
      { to: '/waitlist', label: t('nav.waitlist') },
      { to: '/how-it-works', label: t('mobile.flow') },
    ]
  }
  return []
}

export function PublicMobileChrome() {
  const { pathname, search } = useLocation()
  const { user } = useAuth()
  const { t } = usePublicLocale()
  const marketplaceCartCount = useMarketplaceCartBadgeCount()
  const pills = topForPath(
    pathname,
    search,
    (key) => t(key as Parameters<typeof t>[0]),
    marketplaceCartCount,
    Boolean(user),
  )

  const isShopPath =
    pathname.startsWith('/shop') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/jewellers')
  const isRatesPath = pathname.startsWith('/gold-rates')
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
              <span className="mobile-tab-label">{t('mobile.home')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/discover"
          className={({ isActive }) =>
            `public-bottom-item${discoverActive || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="discover" active={discoverActive || isActive} />
              </span>
              <span className="mobile-tab-label">{t('mobile.discover')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/shop"
          className={({ isActive }) =>
            `public-bottom-item${isShopPath || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="shop" active={isShopPath || isActive} />
              </span>
              <span className="mobile-tab-label">{t('mobile.shop')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/gold-rates/kerala"
          className={({ isActive }) =>
            `public-bottom-item${isRatesPath || isActive ? ' public-bottom-item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-tab-ico">
                <PublicTabIcon tab="rates" active={isRatesPath || isActive} />
              </span>
              <span className="mobile-tab-label">{t('mobile.rates')}</span>
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
              <span className="mobile-tab-label">{t('mobile.how')}</span>
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
              <span className="mobile-tab-label">{t('mobile.join')}</span>
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
      <NotificationBell compact localeScope="public" />
    </div>
  )
}
