/** Sets html classes used for iOS PWA safe-area fallbacks. */
export function initPlatformShellClasses(): void {
  const html = document.documentElement
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIOS) {
    html.classList.add('ios')
  }

  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true

  if (standalone) {
    html.classList.add('pwa-standalone')
  }
}
