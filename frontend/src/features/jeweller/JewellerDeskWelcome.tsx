import { useCallback, useState } from 'react'
import { dashboardCopy } from '@/content/dashboardCopy'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(dashboardCopy.jeweller.storageKey) === '1'
  } catch {
    return false
  }
}

export function JewellerDeskWelcome() {
  const [dismissed, setDismissed] = useState(readDismissed)

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(dashboardCopy.jeweller.storageKey, '1')
    } catch {
      /* private mode */
    }
    setDismissed(true)
  }, [])

  if (dismissed) return null

  return (
    <section className="jeweller-desk-welcome" aria-label="Welcome">
      <div className="jeweller-desk-welcome__body">
        <p className="jeweller-desk-welcome__eyebrow">{dashboardCopy.jeweller.welcome.title}</p>
        <p className="jeweller-desk-welcome__lead">{dashboardCopy.jeweller.welcome.lead}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
        {dashboardCopy.jeweller.welcome.dismiss}
      </button>
    </section>
  )
}
