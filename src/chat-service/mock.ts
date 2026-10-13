// 階段一的「模擬版聊天服務」。全部在瀏覽器裡運作：
// - 訊息、在線名單、封禁記錄存在 localStorage，重新整理後還在
// - 用 BroadcastChannel 讓同一台電腦的多個分頁互相同步
// - 內建幾個會定時說話、進出的假使用者
// 階段二會用 Supabase 版取代它，畫面不需要改。

import {
  ChatError,
  MAX_TEXT_LENGTH,
  PAGE_SIZE,
  type ChatEvents,
  type ChatMessage,
  type ChatService,
  type DevTools,
  type JoinResult,
  type LoadOlderResult,
  type Member,
} from './types'
import { isValidNickname } from '../utils/nickname'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, blobToDataUrl, compressImage } from '../utils/image'
import { readJSON, removeKey, writeJSON } from '../utils/storage'

const KEY = {
  messages: 'mock-chat:messages',
  presence: 'mock-chat:presence',
  bots: 'mock-chat:bots',
  bans: 'mock-chat:bans',
  leader: 'mock-chat:leader',
  sender: 'mock-chat:sender-id',
}
const CHANNEL = 'mock-chat'

const MIN_SEND_GAP = 1000
const TICK_MS = 2000
/** 超過這麼久沒心跳，視為已離開（真實版是約 60 秒） */
const STALE_MS = 15000
const BAN_MS = 60 * 60 * 1000
const MAX_STORED = 500
/** 模擬版：只要 1 個人檢舉就踢出，方便測試（真實版是 3 個不同的人） */
const REPORT_THRESHOLD = 1

// localStorage 只有幾 MB，所以模擬版把圖片壓得比真實版小
const MOCK_IMAGE_BYTES = 250 * 1024
const MOCK_GIF_BYTES = 600 * 1024

const BOT_NAMES = ['夜貓', '阿花', '小明', 'Kevin', '路過的人', '咖啡不加糖']
const BOT_LINES = [
  '有人在嗎',
  '今天好熱',
  '剛下班，好累',
  '晚餐吃什麼好',
  '這首歌好聽',
  '明天又要上班了',
  '哈哈哈哈',
  '有人跟我一樣睡不著嗎',
  '推薦一下好看的影集',
  '剛剛窗外有好大的雨聲',
  '我先去泡杯茶',
  '週末有人要出門嗎',
  '好想吃宵夜',
  '晚上的風很舒服',
  '真的假的',
  '好久沒有這麼安靜了',
]
const BOT_REPLIES = ['哈哈真的', '同意', '然後呢？', '我也是', '晚安～', '+1', '欸這個有趣']

interface PresenceEntry {
  nickname: string
  seen: number
}
type PresenceMap = Record<string, PresenceEntry>
type BanMap = Record<string, number>
type Handler = (payload: never) => void

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function getSenderId(): string {
  // 放在 sessionStorage：同一個分頁重新整理是「同一個人」，另開分頁是「另一個人」
  try {
    const existing = sessionStorage.getItem(KEY.sender)
    if (existing) return existing
    const id = 'u-' + randomId()
    sessionStorage.setItem(KEY.sender, id)
    return id
  } catch {
    return 'u-' + randomId()
  }
}

