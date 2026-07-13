import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SeoHead } from '@/components/SeoHead'
import { LEGAL_ROUTES } from '@/content/siteLegal'

const legalNav = [
  { to: LEGAL_ROUTES.editorialStandards, label: 'Editorial standards' },
  { to: LEGAL_ROUTES.privacy, label: 'Privacy policy' },
  { to: LEGAL_ROUTES.terms, label: 'Terms of use' },
  { to: LEGAL_ROUTES.disclaimer, label: 'Disclaimer' },
  { to: LEGAL_ROUTES.grievance, label: 'Grievance' },
  { to: LEGAL_ROUTES.contact, label: 'Contact' },
] as const

const sectionStyle = {
  margin: '0 0 1.35rem',
  color: 'var(--text-muted)',
  lineHeight: 1.65,
  fontSize: '0.95rem',
} as const

const h2Style = {
  margin: '1.75rem 0 0.5rem',
  fontSize: '1.05rem',
  color: 'var(--text)',
} as const

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={h2Style}>{title}</h2>
      <div style={sectionStyle}>{children}</div>
    </section>
  )
}

export function LegalDocumentLayout({
  eyebrow,
  title,
  lead,
  path,
  seoTitle,
  seoDescription,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  path: string
  seoTitle: string
  seoDescription: string
  children: ReactNode
}) {
  return (
    <>
      <SeoHead title={seoTitle} description={seoDescription} path={path} />
      <div
        className="container page enterprise-public"
        style={{ maxWidth: 760, paddingTop: '2.5rem', paddingBottom: '4rem' }}
      >
        <p className="enterprise-public__eyebrow">{eyebrow}</p>
        <h1 className="enterprise-public__title">{title}</h1>
        <p className="enterprise-public__lead">{lead}</p>

        <nav
          aria-label="Legal pages"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem 1rem',
            margin: '1.5rem 0 2rem',
            fontSize: '0.82rem',
          }}
        >
          {legalNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                color: item.to === path ? 'var(--gold)' : 'var(--text-muted)',
                textDecoration: item.to === path ? 'underline' : 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="card" style={{ padding: '1.5rem 1.65rem' }}>
          {children}
        </div>
      </div>
    </>
  )
}
