import { useState } from 'react'
import { AdminFestivalBroadcastPanel } from '@/features/admin/AdminFestivalBroadcastPanel'
import { AdminNotificationStatsPanel } from '@/features/admin/AdminNotificationStatsPanel'
import { NotificationSettingsPanel } from '@/features/settings/NotificationSettingsPanel'

type Tab = 'campaigns' | 'gold' | 'prefs' | 'stats'

export function AdminNotificationsHubPanel() {
  const [tab, setTab] = useState<Tab>('campaigns')

  return (
    <div className="dash-panel-max">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Pushes &amp; alerts
        </h2>
        <p className="dash-coming__text">
          Schedule campaigns, configure gold movement alerts, and manage how you receive admin tray notifications.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`btn${tab === 'campaigns' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab('campaigns')}
          >
            Campaigns
          </button>
          <button
            type="button"
            className={`btn${tab === 'gold' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab('gold')}
          >
            Gold alerts
          </button>
          <button
            type="button"
            className={`btn${tab === 'prefs' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab('prefs')}
          >
            My preferences
          </button>
          <button
            type="button"
            className={`btn${tab === 'stats' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab('stats')}
          >
            Analytics
          </button>
        </div>
      </div>
      {tab === 'stats' ? <AdminNotificationStatsPanel /> : null}
      {tab === 'prefs' ? (
        <NotificationSettingsPanel
          title="Admin notification preferences"
          description="Control KYC/KYB tray alerts and optional promotional pushes sent to your admin account."
        />
      ) : null}
      {tab === 'campaigns' || tab === 'gold' ? <AdminFestivalBroadcastPanel tab={tab} /> : null}
    </div>
  )
}
