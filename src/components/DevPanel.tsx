import { useState } from 'react'
import type { DevTools } from '../chat-service'

/** 只在開發或網址帶 ?dev 時出現，用來測試很難自然遇到的畫面。 */
export function DevPanel({ tools, disconnected }: { tools: DevTools; disconnected: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="dev">
      <button type="button" className="dev__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        測試
      </button>
      {open && (
        <div className="dev__menu">
          <button type="button" disabled={disconnected} onClick={() => tools.disconnect()}>
            模擬斷線（8 秒後恢復）
          </button>
          <button type="button" onClick={() => tools.incoming(3)}>
            湧入 3 則新訊息
          </button>
          <button type="button" onClick={() => tools.kickMe(1)}>
            模擬被踢出（1 分鐘）
          </button>
          <button type="button" onClick={() => tools.kickMe(60)}>
            模擬被踢出（60 分鐘）
          </button>
        </div>
      )}
    </div>
  )
}
