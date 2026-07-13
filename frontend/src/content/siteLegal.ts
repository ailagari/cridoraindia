/** Publisher identity shown on legal and contact pages (AdSense / IT compliance). */
const DEFAULT_ADSENSE_PUBLISHER_ID = 'ca-pub-1180208702657280'

export const SITE_LEGAL = {
  publisherName: 'Cridora India',
  operatingBrand: 'Cridora',
  website: 'https://www.cridoraindia.com',
  location: 'Kerala, India',
  contactEmail: 'ops@cridora.in',
  supportEmail: 'support@cridora.in',
  grievanceEmail: 'grievance@cridora.in',
  waitlistUsersEmail: 'waitlist.users@cridora.in',
  waitlistJewellersEmail: 'waitlist.jewellers@cridora.in',
  adsensePublisherId:
    (import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined)?.trim() || DEFAULT_ADSENSE_PUBLISHER_ID,
  lastUpdated: '13 July 2026',
} as const

export const LEGAL_ROUTES = {
  privacy: '/privacy',
  terms: '/terms',
  disclaimer: '/disclaimer',
  grievance: '/grievance',
  contact: '/contact',
  editorialStandards: '/editorial-standards',
} as const
