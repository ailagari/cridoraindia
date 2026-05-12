import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch, authUpload } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type DocRow = {
  id: number
  doc_type: string
  status: string
  file_url: string | null
}

type DocDef = {
  key: string
  label: string
  hint: string
  tier: 'essential' | 'supporting'
}

const JEWELLER_DOCS: DocDef[] = [
  {
    key: 'gst_certificate',
    label: 'GST registration certificate',
    hint: 'GST REG-01 / certificate showing GSTIN of the jewellery business.',
    tier: 'essential',
  },
  {
    key: 'pan_business',
    label: 'Business PAN card',
    hint: 'PAN issued in name of proprietorship / firm / company.',
    tier: 'essential',
  },
  {
    key: 'shop_establishment',
    label: 'Shop & Establishment Act registration',
    hint: 'State-specific shop licence under applicable Shops & Establishment legislation.',
    tier: 'essential',
  },
  {
    key: 'trade_license',
    label: 'Municipal trade / shop licence',
    hint: 'Issued by local municipality or Panchayat, as applicable.',
    tier: 'essential',
  },
  {
    key: 'address_proof_shop',
    label: 'Business address proof',
    hint: 'Utility bill / lease / property tax receipt for showroom address.',
    tier: 'essential',
  },
  {
    key: 'proprietor_aadhaar',
    label: 'Proprietor / authorised signatory Aadhaar',
    hint: 'For identity linkage with the business.',
    tier: 'essential',
  },
  {
    key: 'proprietor_pan',
    label: 'Proprietor / partner PAN',
    hint: 'Individual PAN of promoter or managing partner.',
    tier: 'supporting',
  },
  {
    key: 'bis_hallmark',
    label: 'BIS hallmarking licence',
    hint: 'Required when dealing in hallmarked jewellery under BIS rules.',
    tier: 'supporting',
  },
  {
    key: 'incorporation_certificate',
    label: 'Certificate of incorporation',
    hint: 'For companies registered with MCA.',
    tier: 'supporting',
  },
  {
    key: 'partnership_deed',
    label: 'Partnership deed / LLP agreement',
    hint: 'For partnership firms or LLPs.',
    tier: 'supporting',
  },
  {
    key: 'msme_udyam',
    label: 'MSME Udyam registration',
    hint: 'Optional — sector benefits & credit reference.',
    tier: 'supporting',
  },
  {
    key: 'iec_import_export',
    label: 'IEC (import-export code)',
    hint: 'If you import bullion or jewellery components.',
    tier: 'supporting',
  },
]

function statusLabel(
  status: string | undefined,
  uploaded: boolean,
): { text: string; tone: 'ok' | 'wait' | 'bad' | 'mute' } {
  if (!uploaded) return { text: 'Not uploaded', tone: 'mute' }
  if (status === 'verified') return { text: 'Verified', tone: 'ok' }
  if (status === 'rejected') return { text: 'Rejected', tone: 'bad' }
  return { text: 'Pending review', tone: 'wait' }
}

