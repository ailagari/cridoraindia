import { type FormEvent, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

type Props = {
  title?: string
  description?: string
}

export function ChangePasswordPanel({
  title = 'Change password',
  description = 'Enter your current password, then choose a new one (minimum 8 characters).',
}: Props) {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated. You remain signed in on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <h2 className="dash-coming__title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
        {title}
      </h2>
      <p className="dash-panel-lead">{description}</p>
      <form onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem', maxWidth: 420 }}>
        <label className="field">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {success ? (
          <p className="form-feedback form-feedback--success" role="status">
            {success}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
