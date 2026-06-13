import type { CSSProperties } from 'react'

export type GoldRatesAdSlotId =
  | 'top_banner'
  | 'sidebar'
  | 'in_content_1'
  | 'in_content_2'
  | 'footer'

export type AdSenseSizeSpec = {
  /** Common AdSense / IAB display name */
  name: string
  width: number
  height: number
}

export type GoldRatesAdSlotSpec = {
  label: string
  /** Primary size used for the on-page container (desktop) */
  recommended: AdSenseSizeSpec
  /** Other common AdSense sizes that fit this slot */
  alternates: AdSenseSizeSpec[]
  /** Mobile-friendly size when the slot spans full viewport width */
  mobile: AdSenseSizeSpec
  /** Suggested AdSense data-ad-format value */
  adsenseFormat: 'horizontal' | 'rectangle' | 'auto'
  /** CSS aspect-ratio value for the ad frame */
  aspectRatio: string
  /** Optional max width for the frame (sidebar) */
  maxWidthPx?: number
}

export const GOLD_RATES_AD_SLOT_SPECS: Record<GoldRatesAdSlotId, GoldRatesAdSlotSpec> = {
  top_banner: {
    label: 'Top banner',
    recommended: { name: 'Leaderboard', width: 728, height: 90 },
    alternates: [{ name: 'Banner', width: 468, height: 60 }],
    mobile: { name: 'Large mobile banner', width: 320, height: 100 },
    adsenseFormat: 'horizontal',
    aspectRatio: '728 / 90',
  },
  sidebar: {
    label: 'Sidebar',
    recommended: { name: 'Medium rectangle', width: 300, height: 250 },
    alternates: [
      { name: 'Large rectangle', width: 336, height: 280 },
      { name: 'Half page', width: 300, height: 600 },
    ],
    mobile: { name: 'Medium rectangle', width: 300, height: 250 },
    adsenseFormat: 'rectangle',
    aspectRatio: '300 / 250',
    maxWidthPx: 300,
  },
  in_content_1: {
    label: 'After rate cards',
    recommended: { name: 'Leaderboard', width: 728, height: 90 },
    alternates: [
      { name: 'Medium rectangle', width: 300, height: 250 },
      { name: 'Banner', width: 468, height: 60 },
    ],
    mobile: { name: 'Large mobile banner', width: 320, height: 100 },
    adsenseFormat: 'horizontal',
    aspectRatio: '728 / 90',
  },
  in_content_2: {
    label: 'After chart',
    recommended: { name: 'Leaderboard', width: 728, height: 90 },
    alternates: [
      { name: 'Medium rectangle', width: 300, height: 250 },
      { name: 'Banner', width: 468, height: 60 },
    ],
    mobile: { name: 'Large mobile banner', width: 320, height: 100 },
    adsenseFormat: 'horizontal',
    aspectRatio: '728 / 90',
  },
  footer: {
    label: 'Footer strip',
    recommended: { name: 'Leaderboard', width: 728, height: 90 },
    alternates: [{ name: 'Banner', width: 468, height: 60 }],
    mobile: { name: 'Large mobile banner', width: 320, height: 100 },
    adsenseFormat: 'horizontal',
    aspectRatio: '728 / 90',
  },
}

export function getGoldRatesAdSlotSpec(slot: string | undefined): GoldRatesAdSlotSpec | undefined {
  if (!slot) return undefined
  return GOLD_RATES_AD_SLOT_SPECS[slot as GoldRatesAdSlotId]
}

export function formatAdSize(size: AdSenseSizeSpec): string {
  return `${size.width} × ${size.height} px (${size.name})`
}

export function adSlotFrameStyle(spec: GoldRatesAdSlotSpec | undefined): CSSProperties | undefined {
  if (!spec) return undefined
  return {
    ['--gr-ad-aspect' as string]: spec.aspectRatio,
    ['--gr-ad-mobile-aspect' as string]: `${spec.mobile.width} / ${spec.mobile.height}`,
    ...(spec.maxWidthPx ? { ['--gr-ad-max-w' as string]: `${spec.maxWidthPx}px` } : {}),
  }
}

export function buildAdSizeGuidance(spec: GoldRatesAdSlotSpec): string {
  const parts = [`Mobile: ${formatAdSize(spec.mobile)}`]
  if (spec.alternates.length) {
    parts.push(`Also accepted: ${spec.alternates.map(formatAdSize).join('; ')}`)
  }
  parts.push('Wrong aspect ratios are scaled to fit inside the slot (object-fit: contain).')
  return parts.join(' · ')
}
