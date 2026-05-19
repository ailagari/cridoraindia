import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoldTransferQrScannerOverlay } from '@/features/gold/GoldTransferQrScannerOverlay'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { useGoldTransfer } from '@/features/gold/useGoldTransfer'
import { parseScannedQrText } from '@/lib/cridoraBarcodeScan'
import { formatVaultCardDisplay } from '@/lib/vaultRoutingDisplay'
import { vaultRowTotalGrams } from '@/lib/goldTransferApi'

type MobileMode = 'scan' | 'enter'
type MobileStep = 'pick' | 'pay'

type Props = {
  roleLabel: string
  initialMode?: MobileMode
  receiveQrPath?: string
}

const QUICK_GRAMS = ['0.1', '0.5', '1', '2']

const SEND_MODES = [
  { id: 'scan', label: 'Scan QR' },
  { id: 'enter', label: 'Enter ID' },
] as const

function formatGramChip(value: string): string {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return `${n} g`
}

export function GoldTransferMobileFlow({ roleLabel, initialMode = 'scan', receiveQrPath }: Props) {
  const navigate = useNavigate()
  const transfer = useGoldTransfer({ roleLabel })
  const [mode, setMode] = useState<MobileMode>(initialMode)
  const [step, setStep] = useState<MobileStep>('pick')
  const [scanOpen, setScanOpen] = useState(false)
  const [scanErr, setScanErr] = useState('')
  const [successToast, setSuccessToast] = useState('')

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (!successToast) return
    const timer = window.setTimeout(() => setSuccessToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [successToast])

  const balanceLabel = useMemo(() => {
    if (!transfer.wallet) return '—'
    return `${transfer.wallet.balance_grams} g`
  }, [transfer.wallet])

  const onScannedRaw = useCallback(
    async (raw: string) => {
      setScanErr('')
      const parsed = parseScannedQrText(raw)
      if (!parsed.ok) {
        setScanErr(parsed.detail)
        return
      }
      transfer.setGoldUpiInput(parsed.address)
      const ok = await transfer.onResolve(parsed.address)
      if (ok) setStep('pay')
    },
    [transfer],
  )

  const onVerifyManual = useCallback(async () => {
    setScanErr('')
    const ok = await transfer.onResolve()
    if (ok) setStep('pay')
  }, [transfer])

  const onSend = useCallback(async () => {
    const message = await transfer.onSend()
    if (message) {
      setSuccessToast(message)
      transfer.prepareForNextTransfer()
      setStep('pick')
    }
  }, [transfer])

  const onBackToPick = useCallback(() => {
    transfer.clearRecipient()
    transfer.resetSendState()
    setStep('pick')
  }, [transfer])

  const setQuickGrams = useCallback(
    (value: string) => {
      transfer.setGrams(value)
    },
    [transfer],
  )

  const setMaxGrams = useCallback(() => {
    if (transfer.selectedVaultGrams != null && transfer.selectedVaultGrams > 0) {
      transfer.setGrams(transfer.selectedVaultGrams.toFixed(4))
      return
    }
    if (transfer.wallet?.balance_grams) {
      transfer.setGrams(String(transfer.wallet.balance_grams))
    }
  }, [transfer])

  const goReceiveQr = useCallback(() => {
    if (receiveQrPath) navigate(receiveQrPath)
  }, [navigate, receiveQrPath])

  if (step === 'pay' && transfer.recipient) {
    const recipient = transfer.recipient
    const estInr =
      transfer.isCustomer && transfer.fromCustodianId != null
        ? (() => {
            const row = transfer.sendEligibleVaults.find((v) => v.custodian_id === transfer.fromCustodianId)
            if (!row?.jeweller_metal_rate_inr_per_gram) return null
            const g = Number.parseFloat(transfer.grams)
            const rate = Number.parseFloat(row.jeweller_metal_rate_inr_per_gram)
            if (!Number.isFinite(g) || !Number.isFinite(rate)) return null
            return Math.round(g * rate)
          })()
        : null

    return (
      <div className="dash-panel-max gold-transfer-mobile">
        <div className="gold-transfer-mobile__sheet">
          <button type="button" className="gold-transfer-mobile__back" onClick={onBackToPick}>
            ← Change recipient
          </button>

          <div className="gold-transfer-mobile__recipient">
            <span className="gold-transfer-mobile__recipient-label">Sending to</span>
            <p className="gold-transfer-mobile__recipient-name">{recipient.display_name}</p>
            <p className="gold-transfer-mobile__recipient-id tabular">
              {formatVaultCardDisplay(recipient.gold_upi)}
            </p>
            <p className="gold-transfer-mobile__recipient-meta">
              {recipient.user_type} · {recipient.jeweller_label}
            </p>
            {transfer.routingKind ? (
              <p className="gold-transfer-mobile__recipient-meta">
                {transfer.routingKind.replace(/_/g, ' ')}
              </p>
            ) : null}
          </div>

          {transfer.isCustomer && transfer.sendEligibleVaults.length > 0 ? (
            <div className="field">
              <label htmlFor="gold-transfer-mobile-from">Send from vault</label>
              <select
                id="gold-transfer-mobile-from"
                className="field-control"
                value={transfer.fromCustodianId ?? ''}
                onChange={(e) => transfer.setFromCustodianId(Number.parseInt(e.target.value, 10) || null)}
              >
                {transfer.sendEligibleVaults.map((v) => (
                  <option key={v.custodian_id} value={v.custodian_id}>
                    {v.custodian_label || `Jeweller ${v.custodian_id}`} · {vaultRowTotalGrams(v).toFixed(4)} g
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="gold-transfer-mobile-grams">Grams to send</label>
            <input
              id="gold-transfer-mobile-grams"
              value={transfer.grams}
              onChange={(e) => transfer.setGrams(e.target.value)}
              inputMode="decimal"
              className="gold-transfer-mobile__amount-input tabular"
            />
          </div>

          <div className="gold-transfer-mobile__chips" role="group" aria-label="Quick amounts">
            {QUICK_GRAMS.map((g) => (
              <button
                key={g}
                type="button"
                className={`gold-transfer-mobile__chip${transfer.grams === g ? ' gold-transfer-mobile__chip--active' : ''}`}
                onClick={() => setQuickGrams(g)}
              >
                {formatGramChip(g)}
              </button>
            ))}
            <button type="button" className="gold-transfer-mobile__chip" onClick={setMaxGrams}>
              Max
            </button>
          </div>

          {estInr != null ? (
            <p className="gold-transfer-mobile__estimate">Estimated value ~₹{estInr.toLocaleString('en-IN')}</p>
          ) : null}

          <button
            type="button"
            className="btn btn-primary btn--block gold-transfer-mobile__send"
            disabled={!transfer.canSend}
            onClick={() => void onSend()}
          >
            Send gold
          </button>

          {transfer.sendErr ? <p className="form-error">{transfer.sendErr}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="dash-panel-max gold-transfer-mobile">
      <div className="gold-transfer-mobile__balance card">
        <span className="gold-transfer-mobile__balance-label">Your balance</span>
        <p className="gold-transfer-mobile__balance-value tabular">{balanceLabel}</p>
        {transfer.wallet?.cridora_global_id ? (
          <p className="gold-transfer-mobile__balance-id tabular">
            {formatVaultCardDisplay(transfer.wallet.cridora_global_id)}
          </p>
        ) : null}
      </div>

      <DashSegmentPair
        items={[...SEND_MODES]}
        value={mode}
        onChange={(id) => setMode(id as MobileMode)}
        ariaLabel="Send method"
      />

      {transfer.loadErr ? <p className="form-error">{transfer.loadErr}</p> : null}
      {scanErr ? <p className="form-error">{scanErr}</p> : null}

      {mode === 'scan' ? (
        <button
          type="button"
          className="gold-transfer-mobile__scan-card"
          disabled={transfer.busy}
          onClick={() => {
            setScanErr('')
            setScanOpen(true)
          }}
        >
          <span className="gold-transfer-mobile__scan-icon" aria-hidden="true">
            ◫
          </span>
          <span className="gold-transfer-mobile__scan-title">Scan to send gold</span>
          <span className="gold-transfer-mobile__scan-sub">Point your camera at a Cridora vault QR</span>
        </button>
      ) : (
        <div className="card gold-transfer-mobile__enter-card">
          <div className="field">
            <label htmlFor="gold-transfer-mobile-recipient">Recipient Cridora ID</label>
            <input
              id="gold-transfer-mobile-recipient"
              value={transfer.goldUpiInput}
              onChange={(e) => transfer.setGoldUpiInput(e.target.value)}
              placeholder="8472910536@cridora"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={transfer.busy}
            onClick={() => void onVerifyManual()}
          >
            Verify recipient
          </button>
          {transfer.resolveErr ? <p className="form-error">{transfer.resolveErr}</p> : null}
        </div>
      )}

      {receiveQrPath ? (
        <button type="button" className="btn btn-ghost btn--block gold-transfer-mobile__receive-link" onClick={goReceiveQr}>
          Show my QR to receive gold
        </button>
      ) : null}

      <GoldTransferQrScannerOverlay
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(address) => void onScannedRaw(address)}
        onError={(detail) => setScanErr(detail)}
      />

      {successToast ? (
        <div className="gold-transfer-mobile-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      ) : null}
    </div>
  )
}
