/** Sample alert copy for jeweller ad preview (name vs logo branding). */

export type BrandingMode = 'name' | 'logo'

export type PreviewSample = {
  id: string
  category: string
  categoryLabel: string
  titleName: string
  titleLogo: string
  bodyName: string
  bodyLogo: string
}

const CRIDORA_ICON = '/icon-192.png'

export function substituteJewellerName(text: string, businessName: string): string {
  return text.replace(/\{name\}/g, businessName || 'Your shop')
}

export const JEWELLER_PREVIEW_SAMPLES: PreviewSample[] = [
  {
    id: 'gold_rate',
    category: 'gold',
    categoryLabel: 'Gold rate update',
    titleName: '{name} · Today\'s gold rate',
    titleLogo: '{name} · Gold update',
    bodyName:
      '22K gold is ₹7,495 per gram today. Rate updated on Cridora for your customers.',
    bodyLogo: '22K gold is ₹7,495/g today. Tap to see live rates on Cridora.',
  },
  {
    id: 'festival',
    category: 'promo',
    categoryLabel: 'Festival greeting',
    titleName: '{name} · Festival wishes',
    titleLogo: '{name} · Warm wishes',
    bodyName: 'Warm greetings to you and your family from {name}.',
    bodyLogo: 'Warm festival greetings from your trusted jeweller.',
  },
  {
    id: 'holding',
    category: 'portfolio',
    categoryLabel: 'Customer gold value',
    titleName: '{name} · Gold value update',
    titleLogo: '{name} · Your gold update',
    bodyName:
      'A customer\'s gold holding gained about ₹1,240 in estimated value today.',
    bodyLogo: 'Your gold chain gained about ₹1,240 in estimated value.',
  },
  {
    id: 'scheme',
    category: 'promo',
    categoryLabel: 'Scheme reminder',
    titleName: '{name} · Scheme reminder',
    titleLogo: '{name} · Savings scheme',
    bodyName: 'Friendly reminder: gold scheme installment due this Friday.',
    bodyLogo: 'Your gold savings scheme installment is due this Friday.',
  },
]

export function resolvePreviewCopy(
  sample: PreviewSample,
  businessName: string,
  mode: BrandingMode,
): { title: string; body: string; brandingLabel: string } {
  const name = businessName.trim() || 'Your shop'
  const titleRaw = mode === 'logo' ? sample.titleLogo : sample.titleName
  const bodyRaw = mode === 'logo' ? sample.bodyLogo : sample.bodyName
  return {
    title: substituteJewellerName(titleRaw, name),
    body: substituteJewellerName(bodyRaw, name),
    brandingLabel: mode === 'logo' ? `${name} via Cridora` : 'Cridora',
  }
}

export function previewIconUrl(logoUrl: string, mode: BrandingMode): string {
  if (mode === 'logo' && logoUrl.trim()) return logoUrl.trim()
  return CRIDORA_ICON
}

export const CRIDORA_ALERTS_CONTACT_EMAIL = 'ops@cridora.in'

export function contactMailtoHref(businessName: string): string {
  const subject = encodeURIComponent('Customer alert branding — enquiry')
  const body = encodeURIComponent(
    `Hello Cridora team,\n\nI would like to know more about customer phone alerts and branding for my shop.\n\nShop name: ${businessName || '(not set)'}\n\n`,
  )
  return `mailto:${CRIDORA_ALERTS_CONTACT_EMAIL}?subject=${subject}&body=${body}`
}
