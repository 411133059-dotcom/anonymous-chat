import { useLayoutEffect, useRef, useState } from 'react'
import { ImageIcon, LinkIcon, SendIcon, SpinnerIcon } from './Icons'
import { MAX_TEXT_LENGTH } from '../chat-service'
import { ALLOWED_IMAGE_TYPES } from '../utils/image'

interface Props {
  disabled: boolean
  notice: string
  onSend: (text: string) => Promise<boolean>
  onPickFile: (file: File) => void
  onOpenUrl: () => void
  onNotice: (text: string) => void
}

const isDesktopInput = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

export function Composer({ disabled, notice, onSend, onPickFile, onOpenUrl, onNotice }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 隨內容長高，最多約四行
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  const canSend = !disabled && !sending && text.trim().length > 0

  const submit = async () => {
    if (!canSend) return
    if (text.trim().length > MAX_TEXT_LENGTH) {
      onNotice('訊息太長')
      return
    }
    setSending(true)
    const ok = await onSend(text)
    setSending(false)
    if (ok) setText('')
  }

  const desktop = isDesktopInput()
  const placeholder = disabled
    ? '連線中，暫時無法送出…'
    : desktop
      ? '輸入訊息，按 Enter 送出，Shift + Enter 換行'
      : '輸入訊息…'

  return (
    <div className="composer">
      {notice && (
        <div className="composer__notice" role="alert">
          {notice}
        </div>
      )}
      <div className="composer__row">
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPickFile(file)
          }}
        />
        <button type="button" className="icon-btn" aria-label="選圖片" disabled={disabled} onClick={() => fileRef.current?.click()}>
          <ImageIcon />
        </button>
        <button type="button" className="icon-btn" aria-label="貼圖片網址" disabled={disabled} onClick={onOpenUrl}>
          <LinkIcon />
        </button>
        <textarea
          ref={areaRef}
          className="composer__input"
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label="訊息內容"
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // isComposing：中文輸入法選字時按 Enter 不能送出
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && isDesktopInput()) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        <button type="button" className="send-btn" aria-label="送出" disabled={!canSend} onClick={() => void submit()}>
          {sending ? <SpinnerIcon size={20} /> : <SendIcon />}
        </button>
      </div>
    </div>
  )
}
