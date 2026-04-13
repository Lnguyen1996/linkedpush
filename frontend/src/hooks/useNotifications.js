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

/** Notifications from GET /api/notifications plus client dismiss state. */
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
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) {
        setError('Could not load notifications')
        setItems([])
        return
      }
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
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

  const visibleItems = useMemo(
    () => items.filter(i => i.id && !dismissed.has(i.id)),
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

  return {
    items,
    visibleItems,
    visibleCount: visibleItems.length,
    loading,
    error,
    refetch,
    dismiss,
    dismissAllVisible,
  }
}
