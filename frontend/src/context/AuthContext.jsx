import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const VISIBILITY_THROTTLE_MS = 60 * 1000 // 60 seconds

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastFetchRef = useRef(0)
  const inFlightRef = useRef(null)
  const navigate = useNavigate()

  // Core fetcher. Dedupes concurrent calls; does not block on `loading` except
  // for the very first mount call (which sets loading=false in finally).
  const refreshUser = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current
    const promise = (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUser(data)
          return data
        }
        setUser(null)
        return null
      } catch {
        setUser(null)
        return null
      } finally {
        lastFetchRef.current = Date.now()
        inFlightRef.current = null
      }
    })()
    inFlightRef.current = promise
    return promise
  }, [])

  // Initial mount fetch + OAuth-return query-param handling.
  useEffect(() => {
    let cancelled = false

    // Read ?linkedin_connected / ?linkedin_disconnected BEFORE the first fetch
    // so we can react to the connect result in the same tick. AuthProvider sits
    // OUTSIDE ToastProvider in the tree, so we can't call useToast() here.
    // Instead, stash a one-shot flag in sessionStorage; Dashboard (which is
    // inside ToastProvider) consumes it on mount and fires the toast.
    try {
      const params = new URLSearchParams(window.location.search)
      const hasConnected = params.has('linkedin_connected')
      const hasDisconnected = params.has('linkedin_disconnected')
      if (hasConnected || hasDisconnected) {
        if (hasConnected) {
          try {
            window.sessionStorage.setItem('lp.oauth_connected', '1')
          } catch {}
        }
        // Strip the params from the URL so a refresh doesn't re-trigger.
        params.delete('linkedin_connected')
        params.delete('linkedin_disconnected')
        const qs = params.toString()
        const newUrl =
          window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
        window.history.replaceState({}, '', newUrl)
      }
    } catch {
      // non-browser / SSR guards — ignore.
    }

    ;(async () => {
      await refreshUser()
      if (cancelled) return
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshUser])

  // Visibility + interval background refresh. Both paths consult
  // lastFetchRef to avoid double-firing when the interval tick lines up
  // with a visibility-change (e.g. user flips back to the tab right as the
  // 5-min timer fires — only the first one through updates lastFetchRef,
  // the second sees it as recent and skips).
  useEffect(() => {
    function refreshIfStale(minAgeMs) {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - lastFetchRef.current
      if (age < minAgeMs) return
      refreshUser()
    }

    function onVisibilityChange() {
      // Refresh on return-to-tab if we haven't fetched in >60s.
      refreshIfStale(VISIBILITY_THROTTLE_MS)
    }

    const intervalId = setInterval(() => {
      // Interval only runs when tab is visible; gate inside.
      // Use (REFRESH_INTERVAL_MS - 1s) as min-age so a visibility refresh
      // that just fired still counts as "fresh enough" and we skip.
      refreshIfStale(REFRESH_INTERVAL_MS - 1000)
    }, REFRESH_INTERVAL_MS)

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(intervalId)
    }
  }, [refreshUser])

  async function login() {
    try {
      const res = await fetch('/api/auth/login', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url
        return null
      }
      return data.detail || 'Login failed. Check backend logs.'
    } catch (err) {
      console.error('Login failed:', err)
      return 'Login failed. Check your connection and backend.'
    }
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setUser(null)
    window.location.href = '/login?signedout=1'
  }

  // Post-delete cleanup: the server has already destroyed the session/account.
  // Clear local user state and SPA-navigate to /login?deleted=1 so the Login
  // page can render the "Your account has been deleted." banner.
  function deleteAccount() {
    setUser(null)
    navigate('/login?deleted=1', { replace: true })
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, deleteAccount, refreshUser, fetchUser: refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
