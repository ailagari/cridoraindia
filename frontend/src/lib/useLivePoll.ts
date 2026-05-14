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

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return undefined

    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void cb.current()
    }

    const id = window.setInterval(run, intervalMs)

    const onVis = () => {
      if (document.visibilityState === 'visible' && leadingOnVisible) {
        void cb.current()
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs, enabled, leadingOnVisible])
}
