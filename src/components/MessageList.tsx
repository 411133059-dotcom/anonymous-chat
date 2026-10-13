import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage, Member } from '../chat-service'
import { ArrowDownIcon, FlagIcon, SpinnerIcon, XIcon } from './Icons'
import { formatFull, formatTime } from '../utils/format'

interface Props {
  messages: ChatMessage[]
  myId: string
  hasMore: boolean
  loadingOlder: boolean
  loadFailed: boolean
  onLoadOlder: () => void
  onReport: (target: Member) => void
  onOpenImage: (src: string) => void
}

const LONG_PRESS_MS = 500
const NEAR_BOTTOM_PX = 80

function ImageBox({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="img-fallback img-fallback--thumb">
        <XIcon size={18} /> 圖片無法載入
      </div>
    )
  }
  return (
    <button type="button" className="thumb" onClick={onOpen} aria-label="放大圖片">
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </button>
  )
}

interface ItemProps {
  message: ChatMessage
  mine: boolean
  reportActive: boolean
  onActivateReport: (id: number | null) => void
  onReport: (target: Member) => void
  onOpenImage: (src: string) => void
}

function MessageItem({ message, mine, reportActive, onActivateReport, onReport, onOpenImage }: ItemProps) {
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)

  if (message.type === 'system') {
    return <div className="sys">{message.content}</div>
  }

  const cancelPress = () => {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }
  // 手機：長按氣泡後才出現「檢舉」；電腦：滑過就出現（純 CSS）
  const touchHandlers = mine
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType !== 'touch') return
          longPressed.current = false
          cancelPress()
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true
            onActivateReport(message.id)
          }, LONG_PRESS_MS)
        },
        onPointerUp: cancelPress,
        onPointerMove: cancelPress,
        onPointerCancel: cancelPress,
        onContextMenu: (e: React.MouseEvent) => {
          if (longPressed.current) e.preventDefault()
        },
      }

  const time = (
    <time className="msg__time mono" dateTime={message.createdAt} title={formatFull(message.createdAt)}>
      {formatTime(message.createdAt)}
    </time>
  )
  const body =
    message.type === 'image' ? (
      <ImageBox src={message.content} onOpen={() => onOpenImage(message.content)} />
    ) : (
      <div className="bubble">{message.content}</div>
    )

  return (
    <div className={`msg ${mine ? 'msg--mine' : 'msg--other'} ${reportActive ? 'is-report-active' : ''}`}>
      {!mine && <div className="msg__nick">{message.nickname}</div>}
      <div className="msg__row">
        {mine && time}
        <div className="msg__body" {...touchHandlers}>
          {body}
        </div>
        {!mine && time}
        {!mine && message.senderId && (
          <button
            type="button"
            className="report-btn"
            aria-label={`檢舉 ${message.nickname}`}
            onClick={() => {
              onActivateReport(null)
              onReport({ nickname: message.nickname ?? '', senderId: message.senderId as string })
            }}
          >
            <FlagIcon size={14} />
            <span>檢舉</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function MessageList({ messages, myId, hasMore, loadingOlder, loadFailed, onLoadOlder, onReport, onOpenImage }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const prevRef = useRef<{ firstId?: number; lastId?: number; height: number } | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [activeReport, setActiveReport] = useState<number | null>(null)

  const scrollToBottom = (smooth = false) => {
    const el = scrollerRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' })
  }

  // 訊息變動：載入舊訊息時保持位置、新訊息時決定要不要捲到底
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const firstId = messages[0]?.id
    const lastId = messages[messages.length - 1]?.id
    const prev = prevRef.current
    if (!prev) {
      el.scrollTop = el.scrollHeight
    } else {
      if (prev.firstId !== undefined && firstId !== undefined && firstId < prev.firstId) {
        el.scrollTop += el.scrollHeight - prev.height
      }
      const appended = prev.lastId === undefined ? [] : messages.filter((m) => m.id > (prev.lastId as number))
      if (appended.length > 0) {
        const own = appended.some((m) => m.senderId === myId)
        if (stickRef.current || own) {
          stickRef.current = true
          el.scrollTop = el.scrollHeight
        } else {
          setNewCount((c) => c + appended.length)
        }
      }
    }
    prevRef.current = { firstId, lastId, height: el.scrollHeight }
  }, [messages, myId, loadingOlder, hasMore])

  // 圖片等內容載入後高度會變：在底部時維持貼底
  useEffect(() => {
    const content = contentRef.current
    const el = scrollerRef.current
    if (!content || !el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight
      if (prevRef.current) prevRef.current.height = el.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // 內容太少、捲不動時，也要能自動載入更早的訊息
  useEffect(() => {
    const el = scrollerRef.current
    if (el && hasMore && !loadingOlder && !loadFailed && el.scrollHeight <= el.clientHeight + 1) onLoadOlder()
  }, [messages, hasMore, loadingOlder, loadFailed, onLoadOlder])

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    stickRef.current = atBottom
    if (atBottom) setNewCount(0)
    if (el.scrollTop < 60 && hasMore && !loadingOlder) onLoadOlder()
  }

  const hasChat = messages.some((m) => m.type !== 'system')

  return (
    <div className="messages">
      <div
        ref={scrollerRef}
        className="messages__scroller"
        onScroll={onScroll}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('.report-btn')) setActiveReport(null)
        }}
        role="log"
        aria-live="polite"
        aria-label="聊天訊息"
      >
        <div ref={contentRef} className="messages__content">
          {loadingOlder ? (
            <div className="sys sys--status">
              <SpinnerIcon size={16} /> 載入更早的訊息…
            </div>
          ) : !hasMore ? (
            <div className="sys sys--status">已經是最早的訊息</div>
          ) : loadFailed ? (
            <button type="button" className="sys sys--status sys--retry" onClick={onLoadOlder}>
              載入失敗，點這裡重試
            </button>
          ) : null}
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              mine={m.senderId === myId}
              reportActive={activeReport === m.id}
              onActivateReport={setActiveReport}
              onReport={onReport}
              onOpenImage={onOpenImage}
            />
          ))}
          {!hasChat && <div className="empty">還沒有人說話，來打個招呼吧</div>}
        </div>
      </div>
      {newCount > 0 && (
        <button
          type="button"
          className="jump-btn"
          onClick={() => {
            stickRef.current = true
            setNewCount(0)
            scrollToBottom(true)
          }}
        >
          有 {newCount} 則新訊息 <ArrowDownIcon size={16} />
        </button>
      )}
    </div>
  )
}
