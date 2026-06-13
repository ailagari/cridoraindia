import type { PageSeo } from '@/lib/seo'

export type GoldRateCity = {
  slug: string
  nameEn: string
  nameMl: string
  /** Malayalam script for SEO (സ്വർണ്ണ വില searches). */
  goldPriceMl: string
}

export const GOLD_RATE_CITIES: GoldRateCity[] = [
  { slug: 'kochi', nameEn: 'Kochi', nameMl: 'കൊച്ചി', goldPriceMl: 'കൊച്ചി സ്വർണ്ണ വില' },
  { slug: 'ernakulam', nameEn: 'Ernakulam', nameMl: 'എറണാകുളം', goldPriceMl: 'എറണാകുളം സ്വർണ്ണ വില' },
  {
    slug: 'thiruvananthapuram',
    nameEn: 'Thiruvananthapuram',
    nameMl: 'തിരുവനന്തപുരം',
    goldPriceMl: 'തിരുവനന്തപുരം സ്വർണ്ണ വില',
  },
  { slug: 'kozhikode', nameEn: 'Kozhikode', nameMl: 'കോഴിക്കോട്', goldPriceMl: 'കോഴിക്കോട് സ്വർണ്ണ വില' },
  { slug: 'thrissur', nameEn: 'Thrissur', nameMl: 'തൃശ്ശൂർ', goldPriceMl: 'തൃശ്ശൂർ സ്വർണ്ണ വില' },
  { slug: 'kollam', nameEn: 'Kollam', nameMl: 'കൊല്ലം', goldPriceMl: 'കൊല്ലം സ്വർണ്ണ വില' },
  { slug: 'kannur', nameEn: 'Kannur', nameMl: 'കണ്ണൂർ', goldPriceMl: 'കണ്ണൂർ സ്വർണ്ണ വില' },
  { slug: 'palakkad', nameEn: 'Palakkad', nameMl: '\u0D2A\u0D3E\u0D32\u0D3E\u0D15\u0D15\u0D21', goldPriceMl: '\u0D2A\u0D3E\u0D32\u0D3E\u0D15\u0D15\u0D21 \u0D38\u0D4D\u0D35\u0D7C\u0D23\u0D4D\u0D23 \u0D35\u0D3F\u0D32' },
  { slug: 'alappuzha', nameEn: 'Alappuzha', nameMl: 'ആലപ്പുഴ', goldPriceMl: 'ആലപ്പുഴ സ്വർണ്ണ വില' },
  { slug: 'malappuram', nameEn: 'Malappuram', nameMl: 'മലപ്പുറം', goldPriceMl: 'മലപ്പുറം സ്വർണ്ണ വില' },
  { slug: 'kottayam', nameEn: 'Kottayam', nameMl: 'കോട്ടയം', goldPriceMl: 'കോട്ടയം സ്വർണ്ണ വില' },
  {
    slug: 'pathanamthitta',
    nameEn: 'Pathanamthitta',
    nameMl: 'പത്തനംതിട്ട',
    goldPriceMl: 'പത്തനംതിട്ട സ്വർണ്ണ വില',
  },
  { slug: 'idukki', nameEn: 'Idukki', nameMl: '\u0D07\u0D21\u0D41\u0D15\u0D4D\u0D15\u0D3F', goldPriceMl: '\u0D07\u0D21\u0D41\u0D15\u0D4D\u0D15\u0D3F \u0D38\u0D4D\u0D35\u0D7C\u0D23\u0D4D\u0D23 \u0D35\u0D3F\u0D32' },
  { slug: 'wayanad', nameEn: 'Wayanad', nameMl: 'വയനാട്', goldPriceMl: 'വയനാട് സ്വർണ്ണ വില' },
  { slug: 'kasaragod', nameEn: 'Kasaragod', nameMl: 'കാസർഗോഡ്', goldPriceMl: 'കാസർഗോഡ് സ്വർണ്ണ വില' },
]

export const GOLD_RATE_CITY_BY_SLUG = Object.fromEntries(
  GOLD_RATE_CITIES.map((city) => [city.slug, city]),
) as Record<string, GoldRateCity>

export function isGoldRateCitySlug(slug: string | undefined): slug is string {
  return slug != null && slug in GOLD_RATE_CITY_BY_SLUG
}

export function goldRateCityPath(slug: string): string {
  return `/gold-rates/${slug}`
}

export function buildCityPageSeo(city: GoldRateCity): PageSeo {
  const path = goldRateCityPath(city.slug)
  return {
    title: `${city.nameEn} Gold Rate Today — Live 22K, 24K & Silver Kerala | Cridora India`,
    description: `Live gold rate in ${city.nameEn}, Kerala today per gram — 22K (916), 24K, 18K gold and silver 999. Charts, history, calculator. Updated every few minutes.`,
    path,
    keywords: [
      `${city.nameEn} gold rate today`,
      `gold rate ${city.nameEn}`,
      `${city.nameEn} gold price`,
      '22K gold rate Kerala',
      '24K gold rate Kerala',
      `${city.nameEn} silver rate`,
      'gold rate Kerala',
      city.goldPriceMl,
      'സ്വർണ്ണ വില Kerala',
    ].join(', '),
  }
}

export const CITY_PAGE_SEO: Record<string, PageSeo> = Object.fromEntries(
  GOLD_RATE_CITIES.map((city) => [goldRateCityPath(city.slug), buildCityPageSeo(city)]),
)
