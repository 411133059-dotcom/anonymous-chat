import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatError, createChatService, type JoinResult } from './chat-service'
import { ChatRoom } from './components/ChatRoom'
import { NicknameScreen } from './components/NicknameScreen'
import { SpinnerIcon } from './components/Icons'
import { errorMessage } from './utils/errors'
import { forgetNickname, getRememberedNickname, rememberNickname } from './utils/storage'

type Phase = { name: 'booting' } | { name: 'entry' } | { name: 'room'; init: JoinResult }

export default function App() {
  // 畫面只認 ChatService 這個介面，不知道背後是模擬版還是 Supabase
  const service = useMemo(() => createChatService(), [])
  const [phase, setPhase] = useState<Phase>(() =>
    getRememberedNickname() ? { name: 'booting' } : { name: 'entry' },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kickedUntil, setKickedUntil] = useState<number | null>(null)
  const booted = useRef(false)

  const join = async (nickname: string, remembered: boolean) => {
    setBusy(true)
    setError('')
    try {
      const init = await service.join(nickname)
      rememberNickname(nickname)
      setKickedUntil(null)
      setPhase({ name: 'room', init })
    } catch (err) {
      if (remembered) forgetNickname()
      if (err instanceof ChatError && err.code === 'banned' && err.until) {
        setKickedUntil(err.until)
      } else {
        setError(errorMessage(err))
      }
      setPhase({ name: 'entry' })
    } finally {
      setBusy(false)
    }
  }

  // 重新整理後，用記住的代號直接進入
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const remembered = getRememberedNickname()
    if (remembered) void join(remembered, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const leave = async () => {
    await service.leave()
    forgetNickname()
    setError('')
    setKickedUntil(null)
    setPhase({ name: 'entry' })
  }

  const kicked = (until: number) => {
    forgetNickname()
    setKickedUntil(until)
    setPhase({ name: 'entry' })
  }

  if (phase.name === 'booting') {
    return (
      <main className="boot" role="status">
        <SpinnerIcon size={28} />
        <p>正在進入聊天室…</p>
      </main>
    )
  }

  if (phase.name === 'room') {
    return <ChatRoom service={service} init={phase.init} onLeave={leave} onKicked={kicked} />
  }

  return (
    <NicknameScreen
      busy={busy}
      error={error}
      kickedUntil={kickedUntil}
      onSubmit={(nickname) => void join(nickname, false)}
      onEdit={() => setError('')}
    />
  )
}
