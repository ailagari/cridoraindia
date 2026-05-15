import { useEffect, useState } from 'react'

/** Counts down to ISO expiry; re-renders once per second while mounted. */
export function useCounterOtpCountdown(expiresAtIso: string | null): {
  expired: boolean
  labelMmSs: string
} {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!expiresAtIso) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [expiresAtIso])

  if (!expiresAtIso) {
    return { expired: true, labelMmSs: '00:00' }
  }
  const end = Date.parse(expiresAtIso)
  if (Number.isNaN(end)) {
    return { expired: true, labelMmSs: '00:00' }
  }
  const remainingMs = Math.max(0, end - Date.now())
  const expired = remainingMs <= 0
  const totalSec = Math.floor(remainingMs / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  const labelMmSs = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return { expired, labelMmSs }
}
