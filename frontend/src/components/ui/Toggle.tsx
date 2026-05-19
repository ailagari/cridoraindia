import { useId } from 'react'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  const id = useId()
  return (
    <div className="ds-row" style={{ gap: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <label className="toggle" htmlFor={id} style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        <input
          id={id}
          type="checkbox"
          className="toggle__input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle__track" />
        <span className="toggle__thumb" />
      </label>
      {label ? (
        <label htmlFor={id} style={{ fontSize: 'var(--ts-sm)', color: 'var(--text)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
          {label}
        </label>
      ) : null}
    </div>
  )
}
