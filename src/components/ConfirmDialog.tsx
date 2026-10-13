import { useState } from 'react'
import { Overlay } from './Overlay'
import { SpinnerIcon } from './Icons'

interface Props {
  title: string
  body: string
  confirmLabel: string
  tone: 'accent' | 'danger'
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export function ConfirmDialog({ title, body, confirmLabel, tone, onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay onClose={onCancel} label={title}>
      <h2 className="panel__title">{title}</h2>
      <p className="panel__body">{body}</p>
      <div className="panel__actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} data-autofocus>
          取消
        </button>
        <button type="button" className={`btn btn--${tone}`} onClick={confirm} disabled={busy}>
          {busy ? <SpinnerIcon size={18} /> : confirmLabel}
        </button>
      </div>
    </Overlay>
  )
}
