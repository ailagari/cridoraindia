const heroGold =
  'https://images.unsplash.com/photo-1722410180681-9f5a22d7ebb6?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
const heroJewellery =
  'https://images.unsplash.com/photo-1771515411694-57fb626159d1?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
const trustCollage =
  'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=82'

export const IMAGES = {
  heroGold,
  heroJewellery,
  trustCollage,
} as const

/**
 * Slot geometry matches `.media-frame--*` in `styles/index.css`.
 * Images use `object-fit: cover` so any aspect ratio crops into the frame without layout shift.
 */
export const IMAGE_LAYOUT = {
  productAspectRatio: '4 / 3',
  heroAspectRatio: '3 / 2',
  bannerAspectRatio: '21 / 9',
  /** Optional: target widths when tuning CDN query params (Unsplash `w=`, etc.) */
  productCardSrcMinWidth: 640,
  heroSrcMinWidth: 1200,
  logoTilePx: 48,
  checkoutThumbPx: 88,
} as const
