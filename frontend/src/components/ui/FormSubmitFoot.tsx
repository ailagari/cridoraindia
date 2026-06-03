import { useEffect, type ReactNode } from 'react'
import { useToast } from '@/context/ToastContext'
import { Feedback } from './Feedback'

type FormSubmitFootProps = {
  error?: string
  success?: string
  children: ReactNode
  className?: string
  /** When true, show success via global toast instead of inline message only. */
  toastOnSuccess?: boolean
  /** When true, show errors via global toast instead of inline message only. */
  toastOnError?: boolean
}

/** Place validation / save messages directly above the primary submit control. */
export function FormSubmitFoot({
  error,
  success,
  children,
  className,
  toastOnSuccess = false,
  toastOnError = false,
}: FormSubmitFootProps) {
  const { showToast } = useToast()
  const err = error?.trim() ?? ''
  const ok = success?.trim() ?? ''

  useEffect(() => {
    if (toastOnError && err) showToast(err, 'error')
  }, [toastOnError, err, showToast])

  useEffect(() => {
    if (toastOnSuccess && ok) showToast(ok, 'success')
  }, [toastOnSuccess, ok, showToast])

  const showInlineError = Boolean(err) && !toastOnError
  const showInlineSuccess = Boolean(ok) && !toastOnSuccess
  const hasFeedback = showInlineError || showInlineSuccess

  return (
    <div className={className ? `form-submit-foot ${className}` : 'form-submit-foot'}>
      {hasFeedback ? (
        <div className="form-submit-foot__feedback" aria-live="polite">
          {showInlineError ? <Feedback>{err}</Feedback> : null}
          {showInlineSuccess ? <Feedback tone="success">{ok}</Feedback> : null}
        </div>
      ) : null}
      <div className="form-submit-foot__actions">{children}</div>
    </div>
  )
}
