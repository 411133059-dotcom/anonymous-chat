import type { ChatService } from './types'
import { MockChatService } from './mock'

export * from './types'

// 階段二：把這裡換成 Supabase 版即可，其他檔案不需要改。
export function createChatService(): ChatService {
  return new MockChatService()
}
