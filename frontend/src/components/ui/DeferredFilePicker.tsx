import { useEffect, useId, useState } from 'react'

type DeferredFilePickerProps = {
  label: string
  accept: string
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  idleButtonLabel?: string
}

/**
 * Choose a file for a form that submits later (no upload yet).
 * Shows filename, optional image thumb, clear — uses shared ui-file-row / ui-file-trigger styles.
 */
export function DeferredFilePicker({
  label,
  accept,
  file,
  onChange,
  disabled = false,
  idleButtonLabel = 'Choose file',
}: DeferredFilePickerProps) {
  const id = useId()
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setThumbUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setThumbUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  return (
    <div className="ui-file-row">
      <span className="ui-file-row__label">{label}</span>
      <div className="ui-file-row__actions">
        <label
          htmlFor={id}
          className={`ui-file-trigger btn btn-ghost${file ? ' ui-file-trigger--has-file' : ''}`}
        >
          <span className="ui-file-trigger__label">{file ? 'Change file' : idleButtonLabel}</span>
          <input
            id={id}
            type="file"
            className="ui-file-trigger__input"
            accept={accept}
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              onChange(f)
            }}
          />
        </label>
        {file ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
      {file ? <p className="ui-file-row__meta">{file.name}</p> : <p className="ui-file-row__meta ui-file-row__meta--muted">No file chosen</p>}
      {thumbUrl ? <img src={thumbUrl} alt="" className="ui-file-row__thumb" /> : null}
    </div>
  )
}
