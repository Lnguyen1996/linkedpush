import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { useNotificationSignalR } from '../hooks/useNotificationSignalR'
import { useNotifications } from '../hooks/useNotifications'
import { normalizeNotification } from '../lib/notifications'

const NotificationContext = createContext(null)

const DISMISS_STORAGE_KEY = 'linkedpush_dismissed_notifications'

function readDismissedSet() {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function writeDismissedSet(set) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...set]))
  } catch {}
}

export function NotificationProvider({ children }) {
  const [liveItems, setLiveItems] = useState([])
  const [dismissed, setDismissed] = useState(readDismissedSet)
  const { items: storedItems, loading, error, refetch, markRead, markAllRead } = useNotifications(true)

  const handleNotification = useCallback((notification) => {
    setLiveItems(prev => [normalizeNotification(notification), ...prev])
  }, [])

  const handleConnected = useCallback(() => {
    console.log('SignalR connected')
  }, [])

  const handleDisconnected = useCallback(() => {
    console.log('SignalR disconnected')
  }, [])

  const connectionRef = useNotificationSignalR({
    onNotification: handleNotification,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
  })

  const allItems = [...liveItems, ...storedItems.map(normalizeNotification)]
  const deduped = allItems.reduce((acc, item) => {
    if (!acc.find(i => i.id === item.id)) acc.push(item)
    return acc
  }, [])

  const visibleItems = useMemo(
    () => deduped.filter(i => !i.read_at && !dismissed.has(i.id)),
    [deduped, dismissed]
  )

  const visibleCount = visibleItems.length

  const dismiss = useCallback((id) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      writeDismissedSet(next)
      return next
    })
  }, [])

  return (
    <NotificationContext.Provider value={{
      items: deduped,
      visibleItems,
      visibleCount,
      unreadCount: deduped.filter(i => !i.read_at).length,
      loading,
      error,
      refetch,
      dismiss,
      markRead,
      markAllRead,
      connectionRef,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
