import { useState } from 'react'
import { AdminEngagementTemplatesPanel } from '@/features/admin/AdminEngagementTemplatesPanel'
import { AdminGoldAlertsPanel } from '@/features/admin/AdminGoldAlertsPanel'
import { AdminNotificationStatsPanel } from '@/features/admin/AdminNotificationStatsPanel'
import { AdminSendMessagePanel } from '@/features/admin/AdminSendMessagePanel'
import { AdminSystemMessagesPanel } from '@/features/admin/AdminSystemMessagesPanel'
import { NotificationSettingsPanel } from '@/features/settings/NotificationSettingsPanel'

type Tab = 'send' | 'templates' | 'system' | 'gold' | 'stats' | 'prefs'

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'send', label: 'Send message', hint: 'Schedule phone alerts' },
  { id: 'templates', label: 'Engagement templates', hint: 'Portfolio & festival copy' },
  { id: 'system', label: 'System messages', hint: 'Automated OTP, gold, pay alerts' },
  { id: 'gold', label: 'Gold auto-alerts', hint: 'Automatic rate alerts' },
  { id: 'stats', label: 'Stats', hint: 'Delivery overview' },
  { id: 'prefs', label: 'My alerts', hint: 'This device' },
]

export function AdminNotificationsHubPanel() {
  const [tab, setTab] = useState<Tab>('send')

  return (
    <div className="dash-panel-max">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Message center
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '0.75rem', maxWidth: 720 }}>
          Send calm, factual alerts to customers. Schedule campaigns, edit automatic message
          templates, system notification copy, and manage gold rate notifications.
        </p>
        <div className="admin-msg-hub-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`btn${tab === t.id ? ' btn-primary' : ' btn-ghost'}`}
              title={t.hint}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'send' ? <AdminSendMessagePanel /> : null}
      {tab === 'templates' ? <AdminEngagementTemplatesPanel /> : null}
      {tab === 'system' ? <AdminSystemMessagesPanel /> : null}
      {tab === 'gold' ? <AdminGoldAlertsPanel /> : null}
      {tab === 'stats' ? <AdminNotificationStatsPanel /> : null}
      {tab === 'prefs' ? (
        <NotificationSettingsPanel
          title="Admin phone alerts"
          description="Control how this admin account receives KYC and operational tray alerts on this device."
        />
      ) : null}
    </div>
  )
}
