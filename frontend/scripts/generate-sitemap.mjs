/**
 * Writes public/sitemap.xml for WhiteNoise static fallback (Django middleware is primary).
 * Keep city slugs in sync with src/content/goldRateCities.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = 'https://www.cridoraindia.com'
const cities = [
  'kochi',
  'ernakulam',
  'thiruvananthapuram',
  'kozhikode',
  'thrissur',
  'kollam',
  'kannur',
  'palakkad',
  'alappuzha',
  'malappuram',
  'kottayam',
  'pathanamthitta',
  'idukki',
  'wayanad',
  'kasaragod',
]

/** @type {Array<[string, string, string]>} */
const paths = [
  ['/', 'daily', '1.0'],
  ['/gold-rates/kerala', 'hourly', '1.0'],
  ['/ml/gold-rates/kerala', 'hourly', '0.98'],
  ['/gold-calculator', 'hourly', '0.97'],
  ['/ml/gold-calculator', 'hourly', '0.95'],
  ['/gold-rates/india', 'daily', '0.95'],
  ['/ml/gold-rates/india', 'daily', '0.93'],
  ...cities.flatMap((slug) => [
    [`/gold-rates/${slug}`, 'hourly', '0.92'],
    [`/ml/gold-rates/${slug}`, 'hourly', '0.90'],
  ]),
  ['/jewellers', 'weekly', '0.8'],
  ['/marketplace', 'daily', '0.85'],
  ['/how-it-works', 'monthly', '0.7'],
  ['/features', 'monthly', '0.7'],
  ['/why-cridora', 'monthly', '0.6'],
  ['/discover', 'monthly', '0.6'],
  ['/signup', 'monthly', '0.5'],
]

const urls = paths
  .map(([path, changefreq, priority]) => {
    const loc = path === '/' ? `${SITE}/` : `${SITE}${path}`
    return `  <url>
    <loc>${loc}</loc>
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
console.log(`Wrote ${out} (${paths.length} URLs)`)
