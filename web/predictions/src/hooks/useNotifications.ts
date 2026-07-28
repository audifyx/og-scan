'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
  betId: string | null
}

export function useNotifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetch = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setNotifications(data.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.created_at,
        betId: n.bet_id,
      })))
      setUnreadCount(data.filter(n => !n.read).length)
    }
  }, [profile])

  useEffect(() => { fetch() }, [fetch])

  // Realtime subscription
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetch])

  const markAllRead = useCallback(async () => {
    if (!profile) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)
    fetch()
  }, [profile, fetch])

  return { notifications, unreadCount, markAllRead, refresh: fetch }
}
