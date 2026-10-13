import { useEffect, useState } from 'react'
import { Overlay } from './Overlay'
import { SpinnerIcon, AlertIcon } from './Icons'
import type { PreparedImage } from '../utils/image'
import { formatBytes } from '../utils/format'
import { errorMessage } from '../utils/errors'

interface ImageSheetProps {
  image: PreparedImage
  onSend: (file: File) => Promise<void>
  onClose: () => void
}

/** 選好圖片後的預覽面板。 */
export function ImageSheet({ image, onSend, onClose }: ImageSheetProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => URL.revokeObjectURL(image.previewUrl), [image.previewUrl])

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await onSend(image.file)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Overlay variant="sheet" onClose={onClose} label="傳送圖片">
      <h2 className="panel__title">傳送圖片</h2>
      <div className="sheet__preview">
        <img src={image.previewUrl} alt="要傳送的圖片預覽" />
      </div>
      <p className="sheet__meta">
        {image.compressed ? (
          <>
            原本 <span className="mono">{formatBytes(image.originalSize)}</span>，已自動壓縮為{' '}
            <span className="mono">{formatBytes(image.file.size)}</span>
          </>
        ) : (
          <span className="mono">{formatBytes(image.file.size)}</span>
        )}
      </p>
      {error && (
        <p className="field-error" role="alert">
          <AlertIcon size={16} /> {error}
        </p>
      )}
      <div className="panel__actions">
        <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
          取消
        </button>
        <button type="button" className="btn btn--accent" onClick={send} disabled={busy} data-autofocus>
          {busy ? <SpinnerIcon size={18} /> : '送出'}
        </button>
      </div>
    </Overlay>
  )
}

interface UrlSheetProps {
  onSend: (url: string) => Promise<void>
  onClose: () => void
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** 貼圖片網址的面板。 */
export function UrlSheet({ onSend, onClose }: UrlSheetProps) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)

  const trimmed = url.trim()
  const valid = isHttps(trimmed)

  useEffect(() => setPreviewFailed(false), [trimmed])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSend(trimmed)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Overlay variant="sheet" onClose={onClose} label="貼圖片網址">
      <form onSubmit={submit}>
        <h2 className="panel__title">貼圖片網址</h2>
        <label className="field-label" htmlFor="image-url">
          圖片網址
        </label>
        <input
          id="image-url"
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          autoComplete="off"
          data-autofocus
        />
        {trimmed && !valid ? (
          <p className="field-error" role="alert">
            <AlertIcon size={16} /> 圖片網址需以 https:// 開頭
          </p>
        ) : (
          <p className="field-hint">只接受 https:// 開頭的網址</p>
        )}
        {valid && (
          <div className="sheet__preview">
            {previewFailed ? (
              <div className="img-fallback">圖片無法載入</div>
            ) : (
              <img src={trimmed} alt="圖片預覽" referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} />
            )}
          </div>
        )}
        {error && (
          <p className="field-error" role="alert">
            <AlertIcon size={16} /> {error}
          </p>
        )}
        <div className="panel__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn btn--accent" disabled={!valid || busy}>
            {busy ? <SpinnerIcon size={18} /> : '送出'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}
