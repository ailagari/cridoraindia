import type { PageSeo } from '@/lib/seo'

export type IndiaGoldRateCity = {
  slug: string
  nameEn: string
  state: string
  /** Alternate/local name (for SEO copy variations). */
  altName?: string
}

/** Top 28 Indian cities by gold-search volume — all served via /gold-rates/:slug. */
export const INDIA_GOLD_RATE_CITIES: IndiaGoldRateCity[] = [
  { slug: 'mumbai', nameEn: 'Mumbai', state: 'Maharashtra' },
  { slug: 'delhi', nameEn: 'Delhi', state: 'Delhi' },
  { slug: 'chennai', nameEn: 'Chennai', state: 'Tamil Nadu' },
  { slug: 'bangalore', nameEn: 'Bangalore', state: 'Karnataka', altName: 'Bengaluru' },
  { slug: 'hyderabad', nameEn: 'Hyderabad', state: 'Telangana' },
  { slug: 'pune', nameEn: 'Pune', state: 'Maharashtra' },
  { slug: 'kolkata', nameEn: 'Kolkata', state: 'West Bengal' },
  { slug: 'jaipur', nameEn: 'Jaipur', state: 'Rajasthan' },
  { slug: 'ahmedabad', nameEn: 'Ahmedabad', state: 'Gujarat' },
  { slug: 'surat', nameEn: 'Surat', state: 'Gujarat' },
  { slug: 'lucknow', nameEn: 'Lucknow', state: 'Uttar Pradesh' },
  { slug: 'nagpur', nameEn: 'Nagpur', state: 'Maharashtra' },
  { slug: 'indore', nameEn: 'Indore', state: 'Madhya Pradesh' },
  { slug: 'bhopal', nameEn: 'Bhopal', state: 'Madhya Pradesh' },
  { slug: 'visakhapatnam', nameEn: 'Visakhapatnam', state: 'Andhra Pradesh', altName: 'Vizag' },
  { slug: 'patna', nameEn: 'Patna', state: 'Bihar' },
  { slug: 'vadodara', nameEn: 'Vadodara', state: 'Gujarat' },
  { slug: 'ludhiana', nameEn: 'Ludhiana', state: 'Punjab' },
  { slug: 'agra', nameEn: 'Agra', state: 'Uttar Pradesh' },
  { slug: 'nashik', nameEn: 'Nashik', state: 'Maharashtra' },
  { slug: 'rajkot', nameEn: 'Rajkot', state: 'Gujarat' },
  { slug: 'varanasi', nameEn: 'Varanasi', state: 'Uttar Pradesh' },
  { slug: 'coimbatore', nameEn: 'Coimbatore', state: 'Tamil Nadu' },
  { slug: 'madurai', nameEn: 'Madurai', state: 'Tamil Nadu' },
  { slug: 'mysuru', nameEn: 'Mysuru', state: 'Karnataka', altName: 'Mysore' },
  { slug: 'chandigarh', nameEn: 'Chandigarh', state: 'Punjab' },
  { slug: 'guwahati', nameEn: 'Guwahati', state: 'Assam' },
  { slug: 'bhubaneswar', nameEn: 'Bhubaneswar', state: 'Odisha' },
]

export const INDIA_GOLD_RATE_CITY_BY_SLUG = Object.fromEntries(
  INDIA_GOLD_RATE_CITIES.map((city) => [city.slug, city]),
) as Record<string, IndiaGoldRateCity>

export function isIndiaGoldRateCitySlug(slug: string | undefined): slug is string {
  return slug != null && slug in INDIA_GOLD_RATE_CITY_BY_SLUG
}

export function buildIndiaCityPageSeo(city: IndiaGoldRateCity): PageSeo {
  const path = `/gold-rates/${city.slug}`
  const altNote = city.altName ? ` (${city.altName})` : ''
  return {
    title: `${city.nameEn} Gold Rate Today — Live 22K, 24K & Silver Price India | Cridora`,
    description: `Live gold rate in ${city.nameEn}${altNote}, ${city.state} today per gram — 22K (916 BIS), 24K, 18K gold and silver 999. Check today's gold price, jewellery calculator with GST. Updated every few minutes on Cridora India.`,
    path,
    keywords: [
      `${city.nameEn} gold rate today`,
      `gold rate in ${city.nameEn}`,
      `${city.nameEn} gold price today`,
      `gold rate ${city.nameEn} per gram`,
      `22K gold rate ${city.nameEn}`,
      `24K gold rate ${city.nameEn}`,
      `today gold rate ${city.nameEn}`,
      `gold price India today`,
      `gold rate India`,
      `gold calculator India`,
      ...(city.altName ? [`${city.altName} gold rate today`] : []),
    ].join(', '),
  }
}

export const INDIA_CITY_PAGE_SEO: Record<string, PageSeo> = Object.fromEntries(
  INDIA_GOLD_RATE_CITIES.map((city) => [
    `/gold-rates/${city.slug}`,
    buildIndiaCityPageSeo(city),
  ]),
)
