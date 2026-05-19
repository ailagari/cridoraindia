import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch, authUpload } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { LIVE_KYC_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { Badge, Button, Card, CardHeader, DashboardWidget, Input, Table, statusTone } from '@/components/ui'

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
      <div className="page-header page-header--compact">
        <div className="page-header__text">
          <h1 className="page-header__title">Verification</h1>
        </div>
        <div className="page-header__actions">
          <Badge tone={kycTone === 'ok' ? 'success' : kycTone === 'bad' ? 'danger' : 'warning'}>{user?.kyc_status}</Badge>
        </div>
      </div>

      <div className="ds-grid-3">
        <DashboardWidget
          label="KYC"
          value={user?.kyc_status}
          tone={kycTone === 'ok' ? 'success' : kycTone === 'bad' ? 'danger' : 'gold'}
        />
        <DashboardWidget
          label="Documents"
          value={`${[has('aadhaar'), has('pan'), has('selfie_photo')].filter(Boolean).length} / 3`}
          tone={docDone ? 'success' : 'gold'}
        />
        <DashboardWidget label="Bank" value={bankStatus ?? '—'} tone={bankStatus === 'verified' ? 'success' : 'default'} />
      </div>

      {message ? <p className="ds-feedback ds-feedback--success" role="status">{message}</p> : null}
      {error ? <p className="ds-feedback ds-feedback--error" role="alert">{error}</p> : null}

      <Table
        columns={[
          {
            key: 'document',
            header: 'Document',
            render: (row) => row.label,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => {
              const d = docs.find((x) => x.doc_type === row.key)
              return <Badge tone={d ? statusTone(d.status) : 'neutral'}>{d ? d.status : 'Not uploaded'}</Badge>
            },
          },
          {
            key: 'action',
            header: 'Action',
            render: (row) => {
              const d = docs.find((x) => x.doc_type === row.key)
              const inputId = `cust-kyc-${row.key}`
              return (
                <div className="ds-row">
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
                    <a className="btn btn-ghost kyb-btn-sm" href={d.file_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : null}
                </div>
              )
            },
          },
        ]}
        rows={[
          { key: 'aadhaar', label: 'Aadhaar' },
          { key: 'pan', label: 'PAN' },
          { key: 'selfie_photo', label: 'Selfie' },
        ]}
        getRowKey={(row) => row.key}
      />

      <Card>
        <CardHeader
          title="Bank account"
          action={bankStatus ? (
            <Badge tone={bankStatus === 'verified' ? 'success' : bankStatus === 'rejected' ? 'danger' : 'warning'}>{bankStatus}</Badge>
          ) : null}
        />
        <form onSubmit={saveBank} className="ds-form ds-form--compact">
          <div className="ds-field-row">
            <Input label="Account holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
            <Input label="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          </div>
          <div className="ds-field-row">
            <Input label="IFSC" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} mono required />
            <Input label="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <Input label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <Button type="submit" variant="primary" block loading={busyBank}>Save bank details</Button>
        </form>
      </Card>
    </div>
  )
}
