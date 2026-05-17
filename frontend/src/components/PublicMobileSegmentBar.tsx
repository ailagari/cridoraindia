import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

function isDiscoverPath(pathname: string): boolean {
  return pathname === '/discover' || pathname === '/why-cridora'
}

function isShopPath(pathname: string): boolean {
  return pathname === '/shop' || pathname.startsWith('/jewellers') || pathname.startsWith('/marketplace')
}

export function PublicMobileSegmentBar() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const discover = isDiscoverPath(pathname)
  const shop = isShopPath(pathname)

  if (!discover && !shop) {
    return null
  }

  const discoverCustomers =
    pathname === '/why-cridora' ? hash !== '#discover-jewellers' : searchParams.get('audience') !== 'jewellers'
  const discoverJewellersActive =
    pathname === '/why-cridora' ? hash === '#discover-jewellers' : searchParams.get('audience') === 'jewellers'

  const shopJewellers = pathname.startsWith('/jewellers')
  const shopProducts = pathname.startsWith('/marketplace')

  return (
    <div className="public-mobile-segment-bar" aria-label={discover ? 'Discover audience' : 'Shop destination'}>
      <div className="container public-mobile-segment-bar__inner">
        {discover ? (
          <div className="public-mobile-segment-bar__pair" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={discoverCustomers}
              className={`public-mobile-segment-btn${discoverCustomers ? ' public-mobile-segment-btn--active' : ''}`}
              onClick={() => {
                if (pathname === '/why-cridora') {
                  navigate({ pathname: '/why-cridora', hash: 'discover-customers' }, { replace: true })
                } else {
                  navigate({ pathname: '/discover', search: '?audience=customers' }, { replace: true })
                }
              }}
            >
              Users
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={discoverJewellersActive}
              className={`public-mobile-segment-btn${discoverJewellersActive ? ' public-mobile-segment-btn--active' : ''}`}
              onClick={() => {
                if (pathname === '/why-cridora') {
                  navigate({ pathname: '/why-cridora', hash: 'discover-jewellers' }, { replace: true })
                } else {
                  navigate({ pathname: '/discover', search: '?audience=jewellers' }, { replace: true })
                }
              }}
            >
              Jewellers
            </button>
          </div>
        ) : (
          <div className="public-mobile-segment-bar__pair" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={shopJewellers}
              className={`public-mobile-segment-btn${shopJewellers ? ' public-mobile-segment-btn--active' : ''}`}
              onClick={() => navigate('/jewellers')}
            >
              Jewellers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={shopProducts}
              className={`public-mobile-segment-btn${shopProducts ? ' public-mobile-segment-btn--active' : ''}`}
              onClick={() => navigate('/marketplace')}
            >
              Products
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
