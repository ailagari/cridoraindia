import { useId } from 'react'

export type FileUploadTriggerPhase = 'idle' | 'uploading' | 'done' | 'error'

type FileUploadTriggerProps = {
  accept: string
  disabled?: boolean
  phase: FileUploadTriggerPhase
  idleLabel: string
  uploadingLabel?: string
  doneLabel?: string
  errorLabel?: string
  onFile: (file: File) => void
}

/**
 * File control for immediate uploads: shows idle → uploading → done / error on the trigger label.
 * Pair with global classes: ui-file-trigger, ui-file-trigger__input.
 */
export function FileUploadTrigger({
  accept,
  disabled = false,
  phase,
  idleLabel,
  uploadingLabel = 'Uploading…',
  doneLabel = 'Done',
  errorLabel = 'Try again',
  onFile,
}: FileUploadTriggerProps) {
  const id = useId()
  const label =
    phase === 'uploading' ? uploadingLabel : phase === 'done' ? doneLabel : phase === 'error' ? errorLabel : idleLabel

  const busy = phase === 'uploading' || disabled

  return (
    <label
      htmlFor={id}
      className={`ui-file-trigger btn btn-ghost${phase === 'uploading' ? ' ui-file-trigger--working' : ''}${phase === 'done' ? ' ui-file-trigger--done' : ''}${phase === 'error' ? ' ui-file-trigger--error' : ''}`}
    >
      <span className="ui-file-trigger__label">{label}</span>
      <input
        id={id}
        type="file"
        className="ui-file-trigger__input"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </label>
  )
}
