import { type FormEvent, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Button,
  DashboardPanel,
  Feedback,
  Input,
  PageHeader,
} from '@/components/ui'

type Props = {
  title?: string
}

export function ChangePasswordPanel({ title = 'Change password' }: Props) {
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
      setSuccess('Password updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardPanel>
      <PageHeader title={title} />
      <form onSubmit={(e) => void onSubmit(e)} className="ds-form" style={{ maxWidth: 420 }}>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
        {error ? <Feedback>{error}</Feedback> : null}
        {success ? <Feedback tone="success">{success}</Feedback> : null}
        <Button type="submit" variant="primary" loading={busy}>
          Update password
        </Button>
      </form>
    </DashboardPanel>
  )
}
