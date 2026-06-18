/**
 * Writes public/sitemap.xml for WhiteNoise static fallback (Django middleware is primary).
 * Keep city slugs in sync with src/content/goldRateCities.ts and src/content/indiaGoldRateCities.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = 'https://www.cridoraindia.com'

// Kerala cities
const keralaCities = [
  'kochi', 'ernakulam', 'thiruvananthapuram', 'kozhikode', 'thrissur',
  'kollam', 'kannur', 'palakkad', 'alappuzha', 'malappuram',
  'kottayam', 'pathanamthitta', 'idukki', 'wayanad', 'kasaragod',
]

// National Indian cities (high gold-search volume)
const indiaCities = [
  'mumbai', 'delhi', 'chennai', 'bangalore', 'hyderabad', 'pune',
  'kolkata', 'jaipur', 'ahmedabad', 'surat', 'lucknow', 'nagpur',
  'indore', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ludhiana',
  'agra', 'nashik', 'rajkot', 'varanasi', 'coimbatore', 'madurai',
  'mysuru', 'chandigarh', 'guwahati', 'bhubaneswar',
]

const today = new Date().toISOString().slice(0, 10)

/** @type {Array<[string, string, string, string]>} [path, changefreq, priority, lastmod] */
const paths = [
  ['/', 'daily', '1.0', today],
  ['/gold-rates/kerala', 'hourly', '1.0', today],
  ['/ml/gold-rates/kerala', 'hourly', '0.98', today],
  ['/gold-calculator', 'hourly', '0.97', today],
  ['/ml/gold-calculator', 'hourly', '0.95', today],
  ['/gold-rates/india', 'daily', '0.96', today],
  ['/ml/gold-rates/india', 'daily', '0.93', today],
  // Kerala cities (en + ml)
  ...keralaCities.flatMap((slug) => [
    [`/gold-rates/${slug}`, 'hourly', '0.92', today],
    [`/ml/gold-rates/${slug}`, 'hourly', '0.90', today],
  ]),
  // National India cities
  ...indiaCities.map((slug) => [`/gold-rates/${slug}`, 'hourly', '0.91', today]),
  // Static pages
  ['/jewellers', 'weekly', '0.8', '2025-01-01'],
  ['/marketplace', 'daily', '0.85', today],
  ['/how-it-works', 'monthly', '0.7', '2025-01-01'],
  ['/features', 'monthly', '0.7', '2025-01-01'],
  ['/why-cridora', 'monthly', '0.6', '2025-01-01'],
  ['/discover', 'monthly', '0.6', '2025-01-01'],
  ['/signup', 'monthly', '0.5', '2025-01-01'],
]

const urls = paths
  .map(([path, changefreq, priority, lastmod]) => {
    const loc = path === '/' ? `${SITE}/` : `${SITE}${path}`
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`Wrote ${out} (${paths.length} URLs, lastmod=${today})`)
