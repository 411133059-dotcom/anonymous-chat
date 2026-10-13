import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatService, JoinResult, Member } from '../chat-service'
import { useChatRoom } from '../hooks/useChatRoom'
import { errorMessage } from '../utils/errors'
import { prepareImage, type PreparedImage } from '../utils/image'
import { TopBar, OnlineList } from './TopBar'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ConfirmDialog } from './ConfirmDialog'
import { ImageSheet, UrlSheet } from './Sheets'
import { Overlay } from './Overlay'
import { DevPanel } from './DevPanel'
import { AlertIcon } from './Icons'

interface Props {
  service: ChatService
  init: JoinResult
  onLeave: () => Promise<void>
  onKicked: (until: number) => void
}

type Confirm = { kind: 'leave' } | { kind: 'report'; target: Member } | null

const devEnabled = import.meta.env.DEV || new URLSearchParams(location.search).has('dev')

export function ChatRoom({ service, init, onLeave, onKicked }: Props) {
  const room = useChatRoom(service, init, onKicked)
  const myId = init.me.senderId

  const [onlineOpen, setOnlineOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [urlSheet, setUrlSheet] = useState(false)
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current)
      clearTimeout(toastTimer.current)
    },
    [],
  )

  const showNotice = useCallback((text: string) => {
    setNotice(text)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3000)
  }, [])

  const showToast = (text: string) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2500)
  }

  // 按 Esc 收起在線名單
  useEffect(() => {
    if (!onlineOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOnlineOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onlineOpen])

  const sendText = async (text: string): Promise<boolean> => {
    try {
      await service.sendText(text)
      return true
    } catch (err) {
      showNotice(errorMessage(err))
      return false
    }
  }

  const pickFile = async (file: File) => {
    try {
      setImage(await prepareImage(file))
    } catch (err) {
      showNotice(errorMessage(err))
    }
  }

  const askReport = (target: Member) => {
    setOnlineOpen(false)
    setConfirm({ kind: 'report', target })
  }

  return (
    <div className="room">
      <div className="room__head">
        <TopBar
          count={room.members.length}
          open={onlineOpen}
          reconnecting={room.reconnecting}
          onToggle={() => setOnlineOpen((v) => !v)}
          onLeave={() => setConfirm({ kind: 'leave' })}
        />
        {room.reconnecting && (
          <div className="statusbar" role="status">
            <AlertIcon size={16} /> 連線中斷，重新連線中…
          </div>
        )}
        {onlineOpen && (
          <OnlineList members={room.members} myId={myId} onReport={askReport} onClose={() => setOnlineOpen(false)} />
        )}
      </div>

      <MessageList
        messages={room.messages}
        myId={myId}
        hasMore={room.hasMore}
        loadingOlder={room.loadingOlder}
        loadFailed={room.loadFailed}
        onLoadOlder={room.loadOlder}
        onReport={askReport}
        onOpenImage={setLightbox}
      />

      <Composer
        disabled={room.reconnecting}
        notice={notice}
        onSend={sendText}
        onPickFile={pickFile}
        onOpenUrl={() => setUrlSheet(true)}
        onNotice={showNotice}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {devEnabled && service.dev && <DevPanel tools={service.dev} disconnected={room.reconnecting} />}

      {confirm?.kind === 'leave' && (
        <ConfirmDialog
          title="確定要離開嗎？"
          body="離開後會回到輸入代號的畫面，你可以換一個新代號再進來。"
          confirmLabel="離開"
          tone="accent"
          onCancel={() => setConfirm(null)}
          onConfirm={onLeave}
        />
      )}
      {confirm?.kind === 'report' && (
        <ConfirmDialog
          title={`檢舉「${confirm.target.nickname}」？`}
          body="3 位不同的人檢舉同一個人，對方就會被踢出聊天室，1 小時內不能再用同一個代號。"
          confirmLabel="檢舉"
          tone="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const { target } = confirm
            setConfirm(null)
            await service.report(target.senderId)
            showToast('已送出檢舉')
          }}
        />
      )}
      {urlSheet && (
        <UrlSheet
          onClose={() => setUrlSheet(false)}
          onSend={(url) => service.sendImageUrl(url)}
        />
      )}
      {image && (
        <ImageSheet image={image} onClose={() => setImage(null)} onSend={(file) => service.sendImageFile(file)} />
      )}
      {lightbox && (
        <Overlay variant="lightbox" label="放大的圖片" onClose={() => setLightbox(null)}>
          <button type="button" className="lightbox__close" aria-label="關閉" data-autofocus onClick={() => setLightbox(null)}>
            ✕
          </button>
          <img className="lightbox__img" src={lightbox} alt="" referrerPolicy="no-referrer" />
        </Overlay>
      )}
    </div>
  )
}
