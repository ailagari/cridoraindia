declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const DEFAULT_GA4_ID = 'G-4KGJCVPZV6'

/** Matches backend GA4_MEASUREMENT_ID / index.html gtag config. */
export function ga4MeasurementId(): string {
  const fromMeta = document.querySelector('meta[name="ga4-measurement-id"]')?.getAttribute('content')?.trim()
  if (fromMeta) return fromMeta
  const fromEnv = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim()
  return fromEnv || DEFAULT_GA4_ID
}

function getGtag(): ((...args: unknown[]) => void) | undefined {
  return typeof window.gtag === 'function' ? window.gtag : undefined
}

/** Wait for the async gtag.js loader from <head> (injected server-side). */
export function whenGtagReady(timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (getGtag()) {
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false)
        return
      }
      window.setTimeout(tick, 40)
    }
    tick()
  })
}

/** SPA page_view — required for GA4 to see traffic beyond the first HTML load. */
export async function trackGa4PageView(pathWithSearch: string, title?: string): Promise<void> {
  const ready = await whenGtagReady()
  const gtag = getGtag()
  if (!ready || !gtag) return

  const page_path = pathWithSearch || `${window.location.pathname}${window.location.search}`
  const page_title = title ?? document.title
  const page_location = `${window.location.origin}${page_path}${window.location.hash}`

  gtag('config', ga4MeasurementId(), {
    send_page_view: true,
    page_path,
    page_title,
    page_location,
  })
}
