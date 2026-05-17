import { NavLink, useLocation } from 'react-router-dom'

export function PublicSegmentNav() {
  const { pathname } = useLocation()

  const showDiscover =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/why-cridora') ||
    pathname.startsWith('/features')

  const showShop =
    pathname === '/shop' ||
    pathname.startsWith('/jewellers') ||
    pathname.startsWith('/marketplace')

  if (!showDiscover && !showShop) return null

  const segmentClass = ({ isActive }: { isActive: boolean }) =>
    `public-segment-nav__btn${isActive ? ' public-segment-nav__btn--active' : ''}`

  return (
    <div className="public-segment-nav" aria-label={showDiscover ? 'Discover audience' : 'Shop category'}>
      <div className="container public-segment-nav__inner">
        {showDiscover ? (
          <>
            <NavLink to="/discover/customers" end className={segmentClass}>
              Users
            </NavLink>
            <NavLink to="/discover/jewellers" end className={segmentClass}>
              Jewellers
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/jewellers" className={segmentClass}>
              Jewellers
            </NavLink>
            <NavLink to="/marketplace" className={segmentClass}>
              Products
            </NavLink>
          </>
        )}
      </div>
    </div>
  )
}
