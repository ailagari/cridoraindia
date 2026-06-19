/** Canonical site URL — always use www for SEO consistency. */
import { CITY_PAGE_SEO, GOLD_RATE_CITIES, goldRateCityPath } from '@/content/goldRateCities'
import { INDIA_CITY_PAGE_SEO } from '@/content/indiaGoldRateCities'

export const SITE_URL = 'https://www.cridoraindia.com'

export const SITE_NAME = 'Cridora India'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-preview.png`

/** Dynamic OG image with live rates (SVG). Optional label query for city pages. */
export function goldRatesOgImage(label?: string): string {
  if (!label) return `${SITE_URL}/og/gold-rates.svg`
  return `${SITE_URL}/og/gold-rates.svg?label=${encodeURIComponent(label)}`
}

export const GOLD_RATES_FEED_URL = `${SITE_URL}/feed/gold-rates.xml`

export const DEFAULT_KEYWORDS =
  'gold rate today, gold rate today in India, Kerala gold rate, gold rate in India, 22K gold rate, 24K gold rate, silver rate Kerala, gold price India, gold rate India today, gold calculator India, digital gold portfolio, jeweller India'

export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${p}`
}

export type PageSeo = {
  title: string
  description: string
  path: string
  keywords?: string
  ogImage?: string
  noindex?: boolean
}

/** Static SEO for public routes (mirrors backend/config/seo.py). */
export const PAGE_SEO: Record<string, PageSeo> = {
  '/': {
    title: 'Cridora India — Live Gold Rates Kerala, Digital Gold Portfolio & Jeweller Platform',
    description:
      'Live Kerala gold rates (22K, 24K, silver), digital gold portfolio tracking, bill vault, and verified jeweller engagement across India. Check today\'s gold price in Kerala on Cridora.',
    path: '/',
    keywords: DEFAULT_KEYWORDS,
  },
  '/gold-rates/kerala': {
    title: 'Kerala Gold Rate Today — Live 22K, 24K & Silver Price | Cridora India',
    description:
      'Check live Kerala gold rate today per gram — 24K, 22K (916), 18K gold and silver 999. Daily price chart, 2-year history, jewellery calculator. Updated every few minutes.',
    path: '/gold-rates/kerala',
    keywords:
      'Kerala gold rate today, gold rate Kerala, 22K gold rate Kerala, 24K gold rate today Kerala, silver rate Kerala, gold price per gram Kerala, Kochi gold rate, Thiruvananthapuram gold rate, gold rate India',
  },
  '/gold-rates/india': {
    title: 'Gold Rate in India Today — Live Kerala 22K & 24K Prices | Cridora India',
    description:
      'Today\'s gold rate in India with Cridora live Kerala gold references — 22K, 24K, 18K and silver per gram. Historical charts, daily rate table, and jewellery value calculator.',
    path: '/gold-rates/india',
    keywords:
      'gold rate India, gold rate today India, gold price India, 22K gold rate India, 24K gold rate today, Kerala gold rate, gold rate per gram India, silver rate India',
  },
  '/gold-calculator': {
    title: 'Gold Calculator India — 22K, 24K Jewellery Price with GST & Making Charges | Cridora',
    description:
      'Free gold jewellery calculator with live Kerala 22K and 24K rates. Estimate ornament price by weight, purity, making charges, and GST on gold and making. Updated every few minutes.',
    path: '/gold-calculator',
    keywords:
      'gold calculator, gold jewellery calculator, gold price calculator India, 22K gold calculator, gold making charges calculator, Kerala gold calculator, gold rate calculator, GST on gold calculator, സ്വർണ്ണ കാൽക്കുലേറ്റർ',
  },
  '/jewellers': {
    title: 'Verified Jewellers in Kerala & India | Cridora India',
    description:
      'Browse verified jewellers on Cridora India. Connect with trusted gold shops in Kerala and across India for portfolio-linked purchases and digital bill storage.',
    path: '/jewellers',
  },
  '/marketplace': {
    title: 'Gold Jewellery Marketplace — Kerala & India | Cridora India',
    description:
      'Shop gold jewellery from verified jewellers on Cridora. Browse ornaments, compare live gold rates, and track purchases in your digital portfolio.',
    path: '/marketplace',
  },
  '/how-it-works': {
    title: 'How Cridora Works — Digital Gold Portfolio & Jeweller Platform',
    description:
      'Learn how Cridora helps customers track gold holdings, store bills digitally, and stay connected with jewellers — without replacing your existing systems.',
    path: '/how-it-works',
  },
  '/features': {
    title: 'Features — Digital Gold Portfolio, Bills & Jeweller Tools | Cridora India',
    description:
      'Explore Cridora features: portfolio tracking, live gold rates, digital bill vault, jeweller engagement, notifications, and marketplace integration.',
    path: '/features',
  },
  ...CITY_PAGE_SEO,
  ...INDIA_CITY_PAGE_SEO,
}