function svgImage(from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="600" height="360" fill="url(#g)"/><circle cx="440" cy="110" r="46" fill="#fff" fill-opacity=".35"/>` +
    `<path d="M0 360V270l130-90 110 70 140-120 220 150v80z" fill="#000" fill-opacity=".22"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function seedMessages(): ChatMessage[] {
  const total = 130
  const start = Date.now() - 6 * 60 * 60 * 1000
  const images = [svgImage('#4b6cb7', '#182848'), svgImage('#ee9ca7', '#5f2c82'), svgImage('#56ab2f', '#134e5e')]
  const list: ChatMessage[] = []
  for (let i = 0; i < total; i++) {
    const name = BOT_NAMES[i % 3 === 0 ? (i / 3) % BOT_NAMES.length : (i * 5 + 1) % BOT_NAMES.length]
    const base = { id: i + 1, createdAt: new Date(start + i * 160000).toISOString() }
    const bot = { nickname: name, senderId: `bot:${name}` }
    if (i % 17 === 8) {
      list.push({ ...base, type: 'system', nickname: null, senderId: null, content: `${name} 進入了聊天室` })
    } else if (i % 17 === 15) {
      list.push({ ...base, type: 'system', nickname: null, senderId: null, content: `${name} 離開了聊天室` })
    } else if (i % 31 === 20) {
      list.push({ ...base, ...bot, type: 'image', content: images[Math.floor(i / 31) % images.length] })
    } else if (i === 100) {
      list.push({ ...base, ...bot, type: 'image', content: 'https://invalid.example/broken.png' })
    } else {
      list.push({ ...base, ...bot, type: 'text', content: BOT_LINES[(i * 7 + 3) % BOT_LINES.length] })
    }
  }
  return list
}

function readMessages(): ChatMessage[] {
  let list = readJSON<ChatMessage[] | null>(KEY.messages, null)
  if (!list || list.length === 0) {
    list = seedMessages()
    writeJSON(KEY.messages, list)
  }
  return list
}

export class MockChatService implements ChatService {
  private listeners = new Map<string, Set<Handler>>()
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  private senderId = getSenderId()
  private tabId = randomId()
  private me: Member | null = null
  private connected = true
  private lastEmittedId = 0
  private lastSentAt = 0
  private lastMembersJson = ''
  private tickTimer: number | null = null

  readonly dev: DevTools = {
    disconnect: () => this.simulateDisconnect(),
    kickMe: (minutes) => this.kickSelf(minutes * 60 * 1000),
    incoming: (count) => {
      for (let i = 0; i < count; i++) this.botSpeak()
    },
  }

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent<{ type: string; senderId?: string; until?: number }>) => {
        if (e.data.type === 'kick' && e.data.senderId === this.senderId && this.me) {
          this.handleKicked(e.data.until ?? Date.now() + BAN_MS)
          return
        }
      }
    }
    // 其他分頁寫入 localStorage 後，這個事件才保證「資料已經讀得到」。
    // （BroadcastChannel 的通知可能比 localStorage 的內容更早抵達，直接讀會讀到舊資料）
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key.startsWith('mock-chat:')) this.sync()
    })
  }

  // ---------- 事件 ----------

  on<E extends keyof ChatEvents>(event: E, handler: (payload: ChatEvents[E]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) this.listeners.set(event, (set = new Set()))
    set.add(handler as Handler)
    return () => set.delete(handler as Handler)
  }

  private emit<E extends keyof ChatEvents>(event: E, payload: ChatEvents[E]) {
    this.listeners.get(event)?.forEach((h) => (h as (p: ChatEvents[E]) => void)(payload))
  }

  // ---------- 指令 ----------

  async join(nickname: string): Promise<JoinResult> {
    await delay(350)
    if (!isValidNickname(nickname)) throw new ChatError('nickname_invalid')
    this.pruneStale()
    const until = this.banUntil(nickname)
    if (until) throw new ChatError('banned', until)
    if (this.isNicknameTaken(nickname)) throw new ChatError('nickname_taken')

    const presence = this.readPresence()
    const existing = presence[this.senderId]
    presence[this.senderId] = { nickname, seen: Date.now() }
    writeJSON(KEY.presence, presence)
    // 同一個人重新整理回來，不重複寫「進入」提示
    if (!existing || existing.nickname !== nickname) {
      this.append({ type: 'system', nickname: null, senderId: null, content: `${nickname} 進入了聊天室` })
    }

    const all = readMessages()
    this.me = { nickname, senderId: this.senderId }
    this.connected = true
    this.lastEmittedId = all[all.length - 1].id
    this.lastMembersJson = ''
    this.startTicking()

    const messages = all.slice(-PAGE_SIZE)
    return {
      me: this.me,
      messages,
      hasMore: all.length > messages.length,
      members: this.members(),
    }
  }

  async leave(): Promise<void> {
    await delay(150)
    const me = this.me
    if (!me) return
    this.stopTicking()
    const presence = this.readPresence()
    delete presence[me.senderId]
    writeJSON(KEY.presence, presence)
    this.me = null
    this.append({ type: 'system', nickname: null, senderId: null, content: `${me.nickname} 離開了聊天室` })
  }

  async sendText(text: string): Promise<void> {
    await delay(120)
    const me = this.assertCanSend()
    const content = text.trim()
    if (!content) return
    if (content.length > MAX_TEXT_LENGTH) throw new ChatError('message_too_long')
    this.consumeRate()
    this.append({ type: 'text', nickname: me.nickname, senderId: me.senderId, content })
    this.maybeBotReply()
  }

  async sendImageFile(file: File): Promise<void> {
    await delay(200)
    const me = this.assertCanSend()
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new ChatError('image_type_unsupported')
    if (file.size > MAX_IMAGE_BYTES) throw new ChatError('image_too_large')
    this.consumeRate()

    // 真實版是上傳到圖片儲存空間再取得網址；模擬版直接存成資料網址
    let blob: Blob = file
    if (file.type === 'image/gif') {
      if (file.size > MOCK_GIF_BYTES) throw new ChatError('image_too_large')
    } else {
      blob = await compressImage(file, MOCK_IMAGE_BYTES, 1280)
    }
    const content = await blobToDataUrl(blob)
    this.append({ type: 'image', nickname: me.nickname, senderId: me.senderId, content })
  }

  async sendImageUrl(url: string): Promise<void> {
    await delay(120)
    const me = this.assertCanSend()
    let valid = false
    try {
      valid = url.length <= 2048 && new URL(url).protocol === 'https:'
    } catch {
      valid = false
    }
    if (!valid) throw new ChatError('image_url_invalid')
    this.consumeRate()
    this.append({ type: 'image', nickname: me.nickname, senderId: me.senderId, content: url })
  }

  async report(targetSenderId: string): Promise<void> {
    await delay(200)
    if (!this.me || targetSenderId === this.me.senderId) return
    // 模擬版沒有「不同的人」可以湊，所以門檻設為 REPORT_THRESHOLD
    if (REPORT_THRESHOLD < 1) return
    if (targetSenderId.startsWith('bot:')) {
      const name = targetSenderId.slice(4)
      writeJSON(KEY.bots, this.readBots().filter((n) => n !== name))
      this.ban(`n:${name.toLowerCase()}`)
      this.append({ type: 'system', nickname: null, senderId: null, content: `${name} 被踢出了聊天室` })
      return
    }
    const presence = this.readPresence()
    const target = presence[targetSenderId]
    if (!target) return
    delete presence[targetSenderId]
    writeJSON(KEY.presence, presence)
    const until = this.ban(`s:${targetSenderId}`)
    this.ban(`n:${target.nickname.toLowerCase()}`)
    this.channel?.postMessage({ type: 'kick', senderId: targetSenderId, until })
    this.append({ type: 'system', nickname: null, senderId: null, content: `${target.nickname} 被踢出了聊天室` })
  }

  async loadOlder(oldestId: number): Promise<LoadOlderResult> {
    await delay(450)
    if (!this.connected) throw new ChatError('network')
    const older = readMessages().filter((m) => m.id < oldestId)
    const messages = older.slice(-PAGE_SIZE)
    return { messages, hasMore: older.length > messages.length }
  }

  // ---------- 規則檢查 ----------

  private assertCanSend(): Member {
    const me = this.me
    if (!me) throw new ChatError('network')
    if (!this.connected) throw new ChatError('network')
    const until = this.banUntil(me.nickname)
    if (until) throw new ChatError('banned', until)
    if (Date.now() - this.lastSentAt < MIN_SEND_GAP) throw new ChatError('rate_limited')
    return me
  }

  private consumeRate() {
    this.lastSentAt = Date.now()
  }

  private banUntil(nickname: string): number | null {
    const bans = readJSON<BanMap>(KEY.bans, {})
    const now = Date.now()
    const until = Math.max(bans[`s:${this.senderId}`] ?? 0, bans[`n:${nickname.toLowerCase()}`] ?? 0)
    return until > now ? until : null
  }

  private ban(key: string): number {
    const now = Date.now()
    const bans = readJSON<BanMap>(KEY.bans, {})
    for (const k of Object.keys(bans)) if (bans[k] <= now) delete bans[k]
    bans[key] = now + BAN_MS
    writeJSON(KEY.bans, bans)
    return bans[key]
  }

  private isNicknameTaken(nickname: string): boolean {
    const lower = nickname.toLowerCase()
    const now = Date.now()
    const presence = this.readPresence()
    const takenByPeople = Object.entries(presence).some(
      ([id, p]) => id !== this.senderId && now - p.seen < STALE_MS && p.nickname.toLowerCase() === lower,
    )
    return takenByPeople || this.readBots().some((n) => n.toLowerCase() === lower)
  }

  // ---------- 訊息 ----------

  private append(m: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    const list = readMessages()
    const msg: ChatMessage = { ...m, id: list[list.length - 1].id + 1, createdAt: new Date().toISOString() }
    list.push(msg)
    while (list.length > MAX_STORED) list.shift()
    if (!writeJSON(KEY.messages, list)) {
      // 儲存空間滿了：丟掉最舊的一批再試一次
      const trimmed = list.slice(-Math.floor(MAX_STORED / 2))
      if (!writeJSON(KEY.messages, trimmed)) throw new ChatError('image_too_large')
    }
    this.sync()
    return msg
  }

  /** 把儲存空間裡「我還沒看過」的訊息與名單變動通知畫面。 */
  private sync() {
    if (!this.me) return
    this.syncPresence()
    if (!this.connected) return
    for (const m of readMessages()) {
      if (m.id > this.lastEmittedId) {
        this.lastEmittedId = m.id
        this.emit('message:new', m)
      }
    }
  }

  // ---------- 在線名單 ----------

  private readPresence(): PresenceMap {
    return readJSON<PresenceMap>(KEY.presence, {})
  }

  private readBots(): string[] {
    const bots = readJSON<string[] | null>(KEY.bots, null)
    if (bots) return bots
    const initial = BOT_NAMES.slice(0, 3)
    writeJSON(KEY.bots, initial)
    return initial
  }

  private members(): Member[] {
    const now = Date.now()
    const people = Object.entries(this.readPresence())
      .filter(([id, p]) => id === this.senderId || now - p.seen < STALE_MS)
      .map(([senderId, p]) => ({ nickname: p.nickname, senderId }))
    const bots = this.readBots().map((nickname) => ({ nickname, senderId: `bot:${nickname}` }))
    return [...bots, ...people]
  }

  private syncPresence() {
    if (!this.connected) return
    const members = this.members()
    const json = JSON.stringify(members)
    if (json === this.lastMembersJson) return
    this.lastMembersJson = json
    this.emit('presence:sync', members)
  }

  /** 超過一段時間沒心跳的人視為已離開（模擬「直接關掉分頁」）。 */
  private pruneStale() {
    const now = Date.now()
    const presence = this.readPresence()
    let changed = false
    for (const [id, p] of Object.entries(presence)) {
      if (now - p.seen >= STALE_MS && id !== this.senderId) {
        delete presence[id]
        changed = true
        this.append({ type: 'system', nickname: null, senderId: null, content: `${p.nickname} 離開了聊天室` })
      }
    }
    if (changed) writeJSON(KEY.presence, presence)
  }

  // ---------- 定時器：心跳與假使用者 ----------

  private startTicking() {
    this.stopTicking()
    this.tickTimer = window.setInterval(() => this.tick(), TICK_MS)
  }

  private stopTicking() {
    if (this.tickTimer !== null) clearInterval(this.tickTimer)
    this.tickTimer = null
    const lease = readJSON<{ id: string } | null>(KEY.leader, null)
    if (lease?.id === this.tabId) removeKey(KEY.leader)
  }

  private tick() {
    if (!this.me) return
    // 心跳
    const presence = this.readPresence()
    presence[this.senderId] = { nickname: this.me.nickname, seen: Date.now() }
    writeJSON(KEY.presence, presence)

    // 同一時間只讓一個分頁負責操作假使用者，避免重複
    if (this.claimLeader()) {
      this.pruneStale()
      this.botAct()
    }
    this.sync()
  }

  private claimLeader(): boolean {
    const now = Date.now()
    const lease = readJSON<{ id: string; ts: number } | null>(KEY.leader, null)
    if (!lease || lease.id === this.tabId || now - lease.ts > TICK_MS * 3) {
      writeJSON(KEY.leader, { id: this.tabId, ts: now })
      return true
    }
    return false
  }

  private botAct() {
    const r = Math.random()
    const online = this.readBots()
    if (r < 0.22) {
      this.botSpeak()
    } else if (r < 0.25) {
      const people = Object.values(this.readPresence()).map((p) => p.nickname.toLowerCase())
      const now = Date.now()
      const bans = readJSON<BanMap>(KEY.bans, {})
      const candidates = BOT_NAMES.filter(
        (n) => !online.includes(n) && !people.includes(n.toLowerCase()) && (bans[`n:${n.toLowerCase()}`] ?? 0) <= now,
      )
      if (candidates.length === 0) return
      const name = pick(candidates)
      writeJSON(KEY.bots, [...online, name])
      this.append({ type: 'system', nickname: null, senderId: null, content: `${name} 進入了聊天室` })
    } else if (r < 0.275 && online.length > 2) {
      const name = pick(online)
      writeJSON(KEY.bots, online.filter((n) => n !== name))
      this.append({ type: 'system', nickname: null, senderId: null, content: `${name} 離開了聊天室` })
    }
  }

  private botSpeak(lines = BOT_LINES) {
    const online = this.readBots()
    if (online.length === 0) return
    const name = pick(online)
    this.append({ type: 'text', nickname: name, senderId: `bot:${name}`, content: pick(lines) })
  }

  private maybeBotReply() {
    if (Math.random() > 0.4) return
    window.setTimeout(() => {
      if (this.me) this.botSpeak(BOT_REPLIES)
    }, 1500 + Math.random() * 2000)
  }

  // ---------- 測試開關 ----------

  private simulateDisconnect() {
    if (!this.me || !this.connected) return
    this.connected = false
    this.emit('connection:lost', undefined)
    window.setTimeout(() => this.restore(), 8000)
  }

  private restore() {
    if (!this.me || this.connected) return
    this.connected = true
    const missed = readMessages().filter((m) => m.id > this.lastEmittedId)
    if (missed.length) this.lastEmittedId = missed[missed.length - 1].id
    this.lastMembersJson = ''
    this.emit('connection:restored', missed)
    this.syncPresence()
  }

  private kickSelf(ms: number) {
    const me = this.me
    if (!me) return
    const now = Date.now()
    const until = now + ms
    const bans = readJSON<BanMap>(KEY.bans, {})
    bans[`s:${me.senderId}`] = until
    bans[`n:${me.nickname.toLowerCase()}`] = until
    writeJSON(KEY.bans, bans)
    const presence = this.readPresence()
    delete presence[me.senderId]
    writeJSON(KEY.presence, presence)
    this.append({ type: 'system', nickname: null, senderId: null, content: `${me.nickname} 被踢出了聊天室` })
    this.handleKicked(until)
  }

  private handleKicked(until: number) {
    this.stopTicking()
    this.me = null
    this.emit('session:kicked', { until })
  }
}
