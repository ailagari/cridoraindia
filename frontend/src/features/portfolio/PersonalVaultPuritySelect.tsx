import {
  DEFAULT_PERSONAL_VAULT_PURITY,
  PERSONAL_VAULT_PURITY_OPTIONS,
} from '@/lib/personalVaultPurity'

export function PersonalVaultPuritySelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}) {
  const known = PERSONAL_VAULT_PURITY_OPTIONS.some((o) => o.value === value)
  const selectCls = className ?? 'input pf-vault-form__input'

  return (
    <select
      className={selectCls}
      value={value || DEFAULT_PERSONAL_VAULT_PURITY}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Purity"
    >
      {PERSONAL_VAULT_PURITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {value && !known ? (
        <option value={value}>{value}</option>
      ) : null}
    </select>
  )
}
