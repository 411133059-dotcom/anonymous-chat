import { useEffect, useState } from 'react'
import { AlertIcon, BanIcon, ChatIcon, SpinnerIcon } from './Icons'
import { isValidNickname } from '../utils/nickname'
import { minutesUntil } from '../utils/format'

interface Props {
  busy: boolean
  error: string
  /** 被踢出時，可再進入的時間 */
  kickedUntil: number | null
  onSubmit: (nickname: string) => void
  onEdit: () => void
}

export function NicknameScreen({ busy, error, kickedUntil, onSubmit, onEdit }: Props) {
  const [value, setValue] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // 被踢出時每秒檢查一次，時間到就自動解除
  useEffect(() => {
    if (!kickedUntil) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [kickedUntil])

  const kicked = kickedUntil !== null && kickedUntil > now
  const trimmed = value.trim()
  const formatBad = trimmed.length > 0 && !isValidNickname(trimmed)
  const canSubmit = !busy && !kicked && isValidNickname(trimmed)

  return (
    <main className="entry">
      <form
        className="entry__card"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit(trimmed)
        }}
      >
        <div className={`entry__icon ${kicked ? 'entry__icon--danger' : ''}`}>
          {kicked ? <BanIcon size={28} /> : <ChatIcon size={28} />}
        </div>
        <h1 className="entry__title">{kicked ? '你已被踢出聊天室' : '匿名聊天室'}</h1>
        <p className="entry__lead">
          {kicked ? '有 3 位不同的使用者檢舉了你。' : '不用註冊，不用登入。取一個代號，就能和大家聊天。'}
        </p>

        {kicked && (
          <div className="countdown" role="timer">
            約 <span className="mono countdown__num">{minutesUntil(kickedUntil, now)}</span> 分鐘後可再進入
          </div>
        )}

        <label className="field-label" htmlFor="nickname">
          你的代號
        </label>
        <input
          id="nickname"
          className={`input ${error || formatBad ? 'input--error' : ''}`}
          value={value}
          disabled={kicked || busy}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={Boolean(error || formatBad)}
          aria-describedby="nickname-help"
          onChange={(e) => {
            setValue(e.target.value)
            onEdit()
          }}
        />
        <div id="nickname-help" className="field-help">
          {error ? (
            <p className="field-error" role="alert">
              <AlertIcon size={16} /> {error}
            </p>
          ) : formatBad ? (
            <p className="field-error" role="alert">
              <AlertIcon size={16} /> 代號需為 1–12 個中文、英文或數字
            </p>
          ) : null}
          <p className="field-hint">1–12 個中文、英文或數字</p>
        </div>

        <button type="submit" className="btn btn--accent btn--block" disabled={!canSubmit}>
          {busy ? <SpinnerIcon size={20} /> : kicked ? '進入（暫時無法使用）' : '進入'}
        </button>
      </form>
      <p className="entry__demo">展示版：目前看到的是模擬資料，不同裝置之間不會互通</p>
    </main>
  )
}
