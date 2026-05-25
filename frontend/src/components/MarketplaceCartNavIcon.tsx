import { Link } from 'react-router-dom'

function CartSvg({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

export type MarketplaceCartNavIconProps = {
  to: string
  count: number
  /** e.g. t('nav.cart') — tooltip + aria */
  label: string
}

/** Fixed header toolbar (always visible incl. mobile). */
export function MarketplaceCartNavIcon({ to, count, label }: MarketplaceCartNavIconProps) {
  const badge = count > 99 ? '99+' : count > 0 ? String(count) : null
  const extra = count > 0 ? ` (${count})` : ''
  const ariaLabel = `${label}${extra}`

  return (
    <Link
      to={to}
      className="marketplace-cart-nav-icon"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="marketplace-cart-nav-icon__gfx">
        <CartSvg />
        {badge ? (
          <span className="marketplace-cart-nav-icon__badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

type DrawerRowProps = {
  to: string
  count: number
  /** e.g. t('nav.cart') */
  label: string
  onNavigate: () => void
}

/** Mobile drawer row: icon + label + optional count suffix. */
export function MarketplaceCartDrawerLink({ to, count, label, onNavigate }: DrawerRowProps) {
  const line =
    count > 0 ? `${label} · ${count}` : label
  const ariaLabel = count > 0 ? `${label} (${count})` : label

  return (
    <Link
      className="drawer-link drawer-link--cart-row"
      to={to}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      <span className="drawer-link--cart-row__ico" aria-hidden="true">
        <CartSvg size={20} />
      </span>
      <span className="drawer-link--cart-row__lbl">{line}</span>
    </Link>
  )
}