export function seoForPath(pathname: string): PageSeo {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return PAGE_SEO[normalized] ?? PAGE_SEO['/']
}

export function goldRatesItemListJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Kerala gold rate by city',
    itemListElement: GOLD_RATE_CITIES.map((city, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${city.nameEn} gold rate today`,
      url: absoluteUrl(goldRateCityPath(city.slug)),
    })),
  }
}

export function newsArticleJsonLd(opts: {
  headline: string
  description: string
  path: string
  dateModified?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: opts.headline,
    description: opts.description,
    url: absoluteUrl(opts.path),
    dateModified: opts.dateModified ?? new Date().toISOString().slice(0, 10),
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
    inLanguage: 'en-IN',
    about: { '@type': 'Thing', name: 'Gold price India' },
  }
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon-512.png`,
      width: 512,
      height: 512,
    },
    description:
      'Live gold rates in India (22K, 24K, 18K per gram), free gold jewellery calculator with GST, digital gold portfolio tracking, and verified jeweller platform across India.',
    areaServed: { '@type': 'Country', name: 'India' },
    foundingLocation: { '@type': 'Place', name: 'Kerala, India' },
    knowsAbout: [
      'Gold rate today India',
      'Kerala gold rate',
      '22K gold price',
      '24K gold price',
      'Gold jewellery calculator',
      'GST on gold India',
      'BIS hallmark gold',
    ],
    sameAs: [
      'https://www.instagram.com/cridoraindia',
      'https://www.facebook.com/cridoraindia',
      'https://twitter.com/cridoraindia',
    ],
  }
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: 'Live gold rates in Kerala and India, digital gold portfolio tracking, and jeweller engagement.',
    inLanguage: ['en-IN', 'ml-IN'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/jewellers?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqJsonLd(faqs: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function goldCalculatorWebAppJsonLd(path: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Cridora Gold Jewellery Calculator',
    url: absoluteUrl(path),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    description:
      'Calculate gold jewellery price in India using live Kerala 22K and 24K rates, making charges, and GST.',
    provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    inLanguage: ['en-IN', 'ml-IN'],
  }
}

/**
 * PriceSpecification schema blocks for live gold rates.
 * Enables Google's price-related rich results for gold queries.
 */
export function priceSpecificationJsonLd(opts: {
  r22: number | null
  r24: number | null
  r18?: number | null
  city?: string
}): Record<string, unknown>[] {
  const location = opts.city ?? 'India'
  const today = new Date().toISOString().slice(0, 10)
  const blocks: Record<string, unknown>[] = []
  if (opts.r22 != null) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `22K Gold per gram — ${location}`,
      description: `Live 22K (916 BIS hallmark) gold rate per gram in ${location}. Updated every few minutes on Cridora India.`,
      category: 'Precious Metal',
      brand: { '@type': 'Brand', name: 'BIS 916 Hallmark Gold' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: opts.r22.toFixed(2),
        priceValidUntil: today,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
    })
  }
  if (opts.r24 != null) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `24K Gold per gram — ${location}`,
      description: `Live 24K (999 pure) gold rate per gram in ${location}. Updated every few minutes on Cridora India.`,
      category: 'Precious Metal',
      brand: { '@type': 'Brand', name: '24K Pure Gold' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: opts.r24.toFixed(2),
        priceValidUntil: today,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
    })
  }
  if (opts.r18 != null) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `18K Gold per gram — ${location}`,
      description: `Live 18K (750 hallmark) gold rate per gram in ${location} on Cridora India.`,
      category: 'Precious Metal',
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: opts.r18.toFixed(2),
        priceValidUntil: today,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
    })
  }
  return blocks
}

export function goldCalculatorHowToJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to calculate gold jewellery price in India',
    description:
      'Use weight, purity, live gold rate per gram, making charges, and GST to estimate ornament price on Cridora.',
    step: [
      {
        '@type': 'HowToStep',
        name: 'Enter gold weight',
        text: 'Enter weight in grams, sovereign (8 g), or kilograms.',
      },
      {
        '@type': 'HowToStep',
        name: 'Select purity',
        text: 'Choose 24K, 22K (916 BIS), or 18K gold purity.',
      },
      {
        '@type': 'HowToStep',
        name: 'Add making charges',
        text: 'Optional making charge as ₹ per gram or percentage of metal value.',
      },
      {
        '@type': 'HowToStep',
        name: 'View total with GST',
        text: 'See metal value, making charges, GST on gold (3%), GST on making (18%), and estimated total.',
      },
    ],
  }
}

export function goldRatesWebPageJsonLd(opts: {
  title: string
  description: string
  path: string
  dateModified?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.title,
    description: opts.description,
    url: absoluteUrl(opts.path),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    about: {
      '@type': 'Thing',
      name: 'Gold price in Kerala, India',
      description: 'Live indicative gold and silver rates per gram for Kerala, India',
    },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    inLanguage: 'en-IN',
  }
}
