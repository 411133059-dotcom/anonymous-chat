import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatService, JoinResult, Member } from '../chat-service'

export function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>()
  for (const m of a) byId.set(m.id, m)
  for (const m of b) byId.set(m.id, m)
  return [...byId.values()].sort((x, y) => x.id - y.id)
}

/** 聊天室畫面需要的所有即時狀態；只透過 ChatService 取得資料。 */
export function useChatRoom(service: ChatService, init: JoinResult, onKicked: (until: number) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>(init.messages)
  const [members, setMembers] = useState<Member[]>(init.members)
  const [reconnecting, setReconnecting] = useState(false)
  const [hasMore, setHasMore] = useState(init.hasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const loadingRef = useRef(false)
  const onKickedRef = useRef(onKicked)
  onKickedRef.current = onKicked

  useEffect(() => {
    const offs = [
      service.on('message:new', (m) => setMessages((prev) => mergeMessages(prev, [m]))),
      service.on('presence:sync', setMembers),
      service.on('connection:lost', () => setReconnecting(true)),
      service.on('connection:restored', (missed) => {
        setMessages((prev) => mergeMessages(prev, missed))
        setReconnecting(false)
      }),
      service.on('session:kicked', ({ until }) => onKickedRef.current(until)),
    ]
    return () => offs.forEach((off) => off())
  }, [service])

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0]?.id
    if (loadingRef.current || oldest === undefined) return
    loadingRef.current = true
    setLoadingOlder(true)
    setLoadFailed(false)
    try {
      const result = await service.loadOlder(oldest)
      setMessages((prev) => mergeMessages(result.messages, prev))
      setHasMore(result.hasMore)
    } catch {
      setLoadFailed(true)
    } finally {
      loadingRef.current = false
      setLoadingOlder(false)
    }
  }, [service])

  return { messages, members, reconnecting, hasMore, loadingOlder, loadFailed, loadOlder }
}
