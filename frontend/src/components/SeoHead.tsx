import { useEffect } from 'react'
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, type PageSeo } from '@/lib/seo'
import { goldRatesHreflangPair, isGoldRatesPath } from '@/lib/goldRatesPaths'

type JsonLd = Record<string, unknown> | Record<string, unknown>[]

type Props = PageSeo & {
  jsonLd?: JsonLd
  locale?: 'en' | 'ml'
  hreflang?: { en: string; ml: string }
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  let selector = `link[rel="${rel}"]`
  if (extra?.hreflang) {
    selector += `[hreflang="${extra.hreflang}"]`
  } else if (extra?.type) {
    selector += `[type="${extra.type}"]`
  } else if (rel === 'alternate') {
    selector += ':not([hreflang]):not([type])'
  }
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      el.setAttribute(k, v)
    }
  }
}

function removeJsonLdScripts() {
  document.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove())
}

function injectJsonLd(data: JsonLd) {
  removeJsonLdScripts()
  const blocks = Array.isArray(data) ? data : [data]
  for (const block of blocks) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo-jsonld', 'true')
    script.textContent = JSON.stringify(block)
    document.head.appendChild(script)
  }
}

export function SeoHead({
  title,
  description,
  path,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  noindex,
  jsonLd,
  locale = 'en',
  hreflang,
}: Props) {
  useEffect(() => {
    document.title = title

    upsertMeta('name', 'description', description)
    if (keywords) upsertMeta('name', 'keywords', keywords)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')

    const url = absoluteUrl(path)
    upsertLink('canonical', url)

    const alternates = hreflang ?? (isGoldRatesPath(path) ? goldRatesHreflangPair(path) : null)
    if (alternates) {
      upsertLink('alternate', absoluteUrl(alternates.en), { hreflang: 'en-IN' })
      upsertLink('alternate', absoluteUrl(alternates.ml), { hreflang: 'ml-IN' })
      upsertLink('alternate', absoluteUrl(alternates.en), { hreflang: 'x-default' })
      upsertLink('alternate', `${absoluteUrl('/feed/gold-rates.xml')}`, { type: 'application/rss+xml' })
    } else {
      upsertLink('alternate', url, { hreflang: 'en-IN' })
      upsertLink('alternate', url, { hreflang: 'ml-IN' })
      upsertLink('alternate', url, { hreflang: 'x-default' })
    }

    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('property', 'og:locale', locale === 'ml' ? 'ml_IN' : 'en_IN')
    upsertMeta('property', 'og:locale:alternate', locale === 'ml' ? 'en_IN' : 'ml_IN')

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage)

    if (jsonLd) injectJsonLd(jsonLd)
    else removeJsonLdScripts()

    return () => {
      removeJsonLdScripts()
    }
  }, [title, description, path, keywords, ogImage, noindex, jsonLd, locale, hreflang])

  return null
}
