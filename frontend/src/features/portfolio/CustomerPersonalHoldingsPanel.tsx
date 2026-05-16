import { useCallback, useEffect, useState } from 'react'
import { FileUploadTrigger, type FileUploadTriggerPhase } from '@/components/ui'
import {
  createPersonalHolding,
  deletePersonalDocument,
  deletePersonalHolding,
  fetchPersonalHoldings,
  fetchPersonalVaultDocuments,
  openPersonalDocumentDownload,
  updatePersonalHolding,
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
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [editBusy, setEditBusy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('ornament')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('BIS 916')
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('')
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eCategory, setECategory] = useState('ornament')
  const [eWeight, setEWeight] = useState('')
  const [ePurity, setEPurity] = useState('')
  const [ePurchasePrice, setEPurchasePrice] = useState('')
  const [ePurchaseSource, setEPurchaseSource] = useState('')
  const [ePurchaseDate, setEPurchaseDate] = useState('')
  const [eNotes, setENotes] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const r = await fetchPersonalHoldings({ documents: true })
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

  useEffect(() => {
    if (!vaultSaveSuccess) return
    const t = window.setTimeout(() => setVaultSaveSuccess(''), 7000)
    return () => window.clearTimeout(t)
  }, [vaultSaveSuccess])

  const openEdit = (h: PersonalHoldingDTO) => {
    setEditingId(h.id)
    setETitle(h.title)
    setECategory(h.category)
    setEWeight(h.weight_grams)
    setEPurity(h.purity)
    setEPurchasePrice(h.purchase_price_inr_per_gram ?? '')
    setEPurchaseSource(h.purchase_source)
    setEPurchaseDate(h.purchase_date?.slice(0, 10) ?? '')
    setENotes(h.notes)
    setLoadErr('')
    setVaultSaveSuccess('')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async () => {
    if (editingId == null) return
    setEditBusy(true)
    setLoadErr('')
    try {
      const res = await updatePersonalHolding(editingId, {
        title: eTitle.trim(),
        category: eCategory,
        weight_grams: eWeight.trim(),
        purity: ePurity.trim() || 'BIS 916',
        purchase_source: ePurchaseSource.trim(),
        purchase_date: ePurchaseDate.trim() || null,
        purchase_price_inr_per_gram: ePurchasePrice.trim() ? ePurchasePrice.trim() : null,
        notes: eNotes.trim(),
      })
      if (!res.ok) {
        setLoadErr(res.detail)
        return
      }
      setEditingId(null)
      setVaultSaveSuccess(`“${res.data.title}” was updated.`)
      void refresh()
      onChanged?.()
    } catch {
      setLoadErr('Could not reach the server. Check your connection and try again.')
    } finally {
      setEditBusy(false)
    }
  }

  const submit = async () => {
    setLoadErr('')
    setVaultSaveSuccess('')
    setBusy(true)
    try {
      const res = await createPersonalHolding({
        title: title.trim(),
        category,
        weight_grams: weight.trim(),
        purity: purity.trim() || 'BIS 916',
        purchase_source: purchaseSource.trim() || undefined,
        purchase_date: purchaseDate.trim() || undefined,
        purchase_price_inr_per_gram: purchasePricePerGram.trim() || undefined,
        notes: notes.trim() || undefined,
      })
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
      setPurchasePricePerGram('')
      setVaultSaveSuccess(`“${res.data.title}” was saved to your vault. Documents are listed on the same card below.`)
      void refresh()
      onChanged?.()
    } catch {
      setLoadErr('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const removeHolding = async (id: number) => {
    if (!window.confirm('Remove this personal holding from your vault?')) return
    const r = await deletePersonalHolding(id)
    if (!r.ok) {
      setLoadErr(r.detail)
      return
    }
    if (editingId === id) setEditingId(null)
    void refresh()
    onChanged?.()
  }

  const removeDoc = async (holdingId: number, docId: number) => {
    if (!window.confirm('Delete this document?')) return false
    const r = await deletePersonalDocument(holdingId, docId)
    if (!r.ok) {
      setLoadErr(r.detail)
      return false
    }
    void refresh()
    onChanged?.()
    return true
  }

  return (
    <div>
      <div className="pf-vault-hero pf-vault-hero--bar">
        <div className="pf-vault-hero__text">
          <span className="pf-vault-hero__eyebrow">Personal vault</span>
          <h3 className="pf-vault-hero__title">Gold Records Vault</h3>
          <p className="pf-vault-hero__sub">
            Your physical gold wealth, organised — bills, certificates, and live reference value. MVP is{' '}
            <strong>tracking &amp; records only</strong> (not redeemable or transferable on Cridora).
          </p>
          {rows.length > 0 ? (
            <p className="pf-vault-hero__stat">
              <span className="pf-vault-hero__stat-num tabular">{rows.length}</span>{' '}
              {rows.length === 1 ? 'piece' : 'pieces'} in this vault
            </p>
          ) : (
            <p className="pf-vault-hero__stat pf-vault-hero__stat--empty">Start by adding your first piece.</p>
          )}
        </div>
        <div className="pf-vault-hero__actions">
          <button
            type="button"
            className={formOpen ? 'pf-vault-hero__cta pf-vault-hero__cta--muted' : 'pf-vault-hero__cta'}
            aria-expanded={formOpen}
            aria-controls="pf-vault-add-form"
            onClick={() =>
              setFormOpen((o) => {
                const next = !o
                if (next) {
                  setVaultSaveSuccess('')
                  setLoadErr('')
                }
                return next
              })
            }
          >
            {formOpen ? (
              <>
                <span className="pf-vault-hero__cta-icon pf-vault-hero__cta-icon--close" aria-hidden>
                  ×
                </span>
                Close form
              </>
            ) : (
              <>
                <span className="pf-vault-hero__cta-icon" aria-hidden>
                  +
                </span>
                Add personal holding
              </>
            )}
          </button>
        </div>
      </div>

      {loadErr ? (
        <p className="form-error" role="alert">
          {loadErr}
        </p>
      ) : null}
      {vaultSaveSuccess ? (
        <p className="form-feedback form-feedback--success pf-vault-save-flash" role="status">
          {vaultSaveSuccess}
        </p>
      ) : null}

      {formOpen ? (
        <div className="pf-vault-form" id="pf-vault-add-form" role="region" aria-labelledby="pf-vault-form-title" aria-busy={busy}>
          <header className="pf-vault-form__header">
            <span className="pf-vault-form__eyebrow">New record</span>
            <h4 id="pf-vault-form-title" className="pf-vault-form__title">
              Add to your vault
            </h4>
            <p className="pf-vault-form__lede">
              Capture what you own. Estimated value updates from the platform <strong className="tabular">22K</strong> reference rate — jeweller marks
              are not used for personal items.
            </p>
          </header>

          <div className="pf-vault-form__sections">
            <section className="pf-vault-form__section" aria-labelledby="pf-vault-section-item">
              <h5 id="pf-vault-section-item" className="pf-vault-form__section-title">
                Item
              </h5>
              <p className="pf-vault-form__section-hint">A clear name helps you find it in your vault later.</p>
              <label className="pf-vault-field">
                <span>Display title</span>
                <input
                  className="input pf-vault-form__input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Wedding necklace, BIS coin set…"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <div className="pf-vault-field">
                <span id="pf-vault-cat-label">Category</span>
                <div className="pf-vault-form__chips" role="group" aria-labelledby="pf-vault-cat-label">
                  {CATS.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      className={`pf-vault-form__chip${category === c.v ? ' pf-vault-form__chip--active' : ''}`}
                      aria-pressed={category === c.v}
                      onClick={() => setCategory(c.v)}
                      disabled={busy}
                    >
                      {c.l}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="pf-vault-form__section pf-vault-form__section--metal" aria-labelledby="pf-vault-section-metal">
              <h5 id="pf-vault-section-metal" className="pf-vault-form__section-title">
                Metal details
              </h5>
              <p className="pf-vault-form__section-hint">Weight must be greater than zero. Purity defaults to BIS 916.</p>
              <div className="pf-vault-form__metal-grid">
                <label className="pf-vault-field">
                  <span>Weight</span>
                  <div className="pf-vault-form__suffix-wrap">
                    <input
                      className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.000"
                      autoComplete="off"
                      disabled={busy}
                    />
                    <span className="pf-vault-form__suffix" aria-hidden>
                      g
                    </span>
                  </div>
                </label>
                <label className="pf-vault-field">
                  <span>Purity / hallmark</span>
                  <input
                    className="input pf-vault-form__input"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    placeholder="BIS 916"
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field pf-vault-field--wide">
                  <span>Purchase rate (₹/g, optional)</span>
                  <input
                    className="input pf-vault-form__input tabular"
                    value={purchasePricePerGram}
                    onChange={(e) => setPurchasePricePerGram(e.target.value)}
                    inputMode="decimal"
                    placeholder="What you paid per gram of gold"
                    disabled={busy}
                  />
                </label>
              </div>
            </section>

            <section className="pf-vault-form__section pf-vault-form__section--full" aria-labelledby="pf-vault-section-prov">
              <h5 id="pf-vault-section-prov" className="pf-vault-form__section-title">
                Optional provenance
              </h5>
              <p className="pf-vault-form__section-hint">Where you bought it and when — useful with invoices on the same card.</p>
              <div className="pf-vault-form__grid pf-vault-form__grid--prov">
                <label className="pf-vault-field">
                  <span>Source</span>
                  <input
                    className="input pf-vault-form__input"
                    value={purchaseSource}
                    onChange={(e) => setPurchaseSource(e.target.value)}
                    placeholder="Shop name, city, or “family”"
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field">
                  <span>Purchase date</span>
                  <input
                    className="input pf-vault-form__input"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field pf-vault-field--wide">
                  <span>Private notes</span>
                  <textarea
                    className="input pf-vault-form__textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Engraving, locker ID, reminder for valuation…"
                    disabled={busy}
                  />
                </label>
              </div>
            </section>
          </div>

          {busy ? (
            <p className="pf-vault-form__saving" role="status" aria-live="polite">
              Saving to your vault…
            </p>
          ) : null}

          <footer className="pf-vault-form__footer">
            <p className="pf-vault-form__mvp">
              <span className="pf-vault-form__mvp-tag">MVP</span> Tracking &amp; records only — not redeemable or transferable on Cridora.
            </p>
            <div className="pf-vault-form__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary pf-vault-form__submit"
                disabled={busy || !title.trim() || !weight.trim()}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : 'Add to vault'}
              </button>
            </div>
          </footer>
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

                  {h.purchase_price_inr_per_gram ? (

                    <p className="pf-vault-card__basis">

                      Recorded ₹<span className="tabular">{parseN(h.purchase_price_inr_per_gram).toLocaleString('en-IN')}</span>/g · cost basis ~₹

                      <span className="tabular">{parseN(h.purchase_cost_basis_inr).toLocaleString('en-IN')}</span>

                    </p>

                  ) : null}

                  {h.reference_gain_percent ? (

                    <p className={`pf-vault-card__gain${parseN(h.reference_gain_inr) < 0 ? ' pf-vault-card__gain--down' : ''}`}>

                      vs purchase rate: <span className="tabular">{parseN(h.reference_gain_inr).toLocaleString('en-IN')}</span> INR (

                      <span className="tabular">{h.reference_gain_percent}</span>%){' '}

                      <span className="pf-vault-card__gain-note">at reference ₹/g</span>

                    </p>

                  ) : null}

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

              <div className="pf-vault-card__foot pf-vault-card__foot--toolbar">
                <span className="pf-vault-pill">
                  {h.document_count} document{h.document_count === 1 ? '' : 's'}
                </span>
                {h.purchase_source ? <span className="pf-vault-pill">{h.purchase_source}</span> : null}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(h)} disabled={editingId === h.id}>
                  Edit
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeHolding(h.id)}>
                  Remove
                </button>
              </div>

              {editingId === h.id ? (

                <div className="pf-vault-edit" aria-busy={editBusy}>

                  <h5 className="pf-vault-form__section-title">Edit holding</h5>

                  <div className="pf-vault-form__grid">

                    <label className="pf-vault-field">

                      <span>Title</span>

                      <input className="input" value={eTitle} onChange={(e) => setETitle(e.target.value)} disabled={editBusy} />

                    </label>

                    <label className="pf-vault-field">

                      <span>Category</span>

                      <select className="input" value={eCategory} onChange={(e) => setECategory(e.target.value)} disabled={editBusy}>

                        {CATS.map((c) => (

                          <option key={c.v} value={c.v}>

                            {c.l}

                          </option>

                        ))}

                      </select>

                    </label>

                    <label className="pf-vault-field">

                      <span>Weight (g)</span>

                      <input className="input tabular" value={eWeight} onChange={(e) => setEWeight(e.target.value)} disabled={editBusy} />

                    </label>

                    <label className="pf-vault-field">

                      <span>Purity</span>

                      <input className="input" value={ePurity} onChange={(e) => setEPurity(e.target.value)} disabled={editBusy} />

                    </label>

                    <label className="pf-vault-field">

                      <span>Purchase ₹/g (optional)</span>

                      <input

                        className="input tabular"

                        value={ePurchasePrice}

                        onChange={(e) => setEPurchasePrice(e.target.value)}

                        placeholder="Leave blank to clear"

                        disabled={editBusy}

                      />

                    </label>

                    <label className="pf-vault-field">

                      <span>Source</span>

                      <input className="input" value={ePurchaseSource} onChange={(e) => setEPurchaseSource(e.target.value)} disabled={editBusy} />

                    </label>

                    <label className="pf-vault-field">

                      <span>Purchase date</span>

                      <input

                        className="input"

                        type="date"

                        value={ePurchaseDate}

                        onChange={(e) => setEPurchaseDate(e.target.value)}

                        disabled={editBusy}

                      />

                    </label>

                    <label className="pf-vault-field pf-vault-field--wide">

                      <span>Notes</span>

                      <textarea className="input" rows={2} value={eNotes} onChange={(e) => setENotes(e.target.value)} disabled={editBusy} />

                    </label>

                  </div>

                  <div className="pf-vault-edit__actions">

                    <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={editBusy}>

                      Cancel

                    </button>

                    <button

                      type="button"

                      className="btn btn-primary btn-sm"

                      disabled={editBusy || !eTitle.trim() || !eWeight.trim()}

                      onClick={() => void saveEdit()}

                    >

                      {editBusy ? 'Saving…' : 'Save changes'}

                    </button>

                  </div>

                </div>

              ) : null}



              <HoldingDocumentsPanel

                documents={h.documents ?? []}

                holdingId={h.id}

                onDownload={(doc) => openPersonalDocumentDownload(h.id, doc.id)}

                onDelete={async (doc) => removeDoc(h.id, doc.id)}

                onChanged={() => {

                  void refresh()

                  onChanged?.()

                }}

                onError={(msg) => setLoadErr(msg)}
              />

            </article>

          ))}

        </div>

      )}

    </div>

  )

}



