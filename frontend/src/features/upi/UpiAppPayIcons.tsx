type IconProps = {
  size?: number
  className?: string
}

const UPI_APP_ICON_SRC: Record<UpiAppIconId, string> = {
  phonepe: '/upi-logos/phonepe-icon.svg',
  gpay: '/upi-logos/googlepay-icon.svg',
  paytm: '/upi-logos/paytm-icon.svg',
}

export type UpiAppIconId = 'phonepe' | 'gpay' | 'paytm'

export function UpiAppPayIcon({ id, size = 48, className }: IconProps & { id: UpiAppIconId }) {
  return (
    <img
      src={UPI_APP_ICON_SRC[id]}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      decoding="async"
    />
  )
}
