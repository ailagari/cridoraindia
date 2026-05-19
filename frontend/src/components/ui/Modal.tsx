import { useEffect, type ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  sheet?: boolean
}

const SIZE_CLASS: Record<ModalSize, string> = { sm: 'modal--sm', md: '', lg: 'modal--lg' }

export function Modal({ open, title, onClose, children, footer, size = 'md', sheet }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  if (sheet) {
    return (
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__handle" />
          <div className="modal__header"><p className="modal__title">{title}</p></div>
          <div className="modal__body">{children}</div>
          {footer ? <div className="modal__footer">{footer}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={['modal', SIZE_CLASS[size]].filter(Boolean).join(' ')} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <p className="modal__title">{title}</p>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
