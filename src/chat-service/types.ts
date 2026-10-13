// 聊天服務的「插座形狀」：對應 docs/architecture.md 第 5 節。
// 畫面只認這個檔案；階段一的模擬版與階段二的 Supabase 版都要遵守它。

export type MessageType = 'text' | 'image' | 'system'

export interface ChatMessage {
  /** 由小到大，用來排序與去重 */
  id: number
  type: MessageType
  /** 系統提示為 null */
  nickname: string | null
  /** 系統提示為 null */
  senderId: string | null
  /** 文字內容／圖片網址／系統提示文字 */
  content: string
  /** ISO 時間字串，由「伺服器」決定 */
  createdAt: string
}

export interface Member {
  nickname: string
  senderId: string
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'kicked'

export type ChatErrorCode =
  | 'nickname_invalid'
  | 'nickname_taken'
  | 'banned'
  | 'rate_limited'
  | 'message_too_long'
  | 'image_too_large'
  | 'image_type_unsupported'
  | 'image_url_invalid'
  | 'network'

export class ChatError extends Error {
  readonly code: ChatErrorCode
  /** banned 時：解除封禁的時間（毫秒時間戳） */
  readonly until?: number

  constructor(code: ChatErrorCode, until?: number) {
    super(code)
    this.name = 'ChatError'
    this.code = code
    this.until = until
  }
}

export interface JoinResult {
  me: Member
  /** 最新的一批歷史訊息（依 id 由小到大） */
  messages: ChatMessage[]
  /** 更早之前是否還有歷史 */
  hasMore: boolean
  members: Member[]
}

export interface LoadOlderResult {
  messages: ChatMessage[]
  hasMore: boolean
}

export interface ChatEvents {
  'message:new': ChatMessage
  'presence:sync': Member[]
  'connection:lost': void
  /** 帶著斷線期間漏掉的訊息（已排序） */
  'connection:restored': ChatMessage[]
  /** until：可再進入的時間（毫秒時間戳） */
  'session:kicked': { until: number }
}

/** 只有模擬版提供，用來測試很難自然遇到的畫面。 */
export interface DevTools {
  /** 模擬斷線，數秒後自動恢復 */
  disconnect(): void
  /** 模擬自己被踢出，封禁指定分鐘數 */
  kickMe(minutes: number): void
  /** 立刻湧入幾則別人的新訊息 */
  incoming(count: number): void
}

export interface ChatService {
  join(nickname: string): Promise<JoinResult>
  leave(): Promise<void>
  sendText(text: string): Promise<void>
  /** 傳入的檔案已經過前端壓縮；服務端仍須再驗證類型與大小 */
  sendImageFile(file: File): Promise<void>
  sendImageUrl(url: string): Promise<void>
  report(targetSenderId: string): Promise<void>
  loadOlder(oldestId: number): Promise<LoadOlderResult>
  /** 訂閱事件，回傳取消訂閱的函式 */
  on<E extends keyof ChatEvents>(event: E, handler: (payload: ChatEvents[E]) => void): () => void
  dev?: DevTools
}

export const PAGE_SIZE = 50
export const MAX_TEXT_LENGTH = 1000
