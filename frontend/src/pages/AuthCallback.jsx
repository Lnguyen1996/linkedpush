import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

const CALLBACK_ERROR_MESSAGES = {
  access_denied: 'Google sign-in was canceled. Please try again.',
  temporarily_unavailable: 'Google sign-in is temporarily unavailable. Please try again shortly.',
}

function sanitizeText(value, maxLen = 220) {
  if (!value) return ''
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { fetchUser } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')
    const oauthErrorDescription = searchParams.get('error_description')

    if (oauthError) {
      const params = new URLSearchParams({
        cb_error: oauthError,
        cb_message:
          CALLBACK_ERROR_MESSAGES[oauthError] || 'Google sign-in did not complete. Please try again.',
      })
      const details = sanitizeText(oauthErrorDescription)
      if (details) params.set('cb_details', details)
      navigate(`/login?${params.toString()}`, { replace: true })
      return
    }

    if (!code || !state) {
      const params = new URLSearchParams({
        cb_error: 'missing_code_or_state',
        cb_message: 'Sign-in response was incomplete. Please start Google sign-in again.',
      })
      navigate(`/login?${params.toString()}`, { replace: true })
      return
    }

    const callbackParams = new URLSearchParams({ code, state })
    fetch(`/api/auth/callback?${callbackParams.toString()}`, {
      credentials: 'include',
      redirect: 'follow',
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.detail || 'Unable to complete Google sign-in.')
        }
      })
      .then(() => fetchUser())
      .then(() => navigate('/app', { replace: true }))
      .catch((err) => {
        const params = new URLSearchParams({
          cb_error: 'callback_exchange_failed',
          cb_message: 'Could not complete Google sign-in. Please try again.',
        })
        const details = sanitizeText(err?.message)
        if (details) params.set('cb_details', details)
        navigate(`/login?${params.toString()}`, { replace: true })
      })
  }, [fetchUser, navigate, searchParams])

  return (
    <div className="relative flex min-h-screen items-center justify-center lp-shell">
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple" />
        <p className="text-sm font-medium text-white/70 animate-fade-in-up">
          Signing you in…
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Completing Google handshake
        </span>
      </div>
    </div>
  )
}