function HoldingDocumentsPanel({

  documents,

  holdingId,

  onDownload,

  onDelete,

  onChanged,

  onError,

}: {

  documents: PersonalDocumentDTO[]

  holdingId: number

  onDownload: (doc: PersonalDocumentDTO) => void

  onDelete: (doc: PersonalDocumentDTO) => Promise<boolean>

  onChanged: () => void

  onError: (msg: string) => void

}) {

  const [docType, setDocType] = useState('purchase_invoice')

  const [feedback, setFeedback] = useState('')

  const [uploadPhase, setUploadPhase] = useState<FileUploadTriggerPhase>('idle')

  const [pickPreview, setPickPreview] = useState<{ url: string | null; name: string } | null>(null)

  const [replaceTarget, setReplaceTarget] = useState<PersonalDocumentDTO | null>(null)

  const fileGateBusy = uploadPhase === 'uploading' || uploadPhase === 'done'

  useEffect(() => {

    if (!feedback) return

    const t = window.setTimeout(() => setFeedback(''), 5000)

    return () => window.clearTimeout(t)

  }, [feedback])



  useEffect(() => {

    if (uploadPhase !== 'done' && uploadPhase !== 'error') return

    const ms = uploadPhase === 'done' ? 2200 : 4000

    const t = window.setTimeout(() => setUploadPhase('idle'), ms)

    return () => window.clearTimeout(t)

  }, [uploadPhase])



  const runUpload = async (file: File, type: string, replaceOf: PersonalDocumentDTO | null) => {

    let objectUrl: string | null = null

    if (file.type.startsWith('image/')) {

      objectUrl = URL.createObjectURL(file)

      setPickPreview({ url: objectUrl, name: file.name })

    } else {

      setPickPreview({ url: null, name: file.name })

    }

    setUploadPhase('uploading')

    setFeedback('')

    const fd = new FormData()

    fd.set('file', file)

    fd.set('document_type', type)

    try {

      const up = await uploadPersonalDocument(holdingId, fd)

      if (!up.ok) {

        onError(up.detail)

        setUploadPhase('error')

        return

      }

      if (replaceOf) {

        const del = await deletePersonalDocument(holdingId, replaceOf.id)

        if (!del.ok) {

          setFeedback(

            'New file is uploaded. We could not remove the old copy automatically — delete the duplicate file from the list if you still see it.',

          )

          setReplaceTarget(null)

          setUploadPhase('done')

          onChanged()

          return

        }

      }

      setFeedback(replaceOf ? 'File replaced.' : 'Uploaded.')

      setReplaceTarget(null)

      setUploadPhase('done')

      onChanged()

    } catch {

      onError('Could not reach the server.')

      setUploadPhase('error')

    } finally {

      if (objectUrl) URL.revokeObjectURL(objectUrl)

      setPickPreview(null)

    }

  }



  return (

    <div className="pf-vault-docs pf-vault-docs--inline">

      <div className="pf-vault-docs__head">

        <h5 className="pf-vault-form__section-title">Vault files</h5>

        {replaceTarget ? (

          <p className="pf-vault-docs__replace-hint" role="status">

            Replacing “{replaceTarget.original_filename || formatLedgerType(replaceTarget.document_type)}”. Choose a file below.

          </p>

        ) : null}

      </div>

      <p className="pf-vault-disclaimer">

        Cridora stores uploaded records for customer convenience and portfolio tracking only. They are not government-certified ownership

        proof.

      </p>

      {feedback ? (

        <p className="form-feedback form-feedback--success pf-vault-doc-feedback" role="status">

          {feedback}

        </p>

      ) : null}

      {pickPreview ? (

        <div className="ui-staging-preview" aria-live="polite">

          {pickPreview.url ? <img className="ui-staging-preview__thumb" src={pickPreview.url} alt="" /> : null}

          <p className="ui-staging-preview__meta">

            <strong>Selected:</strong> {pickPreview.name}

          </p>

        </div>

      ) : null}

      <div className="pf-vault-doc-add">

        <select className="input pf-vault-doc-add__type" value={docType} onChange={(e) => setDocType(e.target.value)} disabled={fileGateBusy}>

          {DOC_TYPES.map((d) => (

            <option key={d.v} value={d.v}>

              {d.l}

            </option>

          ))}

        </select>

        <FileUploadTrigger

          accept=".jpg,.jpeg,.png,.webp,.pdf"

          phase={uploadPhase}

          disabled={fileGateBusy}

          idleLabel={replaceTarget ? 'Choose replacement' : 'Upload file'}

          onFile={(f) => {

            const type = replaceTarget ? replaceTarget.document_type : docType

            void runUpload(f, type, replaceTarget)

          }}

        />

        {replaceTarget ? (

          <button type="button" className="btn btn-ghost btn-sm" disabled={fileGateBusy} onClick={() => setReplaceTarget(null)}>

            Cancel replace

          </button>

        ) : null}

      </div>

      {documents.length === 0 ? (

        <p className="pf-vault-docs__empty">No files yet — add invoices or photos here.</p>

      ) : (

        <ul className="pf-vault-doc-rows">

          {documents.map((d) => (

            <li key={d.id} className="pf-vault-doc-row">

              <div className="pf-vault-doc-row__main">

                <span className="pf-vault-doc-row__type">{formatLedgerType(d.document_type)}</span>

                <span className="pf-vault-doc-row__name">{d.original_filename || `File #${d.id}`}</span>

                <span className="pf-vault-doc-row__meta">{new Date(d.created_at).toLocaleDateString('en-IN')}</span>

                {d.invoice_number ? <span className="pf-vault-doc-row__meta">Invoice {d.invoice_number}</span> : null}

              </div>

              <div className="pf-vault-doc-row__actions">

                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownload(d)}>

                  View

                </button>

                <button

                  type="button"

                  className="btn btn-ghost btn-sm"

                  disabled={fileGateBusy}

                  onClick={() => {

                    setReplaceTarget(d)

                    setDocType(d.document_type)

                    setFeedback('')

                  }}

                >

                  Change

                </button>

                <button

                  type="button"

                  className="btn btn-ghost btn-sm"

                  disabled={fileGateBusy}

                  onClick={() => void onDelete(d).then((ok) => ok && setFeedback('Removed.'))}

                >

                  Remove

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

                    View

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

