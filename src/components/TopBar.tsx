import type { Member } from '../chat-service'
import { ChevronDownIcon, ChevronUpIcon, FlagIcon } from './Icons'

interface TopBarProps {
  count: number
  open: boolean
  reconnecting: boolean
  onToggle: () => void
  onLeave: () => void
}

export function TopBar({ count, open, reconnecting, onToggle, onLeave }: TopBarProps) {
  return (
    <header className="topbar">
      <h1 className="topbar__title">匿名聊天室</h1>
      <button
        type="button"
        className={`online-btn ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls="online-list"
        onClick={onToggle}
      >
        <span className={`dot ${reconnecting ? 'dot--off' : ''}`} />
        <span>{count} 人在線</span>
        {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onLeave}>
        離開
      </button>
    </header>
  )
}

interface OnlineListProps {
  members: Member[]
  myId: string
  onReport: (member: Member) => void
  onClose: () => void
}

export function OnlineList({ members, myId, onReport, onClose }: OnlineListProps) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="online" id="online-list" aria-label="在線名單">
        <ul>
          {members.map((m) => (
            <li key={m.senderId} className="online__row">
              <span className="dot" />
              <span className="online__name">{m.nickname}</span>
              {m.senderId === myId ? (
                <span className="tag-me">我</span>
              ) : (
                <button type="button" className="report-link" aria-label={`檢舉 ${m.nickname}`} onClick={() => onReport(m)}>
                  <FlagIcon size={14} /> 檢舉
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="online__note">3 位不同的人檢舉，對方就會被踢出聊天室。</p>
      </section>
    </>
  )
}
