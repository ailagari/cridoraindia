import type { ReactNode } from 'react'
import { Feedback } from './Feedback'

type FormSubmitFootProps = {
  error?: string
  success?: string
  children: ReactNode
  className?: string
}

/** Place validation / save messages directly above the primary submit control. */
export function FormSubmitFoot({ error, success, children, className }: FormSubmitFootProps) {
  const hasFeedback = Boolean(error?.trim() || success?.trim())
  return (
    <div className={className ? `form-submit-foot ${className}` : 'form-submit-foot'}>
      {hasFeedback ? (
        <div className="form-submit-foot__feedback" aria-live="polite">
          {error?.trim() ? <Feedback>{error}</Feedback> : null}
          {success?.trim() ? <Feedback tone="success">{success}</Feedback> : null}
        </div>
      ) : null}
      <div className="form-submit-foot__actions">{children}</div>
    </div>
  )
}
