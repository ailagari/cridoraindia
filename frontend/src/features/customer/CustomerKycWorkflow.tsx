import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch, authUpload } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { LIVE_KYC_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type DocRow = {
  id: number
  doc_type: string
  status: string
  file_url: string | null
}

export function CustomerKycWorkflow() {
  const { refreshProfile, user } = useAuth()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [bankName, setBankName] = useState('')
  const [branch, setBranch] = useState('')
  const [bankStatus, setBankStatus] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyBank, setBusyBank] = useState(false)

  const load = useCallback(async () => {
    const res = await authFetch('/api/v1/kyc/documents/')
    if (res.ok) {
      const data = (await res.json()) as DocRow[]
      setDocs(data)
    }
    const me = await authFetch('/api/v1/auth/me/')
    if (me.ok) {
      const m = (await me.json()) as {
        bank_account?: { status?: string; account_holder_name?: string }
      }
      if (m.bank_account) {
        setBankStatus(m.bank_account.status ?? null)
        setAccountHolder(m.bank_account.account_holder_name ?? '')
      }
    }
  }, [])

  useEffect(() => {
    if (user?.user_type === 'customer') {
      void load()
    }
  }, [user, load])

  useLivePoll(load, LIVE_KYC_POLL_MS, user?.user_type === 'customer' && !busyBank)

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
      `${docType} uploaded — pending Cridora admin review in the site admin console.`,
    )
    await load()
    await refreshProfile()
  }

  const saveBank = async (e: FormEvent) => {
    e.preventDefault()
    setBusyBank(true)
    setError('')
    setMessage('')
    try {
      const res = await authFetch('/api/v1/kyc/bank/', {
        method: 'POST',
        jsonBody: {
          account_holder_name: accountHolder,
          account_number: accountNumber,
          ifsc_code: ifsc,
          bank_name: bankName,
          branch,
        },
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as Record<string, string[]>
        const first = Object.values(d).flat()[0]
        setError(first ?? 'Could not save bank details')
        return
      }
      setMessage('Bank details saved — pending verification.')
      setBankStatus('pending')
      await refreshProfile()
    } finally {
      setBusyBank(false)
    }
  }

  const has = (t: string) => docs.some((d) => d.doc_type === t)

  const docDone = useMemo(() => {
    const need = ['aadhaar', 'pan', 'selfie_photo'] as const
    return need.every((t) => docs.some((d) => d.doc_type === t))
  }, [docs])

  const kycTone =
    user?.kyc_status === 'verified'
      ? 'ok'
      : user?.kyc_status === 'rejected'
        ? 'bad'
        : 'wait'

  return (
    <div className="kyc-workflow">
      <span className="pill">Customer KYC</span>
      <h2 className="dash-panel-title">Identity &amp; bank verification</h2>
      <p className="dash-panel-lead">
        Status <span className={`kyc-pill kyc-pill--${kycTone}`}>{user?.kyc_status}</span> — Aadhaar, PAN, live selfie, and bank details are reviewed by Cridora compliance before full platform access.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, marginTop: '-0.35rem' }}>
        Uploads and bank details support compliance review, but <strong>verification is decided by Cridora admin</strong> — they may approve accounts they already know without waiting for every file.
      </p>

      <div className="kyc-stat-grid">
        <div className={`kyc-stat kyc-stat--${kycTone}`}>
          <span className="kyc-stat__eyebrow">Account KYC</span>
          <p className="kyc-stat__value">{user?.kyc_status}</p>
          <p className="kyc-stat__sub">Site admin reviews in Cridora admin</p>
        </div>
        <div className={`kyc-stat kyc-stat--${docDone ? 'ok' : 'gold'}`}>
          <span className="kyc-stat__eyebrow">ID documents</span>
          <p className="kyc-stat__value">{[has('aadhaar'), has('pan'), has('selfie_photo')].filter(Boolean).length} / 3</p>
          <p className="kyc-stat__sub">Identity bundle</p>
        </div>
        <div className="kyc-stat kyc-stat--violet">
          <span className="kyc-stat__eyebrow">Bank</span>
          <p className="kyc-stat__value">{bankStatus ?? '—'}</p>
          <p className="kyc-stat__sub">Payouts &amp; settlements</p>
        </div>
      </div>

      {message ? <p className="message-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="kyc-table-wrap card" style={{ marginBottom: '1.25rem' }}>
        <table className="kyc-doc-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                { key: 'aadhaar', label: 'Aadhaar card' },
                { key: 'pan', label: 'PAN card' },
                { key: 'selfie_photo', label: 'Live selfie' },
              ] as const
            ).map((row) => {
              const d = docs.find((x) => x.doc_type === row.key)
              const st = d
                ? d.status === 'verified'
                  ? 'ok'
                  : d.status === 'rejected'
                    ? 'bad'
                    : 'wait'
                : 'mute'
              const inputId = `cust-kyc-${row.key}`
              return (
                <tr key={row.key}>
                  <td>
                    <div className="kyb-doc-name">{row.label}</div>
                    <div className="kyb-doc-hint">
                      {row.key === 'selfie_photo' ? 'Recent photo, clear face, JPG / PNG' : 'PDF or clear photo, max ~8 MB'}
                    </div>
                  </td>
                  <td>
                    <span className={`kyb-pill kyb-pill--${st}`}>
                      {d ? d.status : 'Not uploaded'}
                    </span>
                  </td>
                  <td>
                    <input
                      id={inputId}
                      type="file"
                      className="sr-only"
                      accept={row.key === 'selfie_photo' ? 'image/*' : 'image/*,.pdf'}
                      onChange={(e) => {
                        void uploadDoc(row.key, e.target.files?.[0] ?? null)
                        e.target.value = ''
                      }}
                    />
                    <label htmlFor={inputId} className="btn btn-primary kyb-btn-sm">
                      {d ? 'Replace' : 'Upload'}
                    </label>
                    {d?.file_url ? (
                      <a
                        className="btn btn-ghost kyb-btn-sm"
                        href={d.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="kyc-card-heading">Bank account</h3>
        {bankStatus ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 0 }}>
            Saved status: <strong>{bankStatus}</strong>
          </p>
        ) : null}
        <form onSubmit={saveBank} style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="field">
            <label htmlFor="ach">Account holder name (as per bank)</label>
            <input id="ach" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="acn">Account number</label>
            <input id="acn" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ifsc">IFSC code</label>
            <input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} required />
          </div>
          <div className="field">
            <label htmlFor="bnk">Bank name</label>
            <input id="bnk" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="br">Branch (optional)</label>
            <input id="br" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn--block" disabled={busyBank}>
            {busyBank ? 'Saving…' : 'Save bank details'}
          </button>
        </form>
      </div>
    </div>
  )
}
