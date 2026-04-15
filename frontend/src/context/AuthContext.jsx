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
    const popup = window.open(
      'https://www.linkedin.com/m/logout',
      'lpLogout',
      'width=280,height=220,menubar=no,toolbar=no,location=no,status=no'
    )

    const overlay = document.createElement('div')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-label', 'Signing out')
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-direction:column', 'gap:16px',
      'background:#0a0a0a', 'color:#fff',
      'font:500 14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    ].join(';')
    overlay.innerHTML = `
      <style>
        @keyframes lpSpin { to { transform: rotate(360deg) } }
        .lp-spin { width:20px; height:20px; border:2px solid rgba(255,255,255,.2);
                   border-top-color:#7C3AED; border-radius:50%;
                   animation:lpSpin .8s linear infinite; }
      </style>
      <div class="lp-spin"></div>
      <div>Signing out of LinkedIn…</div>
      <div style="font-size:12px; color:rgba(255,255,255,.5); text-align:center; max-width:320px">
        A small LinkedIn window may flash — this clears your session so you aren't auto-signed back in.
      </div>
    `
    document.body.appendChild(overlay)

    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setUser(null)

    setTimeout(() => {
      try { popup?.close() } catch {}
      try { overlay.remove() } catch {}
      window.location.href = '/login?signedout=1'
    }, 2500)
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
