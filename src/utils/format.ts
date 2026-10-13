const timeFormat = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
const fullFormat = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short', hour12: false })

export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
export const formatFull = (iso: string) => fullFormat.format(new Date(iso))

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function minutesUntil(until: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((until - now) / 60000))
}
