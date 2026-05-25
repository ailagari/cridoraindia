type Props = {
  label?: string
  confirmMessage?: string
  disabled?: boolean
  busy?: boolean
  block?: boolean
  onCancel: () => void | Promise<void>
}

export function MobileDashboardCancelButton({
  label = 'Cancel',
  confirmMessage = 'Cancel this pending payment?',
  disabled = false,
  busy = false,
  block = false,
  onCancel,
}: Props) {
  const handleClick = () => {
    if (!window.confirm(confirmMessage)) return
    void onCancel()
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm dash-mobile-cancel-btn${block ? ' dash-mobile-cancel-btn--block' : ''}`}
      disabled={disabled || busy}
      onClick={handleClick}
    >
      {busy ? 'Cancelling…' : label}
    </button>
  )
}
