import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { PublicTabIcon } from '@/components/PublicTabIcon'
import { useMarketplaceCartBadgeCount } from '@/hooks/useMarketplaceCartBadgeCount'
import { marketplaceListingCartHref } from '@/lib/marketplaceCartStorage'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

function topForPath(
  pathname: string,
  search: string,
  t: (key: string) => string,
  marketplaceCartCount: number,
): { to: string; label: string }[] {
  if (pathname === '/') {
    return [
      { to: '/', label: t('mobile.overview') },
      { to: '/how-it-works', label: t('mobile.flow') },
      { to: '/waitlist', label: t('nav.waitlist') },
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
    return [
      { to: '/shop', label: t('mobile.hub') },
      { to: '/jewellers', label: t('nav.jewellers') },
      { to: '/marketplace', label: t('nav.products') },
      { to: marketplaceListingCartHref(pathname, search), label: cartLbl },
    ]
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
  return []
}

export function PublicMobileChrome() {
  const { pathname, search } = useLocation()
  const { t } = usePublicLocale()
  const marketplaceCartCount = useMarketplaceCartBadgeCount()
  const pills = topForPath(pathname, search, (key) => t(key as Parameters<typeof t>[0]), marketplaceCartCount)

  const isShopPath =
    pathname.startsWith('/shop') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/jewellers')
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
