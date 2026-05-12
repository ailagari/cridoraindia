import { type CSSProperties, type MouseEvent, type ReactNode, useCallback, useRef } from 'react'

type Props = {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Max tilt in degrees */
  maxTilt?: number
}

export function TiltSurface({ children, className = '', style, maxTilt = 12 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el) return
      el.style.transition = 'none'
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      const rx = (py - 0.5) * -2 * maxTilt
      const ry = (px - 0.5) * 2 * maxTilt
      el.style.setProperty('--tilt-x', `${rx}deg`)
      el.style.setProperty('--tilt-y', `${ry}deg`)
    },
    [maxTilt],
  )

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.65s cubic-bezier(0.23, 1, 0.32, 1)'
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
    window.setTimeout(() => {
      el.style.transition = ''
    }, 650)
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transform: 'perspective(1100px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  )
}
