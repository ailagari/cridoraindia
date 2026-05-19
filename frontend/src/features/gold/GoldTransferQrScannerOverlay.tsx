import { useCallback, useEffect, useRef, useState } from 'react'
import { isNativeBarcodeScanAvailable, scanCridoraQrNative } from '@/lib/cridoraBarcodeScan'

const READER_ID = 'cridora-gold-transfer-qr-reader'

type Props = {
  open: boolean
  onClose: () => void
  onScan: (address: string) => void
  onError: (detail: string) => void
}

export function GoldTransferQrScannerOverlay({ open, onClose, onScan, onError }: Props) {
  const scannerRef = useRef<{ isScanning: boolean; stop: () => Promise<void>; clear: () => void } | null>(null)
  const [starting, setStarting] = useState(false)

  const stopWebScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      scanner.clear()
    } catch {
      /* ignore cleanup errors */
    }
  }, [])

  useEffect(() => {
    if (!open) {
      void stopWebScanner()
      return
    }

    if (isNativeBarcodeScanAvailable()) {
      let cancelled = false
      void (async () => {
        const result = await scanCridoraQrNative()
        if (cancelled) return
        if (result.ok) {
          onScan(result.address)
        } else if (!result.cancelled) {
          onError(result.detail)
        }
        onClose()
      })()
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    void (async () => {
      setStarting(true)
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(READER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            void (async () => {
              await stopWebScanner()
              onScan(decoded)
              onClose()
            })()
          },
          () => {},
        )
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Could not open camera.'
          onError(msg)
          onClose()
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    })()

    return () => {
      cancelled = true
      void stopWebScanner()
    }
  }, [open, onClose, onError, onScan, stopWebScanner])

  if (!open || isNativeBarcodeScanAvailable()) {
    return null
  }

  return (
    <div className="gold-transfer-scan-overlay" role="dialog" aria-modal="true" aria-label="Scan Cridora QR">
      <div className="gold-transfer-scan-overlay__header">
        <button type="button" className="btn btn-ghost gold-transfer-scan-overlay__close" onClick={onClose}>
          Close
        </button>
        <p className="gold-transfer-scan-overlay__title">Scan to send gold</p>
        <span aria-hidden="true" style={{ width: 52 }} />
      </div>
      <div className="gold-transfer-scan-overlay__frame">
        <div id={READER_ID} className="gold-transfer-scan-overlay__reader" />
        <div className="gold-transfer-scan-overlay__reticle" aria-hidden="true" />
      </div>
      <p className="gold-transfer-scan-overlay__hint">
        {starting ? 'Starting camera…' : 'Point at a Cridora vault QR code'}
      </p>
    </div>
  )
}
