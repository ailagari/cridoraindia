import { useEffect, useRef } from 'react'

export type LivePollOptions = {
  /** When the tab becomes visible again, run the callback once before the next interval. Default true. */
  leadingOnVisible?: boolean
}

/**
 * Runs `callback` every `intervalMs` while the document tab is visible.
 * Pauses when the tab is in the background to save battery and avoid stale JWT churn.
 */
export function useLivePoll(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  options?: LivePollOptions,
): void {
  const cb = useRef(callback)
  cb.current = callback
  const leadingOnVisible = options?.leadingOnVisible ?? true
  // Guards against overlapping ticks: if a slow/queued backend response takes longer
  // than intervalMs, skip the next tick instead of firing another request on top of it.
  const inFlight = useRef(false)

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return undefined

    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (inFlight.current) return
      inFlight.current = true
      Promise.resolve(cb.current()).finally(() => {
        inFlight.current = false
      })
    }

    const id = window.setInterval(run, intervalMs)

    const onVis = () => {
      if (document.visibilityState === 'visible' && leadingOnVisible) {
        run()
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs, enabled, leadingOnVisible])
}
