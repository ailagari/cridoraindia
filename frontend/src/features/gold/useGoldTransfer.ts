import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GoldResolveRecipient, GoldWalletDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  fetchGoldWallet,
  resolveGoldUPI,
  sendGoldTransfer,
  vaultRowTotalGrams,
} from '@/lib/goldTransferApi'

type Options = {
  roleLabel: string
}

export function useGoldTransfer({ roleLabel }: Options) {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [goldUpiInput, setGoldUpiInput] = useState('')
  const [recipient, setRecipient] = useState<GoldResolveRecipient | null>(null)
  const [routingKind, setRoutingKind] = useState('')
  const [resolveErr, setResolveErr] = useState('')
  const [grams, setGrams] = useState('1.0')
  const [sendErr, setSendErr] = useState('')
  const [sendOk, setSendOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [fromCustodianId, setFromCustodianId] = useState<number | null>(null)

  const isCustomer = roleLabel === 'customer'

  const refreshWallet = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load gold wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
  }, [])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const sendEligibleVaults = useMemo(() => {
    if (!wallet?.vaults?.length) return []
    return wallet.vaults.filter((v) => vaultRowTotalGrams(v) > 1e-9)
  }, [wallet])

  useEffect(() => {
    if (!wallet?.vaults?.length) {
      setFromCustodianId(null)
      return
    }
    const rows = wallet.vaults.filter((v) => vaultRowTotalGrams(v) > 1e-9)
    if (rows.length === 0) {
      setFromCustodianId(null)
      return
    }
    const def = wallet.default_jeweller_id
    const prefer = rows.find((r) => r.custodian_id === def) ?? rows[0]
    setFromCustodianId((prev) => {
      if (prev != null && rows.some((r) => r.custodian_id === prev)) return prev
      return prefer.custodian_id
    })
  }, [wallet])

  const clearRecipient = useCallback(() => {
    setRecipient(null)
    setRoutingKind('')
    setResolveErr('')
    setSendErr('')
    setSendOk('')
  }, [])

  const resetSendState = useCallback(() => {
    setSendErr('')
    setSendOk('')
  }, [])

  const onResolve = useCallback(
    async (addressOverride?: string) => {
      const input = (addressOverride ?? goldUpiInput).trim()
      if (!input) {
        setResolveErr('Enter a recipient Cridora ID.')
        return false
      }
      setResolveErr('')
      setRecipient(null)
      setRoutingKind('')
      setSendOk('')
      setBusy(true)
      try {
        const out = await resolveGoldUPI(input)
        if (!out.found) {
          setResolveErr(out.detail ?? `No account for ${out.gold_upi ?? input}`)
          return false
        }
        if (out.recipient) {
          setRecipient(out.recipient)
          setGoldUpiInput(out.recipient.gold_upi || input)
          setRoutingKind(out.routing_kind ?? '')
        }
        return true
      } finally {
        setBusy(false)
      }
    },
    [goldUpiInput],
  )

  const onSend = useCallback(async () => {
    setSendErr('')
    setSendOk('')
    if (!recipient) {
      setSendErr('Resolve a recipient first.')
      return false
    }
    const upi = recipient.gold_upi || goldUpiInput.trim()
    setBusy(true)
    try {
      const fromId = isCustomer ? fromCustodianId : null
      const result = await sendGoldTransfer(upi, grams.trim(), fromId)
      if (!result.ok) {
        setSendErr(result.detail)
        return false
      }
      setWallet(result.wallet)
      setSendOk(`${result.detail} Sent ${grams.trim()} g to ${upi}.`)
      return true
    } finally {
      setBusy(false)
    }
  }, [recipient, goldUpiInput, grams, isCustomer, fromCustodianId])

  const selectedVaultGrams = useMemo(() => {
    if (!isCustomer || fromCustodianId == null) return null
    const row = sendEligibleVaults.find((v) => v.custodian_id === fromCustodianId)
    return row ? vaultRowTotalGrams(row) : null
  }, [isCustomer, fromCustodianId, sendEligibleVaults])

  const canSend =
    !busy &&
    recipient != null &&
    (!isCustomer || (fromCustodianId != null && sendEligibleVaults.length > 0))

  return {
    wallet,
    loadErr,
    goldUpiInput,
    setGoldUpiInput,
    recipient,
    routingKind,
    resolveErr,
    grams,
    setGrams,
    sendErr,
    sendOk,
    busy,
    fromCustodianId,
    setFromCustodianId,
    sendEligibleVaults,
    isCustomer,
    selectedVaultGrams,
    canSend,
    refreshWallet,
    clearRecipient,
    resetSendState,
    onResolve,
    onSend,
  }
}
