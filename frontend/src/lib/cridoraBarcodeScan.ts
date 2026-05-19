import { Capacitor } from '@capacitor/core'
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { parseCridoraPayPayload } from '@/lib/parseCridoraPayPayload'

export type CridoraScanResult =
  | { ok: true; address: string }
  | { ok: false; detail: string; cancelled?: boolean }

export function isNativeBarcodeScanAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export async function scanCridoraQrNative(): Promise<CridoraScanResult> {
  try {
    const supported = await BarcodeScanner.isSupported()
    if (!supported.supported) {
      return { ok: false, detail: 'Barcode scanning is not supported on this device.' }
    }

    const perm = await BarcodeScanner.checkPermissions()
    if (perm.camera !== 'granted') {
      const req = await BarcodeScanner.requestPermissions()
      if (req.camera !== 'granted') {
        return { ok: false, detail: 'Camera permission is required to scan QR codes.' }
      }
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    })

    const raw = barcodes[0]?.rawValue ?? barcodes[0]?.displayValue ?? ''
    if (!raw) {
      return { ok: false, detail: 'No QR code detected.', cancelled: true }
    }

    const address = parseCridoraPayPayload(raw)
    if (!address) {
      return { ok: false, detail: 'Not a valid Cridora payment QR code.' }
    }
    return { ok: true, address }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scan failed.'
    const cancelled = /cancel/i.test(msg)
    return { ok: false, detail: cancelled ? 'Scan cancelled.' : msg, cancelled }
  }
}

export function parseScannedQrText(raw: string): CridoraScanResult {
  const address = parseCridoraPayPayload(raw)
  if (!address) {
    return { ok: false, detail: 'Not a valid Cridora payment QR code.' }
  }
  return { ok: true, address }
}
