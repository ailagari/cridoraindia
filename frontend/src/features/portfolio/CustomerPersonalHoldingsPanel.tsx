import { useCallback, useEffect, useState } from 'react'
import {
  createPersonalHolding,
  deletePersonalDocument,
  deletePersonalHolding,
  fetchPersonalHolding,
  fetchPersonalHoldings,
  fetchPersonalVaultDocuments,
  openPersonalDocumentDownload,
  uploadPersonalDocument,
  type PersonalDocumentDTO,
  type PersonalHoldingDTO,
} from '@/lib/personalHoldingsApi'

function parseN(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

const CATS = [
  { v: 'ornament', l: 'Ornament' },
  { v: 'coin', l: 'Coin' },
  { v: 'bar', l: 'Bar' },
  { v: 'other', l: 'Other' },
]

const DOC_TYPES = [
  { v: 'purchase_invoice', l: 'Purchase invoice' },
  { v: 'gold_certificate', l: 'Gold certificate' },
  { v: 'purity_certificate', l: 'Purity certificate' },
  { v: 'valuation_document', l: 'Valuation' },
  { v: 'warranty_card', l: 'Warranty' },
  { v: 'product_image', l: 'Product photo' },
  { v: 'other', l: 'Other' },
]

function formatLedgerType(t: string): string {
  switch (t) {
    case 'purchase_invoice':
      return 'Purchase invoice'
    default:
      return t.replace(/_/g, ' ')
  }
}

export function CustomerPersonalHoldingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<PersonalHoldingDTO[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('ornament')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('BIS 916')
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const r = await fetchPersonalHoldings()
    if (!r) {
      setLoadErr('Could not load personal holdings.')
      setRows([])
      return
    }
    setRows(r.results ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submit = async () => {
    setBusy(true)
    const res = await createPersonalHolding({
      title: title.trim(),
      category,
      weight_grams: weight.trim(),
      purity: purity.trim() || 'BIS 916',
      purchase_source: purchaseSource.trim() || undefined,
      purchase_date: purchaseDate.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setLoadErr(res.detail)
      return
    }
    setFormOpen(false)
    setTitle('')
    setWeight('')
    setNotes('')
    setPurchaseSource('')
    setPurchaseDate('')
    void refresh()
    onChanged?.()
  }

  const removeHolding = async (id: number) => {
    if (!window.confirm('Remove this personal holding from your vault?')) return
    const r = await deletePersonalHolding(id)
    if (!r.ok) {
      setLoadErr(r.detail)
      return
    }
    void refresh()
    onChanged?.()
  }

  const docUpload = async (holdingId: number, file: File, docType: string) => {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('document_type', docType)
    const r = await uploadPersonalDocument(holdingId, fd)
    if (!r.ok) {
      setLoadErr(r.detail)
      return
    }
    void refresh()
    onChanged?.()
  }

  const removeDoc = async (holdingId: number, docId: number) => {
    if (!window.confirm('Delete this document?')) return
    const r = await deletePersonalDocument(holdingId, docId)
    if (!r.ok) {
      setLoadErr(r.detail)
      return
    }
    void refresh()
    onChanged?.()
  }

  return (
    <div>
      <div className="pf-vault-hero">
        <div>
          <h3 className="pf-vault-hero__title">Gold Records Vault</h3>
          <p className="pf-vault-hero__sub">
            Your physical gold wealth, organised — bills, certificates, and live reference value. MVP is{' '}
            <strong>tracking &amp; records only</strong> (not redeemable or transferable on Cridora).
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFormOpen((o) => !o)}>
          {formOpen ? 'Close form' : 'Add Personal Holding'}
        </button>
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {formOpen ? (
        <div className="card pf-vault-form" style={{ marginBottom: '1.25rem', padding: '1.1rem 1.2rem', borderRadius: 18 }}>
          <h4 className="pf-vault-form__head">Add to your vault</h4>
          <div className="pf-vault-form__grid">
            <label className="pf-vault-field">
              <span>Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wedding necklace" />
            </label>
            <label className="pf-vault-field">
              <span>Category</span>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATS.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.l}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-vault-field">
              <span>Weight (grams)</span>
              <input className="input tabular" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
            </label>
            <label className="pf-vault-field">
              <span>Purity</span>
              <input className="input" value={purity} onChange={(e) => setPurity(e.target.value)} />
            </label>
            <label className="pf-vault-field">
              <span>Purchase source (optional)</span>
              <input className="input" value={purchaseSource} onChange={(e) => setPurchaseSource(e.target.value)} />
            </label>
            <label className="pf-vault-field">
              <span>Purchase date</span>
              <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </label>
            <label className="pf-vault-field pf-vault-field--wide">
              <span>Notes</span>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy || !title.trim() || !weight.trim()} onClick={() => void submit()}>
            Save to vault
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No personal holdings yet. Add your first piece to see live reference value.</p>
      ) : (
        <div className="pf-vault-cards">
          {rows.map((h) => (
            <article key={h.id} className="card pf-vault-card">
              <header className="pf-vault-card__head">
                <div>
                  <h4 className="pf-vault-card__title">{h.title}</h4>
                  <p className="pf-vault-card__meta">
                    {h.category} · <span className="tabular">{h.weight_grams} g</span> · {h.purity}
                  </p>
                  {h.purchase_jeweller_label ? (
                    <p className="pf-vault-card__jeweller">{h.purchase_jeweller_label}</p>
                  ) : null}
                </div>
                <div className="pf-vault-card__side">
                  <span className={`pf-vault-badge pf-vault-badge--${h.verification_status}`}>{h.status_badge}</span>
                  <p className="pf-vault-card__inr tabular">₹{parseN(h.estimated_current_value_inr).toLocaleString('en-IN')}</p>
                  <p className="pf-vault-card__hint">Reference ₹ · est.</p>
                </div>
              </header>
              <div className="pf-vault-card__foot">
                <span className="pf-vault-pill">{h.document_count} documents</span>
                {h.purchase_source ? <span className="pf-vault-pill">{h.purchase_source}</span> : null}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((x) => (x === h.id ? null : h.id))}>
                  {expanded === h.id ? 'Hide vault files' : 'Documents'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeHolding(h.id)}>
                  Remove
                </button>
              </div>
              {expanded === h.id ? (
                <HoldingDocumentsPanel
                  holdingId={h.id}
                  onUpload={async (file, dt) => {
                    await docUpload(h.id, file, dt)
                  }}
                  onDownload={(doc) => openPersonalDocumentDownload(h.id, doc.id)}
                  onDelete={(doc) => void removeDoc(h.id, doc.id)}
                  onRefresh={() => void refresh()}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function HoldingDocumentsPanel({
  holdingId,
  onUpload,
  onDownload,
  onDelete,
  onRefresh,
}: {
  holdingId: number
  onUpload: (file: File, docType: string) => Promise<void>
  onDownload: (doc: PersonalDocumentDTO) => void
  onDelete: (doc: PersonalDocumentDTO) => void
  onRefresh: () => void
}) {
  const [docs, setDocs] = useState<PersonalDocumentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState('purchase_invoice')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const h = await fetchPersonalHolding(holdingId)
      if (!cancelled) {
        setDocs(h?.documents ?? [])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [holdingId])

  return (
    <div className="pf-vault-docs" style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-soft)' }}>
      <p className="pf-vault-disclaimer" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Cridora stores uploaded records for customer convenience and portfolio tracking purposes only. Uploaded documents are not
        government-certified ownership proof.
      </p>
      <div className="pf-vault-doc-add" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' }}>
        <select className="input" style={{ maxWidth: 220 }} value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((d) => (
            <option key={d.v} value={d.v}>
              {d.l}
            </option>
          ))}
        </select>
        <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
          Upload
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) {
                await onUpload(f, docType)
                const nh = await fetchPersonalHolding(holdingId)
                setDocs(nh?.documents ?? [])
                onRefresh()
              }
            }}
          />
        </label>
      </div>
      {loading ? (
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading documents…</p>
      ) : docs.length === 0 ? (
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No files yet for this holding.</p>
      ) : (
        <ul className="pf-vault-doc-grid" style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', display: 'grid', gap: '0.65rem' }}>
          {docs.map((d) => (
            <li key={d.id} className="card" style={{ padding: '0.75rem 1rem', borderRadius: 14, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 700, display: 'block' }}>{formatLedgerType(d.document_type)}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{d.original_filename || `File #${d.id}`}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block' }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</span>
                {d.invoice_number ? <span style={{ fontSize: '0.78rem' }}>Invoice {d.invoice_number}</span> : null}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownload(d)}>
                  Download
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    onDelete(d)
                    setDocs((prev) => prev.filter((x) => x.id !== d.id))
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CustomerVaultDocumentsTab() {
  const [rows, setRows] = useState<PersonalDocumentDTO[]>([])
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    setErr('')
    const r = await fetchPersonalVaultDocuments()
    if (!r) {
      setErr('Could not load documents.')
      setRows([])
      return
    }
    setRows(r.results ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div>
      <h3 className="pf-card__title" style={{ marginBottom: '0.35rem' }}>
        All vault documents
      </h3>
      <p className="pf-vault-disclaimer" style={{ marginBottom: '1rem' }}>
        Cridora stores uploaded records for customer convenience and portfolio tracking purposes only. Uploaded documents are not
        government-certified ownership proof.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No documents yet.</p>
      ) : (
        <ul className="pf-vault-doc-grid">
          {rows.map((d) => (
            <li key={d.id} className="pf-vault-doc-card">
              <div className="pf-vault-doc-card__body">
                <span className="pf-vault-doc-type">{formatLedgerType(d.document_type)}</span>
                <span className="pf-vault-doc-name">{d.holding_title ?? 'Holding'}</span>
                <span className="pf-vault-doc-meta">{d.original_filename}</span>
                <span className="pf-vault-doc-meta">{new Date(d.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="pf-vault-doc-actions">
                {d.holding_id != null ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openPersonalDocumentDownload(d.holding_id!, d.id)}
                  >
                    Download
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
