// 瀏覽器儲存空間可能被封鎖（無痕模式等），所有讀寫都要容錯。

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const NICKNAME_KEY = 'anon-chat:nickname'

export function getRememberedNickname(): string | null {
  try {
    return localStorage.getItem(NICKNAME_KEY)
  } catch {
    return null
  }
}

export function rememberNickname(nickname: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname)
  } catch {
    /* ignore */
  }
}

export function forgetNickname(): void {
  removeKey(NICKNAME_KEY)
}
