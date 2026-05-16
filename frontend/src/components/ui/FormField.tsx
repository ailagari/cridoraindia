import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  /** For label[htmlFor] when child is a single focusable control with this id */
  htmlFor?: string
}

/**
 * Consistent label + hint + control + error stack (works with .input, selects, custom controls).
 */
export function FormField({ label, hint, error, children, htmlFor }: FormFieldProps) {
  const labelEl = htmlFor ? (
    <label className="ui-field__label" htmlFor={htmlFor}>
      {label}
    </label>
  ) : (
    <span className="ui-field__label">{label}</span>
  )

  return (
    <div className="ui-field">
      {labelEl}
      {hint ? <p className="ui-field__hint">{hint}</p> : null}
      <div className="ui-field__control">{children}</div>
      {error ? (
        <p className="ui-field__hint ui-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
