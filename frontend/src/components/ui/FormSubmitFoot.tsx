import type { ReactNode } from 'react'

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
          {error?.trim() ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {success?.trim() ? (
            <p className="form-feedback form-feedback--success" role="status">
              {success}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="form-submit-foot__actions">{children}</div>
    </div>
  )
}
