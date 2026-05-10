import { useState, useEffect, useCallback, useRef } from 'react'
import { notificationsService } from '../lib/storage'
import { useAuth } from './useAuth'

const POLL_INTERVAL = 30_000 // 30 segundos

/**
 * Hook de notificações com polling.
 * Retorna { notifications, unread, markRead, markAllRead, refresh }
 */
export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread]               = useState(0)
  const timerRef = useRef(null)

  const fetch = useCallback(async () => {
    if (!user?.id) return
    const { data } = await notificationsService.list(user.id)
    const list = data ?? []
    setNotifications(list)
    setUnread(list.filter(n => !n.read).length)
  }, [user?.id])

  useEffect(() => {
    fetch()
    timerRef.current = setInterval(fetch, POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [fetch])

  const markRead = useCallback(async (id) => {
    await notificationsService.markRead(id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    setUnread(prev => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    await notificationsService.markAllRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }, [user?.id])

  return { notifications, unread, markRead, markAllRead, refresh: fetch }
}
