import { ChatError } from '../chat-service/types'
import { minutesUntil } from './format'

export function errorMessage(err: unknown): string {
  if (!(err instanceof ChatError)) return '發生未知的錯誤，請再試一次'
  switch (err.code) {
    case 'nickname_invalid':
      return '代號需為 1–12 個中文、英文或數字'
    case 'nickname_taken':
      return '這個代號已被使用'
    case 'banned':
      return err.until
        ? `你已被踢出聊天室，約 ${minutesUntil(err.until)} 分鐘後可再進入`
        : '你已被踢出聊天室'
    case 'rate_limited':
      return '請稍後再送'
    case 'message_too_long':
      return '訊息太長'
    case 'image_too_large':
      return '圖片太大，無法送出'
    case 'image_type_unsupported':
      return '不支援這種圖片'
    case 'image_url_invalid':
      return '圖片網址無效'
    case 'network':
      return '連線中斷，重新連線中…'
  }
}
