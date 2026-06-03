import type { ToastTone } from '@/context/ToastContext'

export type ToastStackItem = {
  id: string
  message: string
  tone: ToastTone
}

type ToastStackProps = {
  items: ToastStackItem[]
  onDismiss: (id: string) => void
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'toast toast--success',
  error: 'toast toast--error',
  warning: 'toast toast--warning',
}

const TONE_LABEL: Record<ToastTone, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
}

export function ToastStack({ items, onDismiss }: ToastStackProps) {
  if (items.length === 0) return null

  return (
    <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={TONE_CLASS[item.tone]} role="status">
          <span className="toast__body">{item.message}</span>
          <button
            type="button"
            className="toast__dismiss"
            aria-label={`Dismiss ${TONE_LABEL[item.tone].toLowerCase()} notification`}
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
