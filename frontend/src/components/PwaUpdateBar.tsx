import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyPwaUpdate, onPwaNeedRefresh } from '@/lib/pwaRegister'

export function PwaUpdateBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return onPwaNeedRefresh(() => setVisible(true))
  }, [])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div className="pwa-update-bar" role="status" aria-live="polite">
      <span className="pwa-update-bar-text">A new version of Cridora is ready.</span>
      <button
        type="button"
        className="btn btn-primary pwa-update-bar-btn"
        onClick={() => {
          void applyPwaUpdate(true)
        }}
      >
        Refresh
      </button>
    </div>,
    document.body,
  )
}
