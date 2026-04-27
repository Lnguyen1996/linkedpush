import { useState, useEffect, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'linkedpush_dismissed_notifications'
const POLL_MS = 60_000

function readDismissedSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function writeDismissedSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore quota
  }
}

/** Fetch notifications from the stored (persisted) endpoint. */
async function fetchStoredNotifications() {
  const res = await fetch('/api/notifications/stored', { credentials: 'include' })
  if (!res.ok) throw new Error('Could not load notifications')
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

/** Mark a single notification as read. */
export async function markRead(id) {
  try {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // best-effort
  }
}

/** Mark all notifications as read. */
export async function markAllRead() {
  try {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // best-effort
  }
}

/**
 * Notifications hook — polls the stored endpoint for notification history,
 * keeps local dismiss state, and exposes read/unread actions.
 * SignalR real-time pushes are layered on top of polling as a bonus.
 */
export function useNotifications(enabled) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(readDismissedSet)

  const refetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const stored = await fetchStoredNotifications()
      setItems(stored)
    } catch {
      setError('Could not load notifications')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refetch()
    const t = setInterval(refetch, POLL_MS)
    return () => clearInterval(t)
  }, [enabled, refetch])

  const unreadCount = useMemo(() => items.filter(i => !i.read_at).length, [items])

  const visibleItems = useMemo(
    () => items.filter(i => !i.read_at && !dismissed.has(i.id)),
    [items, dismissed]
  )

  const dismiss = useCallback(id => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      writeDismissedSet(next)
      return next
    })
  }, [])

  const dismissAllVisible = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev)
      items.forEach(i => {
        if (i.id) next.add(i.id)
      })
      writeDismissedSet(next)
      return next
    })
  }, [items])

  const markReadFn = useCallback(async id => {
    await markRead(id)
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i))
    )
  }, [])

  const markAllReadFn = useCallback(async () => {
    await markAllRead()
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => (i.id ? { ...i, read_at: now } : i)))
  }, [])

  return {
    items,
    visibleItems,
    visibleCount: visibleItems.length,
    unreadCount,
    loading,
    error,
    refetch,
    dismiss,
    dismissAllVisible,
    markRead: markReadFn,
    markAllRead: markAllReadFn,
  }
}
