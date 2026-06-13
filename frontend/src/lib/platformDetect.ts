/** iPhone, iPod, iPad, and iPadOS Safari (MacIntel + touch). */
export function isAppleMobileOrTablet(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