export function JewellerKybWorkflow() {
  const { user, refreshProfile } = useAuth()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await authFetch('/api/v1/kyc/documents/')
    if (res.ok) {
      const data = (await res.json()) as DocRow[]
      setDocs(data)
    }
  }, [])

  useEffect(() => {
    if (user?.user_type === 'jeweller') {
      void load()
    }
  }, [user, load])

  const docByType = useMemo(() => {
    const m = new Map<string, DocRow>()
    for (const d of docs) {
      m.set(d.doc_type, d)
    }
    return m
  }, [docs])

  const essential = useMemo(() => JEWELLER_DOCS.filter((d) => d.tier === 'essential'), [])
  const supporting = useMemo(() => JEWELLER_DOCS.filter((d) => d.tier === 'supporting'), [])

  const essentialUploaded = useMemo(
    () => essential.filter((r) => docByType.has(r.key)).length,
    [docByType, essential],
  )
  const supportingUploaded = useMemo(
    () => supporting.filter((r) => docByType.has(r.key)).length,
    [docByType, supporting],
  )

  const kycTone =
    user?.kyc_status === 'verified' ? 'ok' : user?.kyc_status === 'rejected' ? 'bad' : 'wait'

  const uploadDoc = async (docType: string, file: File | null) => {
    if (!file) return
    setError('')
    setMessage('')
    const fd = new FormData()
    fd.set('doc_type', docType)
    fd.set('file', file)
    const res = await authUpload('/api/v1/kyc/documents/upload/', fd)
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { detail?: string }
      setError(d.detail ?? 'Upload failed')
      return
    }
    setMessage(
      'Document received — Cridora site admin will verify before your storefront can go live.',
    )
    await load()
    await refreshProfile()
  }

  return (
    <div className="kyb-workflow-inner">
      <span className="pill">Jeweller KYB</span>
      <h2 className="dash-panel-title">Compliance &amp; document centre</h2>
      <p className="dash-panel-lead">
        Firm <strong style={{ color: 'var(--text)' }}>{user?.email}</strong> · GSTIN on file from application ·
        README visibility rules: listings stay private until site admin approval.
      </p>

      {message ? <p className="message-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="kyb-stat-grid">
        <div className={`kyb-stat kyb-stat--${kycTone}`}>
          <span className="kyb-stat__eyebrow">KYB status</span>
          <p className="kyb-stat__value">{user?.kyc_status ?? '—'}</p>
          <p className="kyb-stat__sub">Account gate for public marketplace visibility</p>
        </div>
        <div className="kyb-stat kyb-stat--gold">
          <span className="kyb-stat__eyebrow">Essential set</span>
          <p className="kyb-stat__value">
            {essentialUploaded} / {essential.length}
          </p>
          <p className="kyb-stat__sub">Required registrations &amp; proofs</p>
        </div>
        <div className="kyb-stat kyb-stat--violet">
          <span className="kyb-stat__eyebrow">Supporting</span>
          <p className="kyb-stat__value">
            {supportingUploaded} / {supporting.length}
          </p>
          <p className="kyb-stat__sub">Corporate, hallmark, trade extras</p>
        </div>
      </div>

      <p className="kyb-hint-banner">
        Upload PDF or clear photos. Filenames are kept for audit. Max ~8&nbsp;MB per file.
      </p>

      <section className="kyb-section" aria-labelledby="kyb-essential-heading">
        <h2 id="kyb-essential-heading" className="kyb-section__title">
          Essential registrations
        </h2>
        <KybDocTable rows={essential} docByType={docByType} tier="essential" onUpload={uploadDoc} />
      </section>

      <section className="kyb-section" aria-labelledby="kyb-support-heading">
        <h2 id="kyb-support-heading" className="kyb-section__title kyb-section__title--support">
          Supporting documents
        </h2>
        <p className="kyb-section__intro">
          Strengthen your profile with structure, hallmarking, or trade documents where they apply.
        </p>
        <KybDocTable rows={supporting} docByType={docByType} tier="supporting" onUpload={uploadDoc} />
      </section>
    </div>
  )
}

type TableProps = {
  rows: DocDef[]
  docByType: Map<string, DocRow>
  tier: 'essential' | 'supporting'
  onUpload: (docType: string, file: File | null) => void | Promise<void>
}

function KybDocTable({ rows, docByType, tier, onUpload }: TableProps) {
  return (
    <div className="kyb-table-wrap card">
      <table className="kyb-table">
        <caption className="sr-only">
          {tier === 'essential' ? 'Essential' : 'Supporting'} jeweller documents and upload actions
        </caption>
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Requirement</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const existing = docByType.get(row.key)
            const uploaded = Boolean(existing)
            const st = statusLabel(existing?.status, uploaded)
            const inputId = `kyb-upload-${row.key}`
            return (
              <tr key={row.key}>
                <td data-label="Document">
                  <div className="kyb-doc-name">{row.label}</div>
                  <div className="kyb-doc-hint">{row.hint}</div>
                </td>
                <td data-label="Requirement">
                  <span className={tier === 'essential' ? 'kyb-req kyb-req--ess' : 'kyb-req kyb-req--sup'}>
                    {tier === 'essential' ? 'Essential' : 'Supporting'}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={`kyb-pill kyb-pill--${st.tone}`}>{st.text}</span>
                </td>
                <td data-label="Actions">
                  <div className="kyb-actions">
                    {existing?.file_url ? (
                      <a
                        className="btn btn-ghost kyb-btn-sm"
                        href={existing.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View file
                      </a>
                    ) : null}
                    <input
                      id={inputId}
                      type="file"
                      className="sr-only"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        void onUpload(row.key, e.target.files?.[0] ?? null)
                        e.target.value = ''
                      }}
                    />
                    <label
                      htmlFor={inputId}
                      className={tier === 'essential' ? 'btn btn-primary kyb-btn-sm' : 'btn kyb-btn-silk kyb-btn-sm'}
                    >
                      {uploaded ? 'Replace' : 'Upload'}
                    </label>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
