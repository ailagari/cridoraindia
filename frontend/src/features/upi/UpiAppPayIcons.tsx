type IconProps = {
  size?: number
  className?: string
}

export function PhonePePayIcon({ size = 48, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill="#5F259F" />
      <path
        fill="#fff"
        d="M14 17.5h6.2c3.4 0 5.6 1.8 5.6 4.8 0 2.1-1.1 3.7-3 4.5l4.2 6.7h-3.9l-3.7-6h-2.2v6h-3.4V17.5zm6 7.5c1.7 0 2.7-.8 2.7-2.2s-1-2.2-2.7-2.2H17.4v4.4H20zM29.8 17.5h3.4v14.5h-3.4V17.5z"
      />
    </svg>
  )
}

export function GooglePayIcon({ size = 48, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill="#fff" stroke="#E8EAED" strokeWidth="1" />
      <g transform="translate(12 12) scale(1)">
        <path fill="#4285F4" d="M23.5 12.5c2.4 0 4.5.9 6.2 2.3l4.6-4.6C27.9 6.9 24.2 5.5 20 5.5 12.8 5.5 6.6 9.6 4 15.3l5.4 4.2C10.2 15.6 14.7 12.5 20 12.5c.6 0 1.2 0 1.8.1-.4-.1-.8-.1-1.3-.1z" transform="translate(-4 -2) scale(0.85)" />
        <path fill="#34A853" d="M39.8 20.5H22v7.8h9.9c-.5 2.4-1.9 4.4-3.9 5.8l6.1 4.7c3.6-3.3 5.7-8.2 5.7-13.6 0-1.4-.1-2.7-.3-4z" transform="translate(-4 -2) scale(0.85)" />
        <path fill="#FBBC05" d="M13 26.3c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1l-5.4-4.2C4.7 16.8 3.5 19.4 3.5 22.6s1.2 5.8 2.8 8.4l5.4-4.2z" transform="translate(-4 -2) scale(0.85)" />
        <path fill="#EA4335" d="M20 39.5c4.1 0 7.6-1.4 10.1-3.8l-6.1-4.7c-1.7 1.1-3.8 1.8-6.2 1.8-4.5 0-8.4-3-9.8-7.2l-5.4 4.2C6.6 35.9 12.8 39.5 20 39.5z" transform="translate(-4 -2) scale(0.85)" />
      </g>
      <text x="24" y="42" textAnchor="middle" fill="#5F6368" fontSize="6.5" fontFamily="system-ui,sans-serif" fontWeight="700">
        Pay
      </text>
    </svg>
  )
}

export function PaytmPayIcon({ size = 48, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill="#00BAF2" />
      <path
        fill="#002E6E"
        d="M11 18.5h4.1l2.2 9.8 2.3-9.8h3.8l-3.8 14.5h-4.1l-2.2-9.4-2.2 9.4H9.2L11 18.5zm17.2 0h6.1c3.3 0 5.4 1.7 5.4 4.5 0 2.4-1.7 4-4.4 4.3l4.9 5.7h-4.2l-4.4-5.2h-1.8v5.2h-3.5V18.5zm5.8 6.8c1.6 0 2.5-.7 2.5-1.9s-.9-1.9-2.5-1.9h-2.3v3.8h2.3z"
      />
    </svg>
  )
}

export type UpiAppIconId = 'phonepe' | 'gpay' | 'paytm'

export function UpiAppPayIcon({ id, size = 48, className }: IconProps & { id: UpiAppIconId }) {
  if (id === 'phonepe') return <PhonePePayIcon size={size} className={className} />
  if (id === 'gpay') return <GooglePayIcon size={size} className={className} />
  return <PaytmPayIcon size={size} className={className} />
}
