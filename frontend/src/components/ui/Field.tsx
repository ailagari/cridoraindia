import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

/* ─── Field wrapper ───────────────────────────────────────────────────────── */
type FieldProps = {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: (id: string) => ReactNode
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId()
  return (
    <div className="ds-field">
      <label className={['ds-field__label', required ? 'ds-field__label--required' : ''].filter(Boolean).join(' ')} htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {error ? <span className="ds-field__error" role="alert">{error}</span> : null}
      {!error && hint ? <span className="ds-field__hint">{hint}</span> : null}
    </div>
  )
}

/* ─── Input ───────────────────────────────────────────────────────────────── */
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  mono?: boolean
}

export function Input({ label, error, hint, mono, className, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required}>
      {(id) => (
        <input
          id={id}
          className={[
            'ds-field__input',
            error ? 'ds-field__input--error' : '',
            mono ? 'ds-field__input--mono' : '',
            className ?? '',
          ].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </Field>
  )
}

/* ─── Textarea ────────────────────────────────────────────────────────────── */
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required}>
      {(id) => (
        <textarea
          id={id}
          className={[
            'ds-field__input ds-field__textarea',
            error ? 'ds-field__input--error' : '',
            className ?? '',
          ].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </Field>
  )
}

/* ─── Select ──────────────────────────────────────────────────────────────── */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Select({ label, error, hint, children, className, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint} required={rest.required}>
      {(id) => (
        <div className="ds-field__select-wrap">
          <select
            id={id}
            className={[
              'ds-field__input ds-field__select',
              error ? 'ds-field__input--error' : '',
              className ?? '',
            ].filter(Boolean).join(' ')}
            {...rest}
          >
            {children}
          </select>
        </div>
      )}
    </Field>
  )
}
