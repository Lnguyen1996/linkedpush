import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login() {
    try {
      const res = await fetch('/api/auth/login', { credentials: 'include' })
      const data = await res.json()
      if (data.redirect_url) {
        window.location.href = data.redirect_url
      }
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore
    }
    setUser(null)
    // LinkedIn's li_at cookie is SameSite=Lax, so an iframe to /m/logout
    // won't send it. A popup is a top-level context; cookies flow. Open tiny,
    // auto-close before the user notices.
    const popup = window.open(
      'https://www.linkedin.com/m/logout',
      'lpLogout',
      'width=400,height=300,left=99999,top=99999'
    )
    setTimeout(() => {
      try { popup?.close() } catch {}
      window.location.href = '/login?signedout=1'
    }, 1500)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
