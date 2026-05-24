/**
 * Android bank SMS listener for UPI payment auto-match (Capacitor WebView bridge).
 * Requires RECEIVE_SMS permission — requested when listening starts.
 */

import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { fractionalSubmitPaymentSms } from '@/lib/fractionalPurchaseApi'

export type PaymentSmsListenStatus =
  | 'unavailable'
  | 'bridge_missing'
  | 'permission_denied'
  | 'listening'
  | 'ready'

type CridoraPaymentSmsBridge = {
  hasPermission: () => boolean
  requestPermission: (orderId: number) => void
  start: (orderId: number) => void
  stop: () => void
}

type SmsListenerHandle = {
  stop: () => void
  status: PaymentSmsListenStatus
}

function getBridge(): CridoraPaymentSmsBridge | null {
  const bridge = (window as Window & { CridoraPaymentSms?: CridoraPaymentSmsBridge }).CridoraPaymentSms
  if (!bridge?.start) {
    return null
  }
  return bridge
}

export function isPaymentSmsBridgeAvailable(): boolean {
  return isNativeAndroid() && getBridge() != null
}

export function paymentSmsHasPermission(): boolean {
  const bridge = getBridge()
  if (!bridge?.hasPermission) {
    return false
  }
  try {
    return bridge.hasPermission()
  } catch {
    return false
  }
}

/** Request RECEIVE_SMS and start listening for the given order. */
export function requestPaymentSmsAccess(orderId: number): boolean {
  const bridge = getBridge()
  if (!bridge) {
    return false
  }
  try {
    bridge.start(orderId)
    return true
  } catch {
    return false
  }
}

export function stopPaymentSmsListener(): void {
  const bridge = getBridge()
  try {
    bridge?.stop?.()
  } catch {
    // ignore
  }
}

export function startPaymentSmsListener(
  orderId: number,
  onMatched?: (detail: { orderId: number; smsText: string }) => void,
): SmsListenerHandle | null {
  if (!isNativeAndroid()) {
    return null
  }
  const bridge = getBridge()
  if (!bridge) {
    return null
  }

  let stopped = false
  let submitBusy = false

  const handler = async (ev: Event) => {
    if (stopped || submitBusy) return
    const detail = (ev as CustomEvent<{ orderId: number; smsText: string }>).detail
    if (!detail || detail.orderId !== orderId || !detail.smsText?.trim()) return
    submitBusy = true
    try {
      const out = await fractionalSubmitPaymentSms(orderId, detail.smsText)
      if (out.ok && onMatched) {
        onMatched(detail)
      }
    } finally {
      submitBusy = false
    }
  }

  window.addEventListener('cridora-payment-sms', handler as EventListener)

  try {
    bridge.start(orderId)
  } catch {
    return null
  }

  return {
    status: paymentSmsHasPermission() ? 'listening' : 'ready',
    stop: () => {
      stopped = true
      window.removeEventListener('cridora-payment-sms', handler as EventListener)
      stopPaymentSmsListener()
    },
  }
}
