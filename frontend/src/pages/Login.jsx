import { useState } from 'react'
import { Navigate, NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import AppLogo from '../components/AppLogo'
import { BrandMark } from '../components/AppLogo'
import { Button } from '@/components/ui/button'

const PIPELINE_STEPS = ['Draft', 'Schedule', 'Publish', 'Review']
const CALLBACK_ERROR_COPY = {
  access_denied: 'Google sign-in was canceled. Click "Continue with Google" to try again.',
  temporarily_unavailable: 'Google sign-in is temporarily unavailable. Please try again shortly.',
  missing_code_or_state: 'The Google sign-in response was incomplete. Please start sign-in again.',
  callback_exchange_failed: 'We could not verify your Google sign-in. Please try again.',
}

function sanitizeQueryText(value, maxLen = 220) {
  if (!value) return ''
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const [searchParams] = useSearchParams()
  const justSignedOut = searchParams.get('signedout') === '1'
  const justDeleted = searchParams.get('deleted') === '1'
  const callbackError = sanitizeQueryText(searchParams.get('cb_error'), 64)
  const callbackMessageFromQuery = sanitizeQueryText(searchParams.get('cb_message'))
  const callbackDetails = sanitizeQueryText(searchParams.get('cb_details'))
  const callbackMessage =
    CALLBACK_ERROR_COPY[callbackError] ||
    callbackMessageFromQuery ||
    (callbackError ? 'Google sign-in did not complete. Please try again.' : '')
  const [loginError, setLoginError] = useState(null)

  async function handleLogin() {
    setLoginError(null)
    const err = await login()
    if (err) setLoginError(err)
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#0a0a0a] grid-bg">
        <Loader2 className="h-6 w-6 animate-spin text-purple" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden lp-shell text-white">
      <div className="relative z-10 flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
          <AppLogo variant="navMinimal" />
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 sm:inline-flex">
            <ShieldCheck size={11} className="text-emerald-400/80" />
            Official Google OAuth
          </span>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
              <div className="mb-6 flex justify-center">
                <div className="h-12 w-12 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <BrandMark className="h-full w-full" />
                </div>
              </div>

              <div className="mb-7 text-center">
                <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white">
                  Sign in to LinkedPush
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  Sign in with Google. You&apos;ll connect LinkedIn in Settings to publish.
                </p>
              </div>

              {justDeleted && !loginError && (
                <div className="mb-5 flex items-start gap-2 border-l-2 border-emerald-400/60 bg-emerald-400/4 py-1.5 pl-3 text-xs text-emerald-200/90">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400/80" />
                  <span>Your account has been deleted.</span>
                </div>
              )}

              {justSignedOut && !justDeleted && !loginError && (
                <div className="mb-5 flex items-start gap-2 border-l-2 border-emerald-400/60 bg-emerald-400/4 py-1.5 pl-3 text-xs text-emerald-200/90">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400/80" />
                  <span>You've been signed out. Click below to sign back in.</span>
                </div>
              )}

              {callbackMessage && (
                <div className="mb-5 flex items-start gap-2 border-l-2 border-amber-400/60 bg-amber-400/5 py-1.5 pl-3 text-xs text-amber-100/90">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-300/90" />
                  <div className="space-y-1">
                    <p>{callbackMessage}</p>
                    {callbackDetails && <p className="text-amber-100/70">{callbackDetails}</p>}
                  </div>
                </div>
              )}

              {loginError && (
                <div className="mb-5 flex items-start gap-2 border-l-2 border-rose-400/60 bg-rose-400/4 py-1.5 pl-3 text-xs text-rose-200/90">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-rose-400/80" />
                  <span>{loginError}</span>
                </div>
              )}

              <Button
                onClick={handleLogin}
                variant="purple"
                className="group relative h-12 w-full overflow-hidden rounded-xl text-[14px] font-semibold tracking-[-0.005em] bg-gradient-to-b from-purple to-purple-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_0_rgba(0,0,0,0.25),0_10px_28px_-12px_rgba(124,58,237,0.6)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_0_rgba(0,0,0,0.25),0_18px_44px_-14px_rgba(124,58,237,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple/60"
              >
                {/* top sheen highlight */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                {/* centered content: white-chip Google G + label */}
                <span className="relative flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_-1px_0_rgba(0,0,0,0.06)] transition-transform duration-200 group-hover:scale-[1.04]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.3 1.6-1.9 4.7-5.5 4.7-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4.2 14.6 3.3 12 3.3 7.2 3.3 3.3 7.2 3.3 12S7.2 20.7 12 20.7c6.9 0 8.6-4.8 8.6-7.3 0-.5-.1-.9-.1-1.3H12z" />
                      <path fill="#34A853" d="M3.3 7.4l3.2 2.3c.9-1.9 2.9-3.2 5.5-3.2 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4.2 14.6 3.3 12 3.3 8.1 3.3 4.8 5.6 3.3 8.9v-1.5z" />
                      <path fill="#4A90E2" d="M12 20.7c2.5 0 4.7-.8 6.2-2.3l-2.9-2.3c-.8.6-1.9 1.1-3.3 1.1-3.5 0-5.2-3-5.5-4.6l-3.2 2.4c1.5 3.4 4.9 5.7 8.7 5.7z" />
                      <path fill="#FBBC05" d="M6.5 12c0-.8.1-1.5.4-2.2L3.7 7.4C3.1 8.8 2.8 10.3 2.8 12c0 1.7.3 3.2.9 4.6l3.2-2.4c-.3-.7-.4-1.4-.4-2.2z" />
                    </svg>
                  </span>
                  <span>Continue with Google</span>
                </span>

                {/* hover-revealed chevron on the right */}
                <ArrowRight
                  size={16}
                  strokeWidth={2.4}
                  aria-hidden
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/85 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                />
              </Button>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
                <ShieldCheck size={11} className="text-emerald-400/70" />
                We never post without your approval.
              </p>
            </div>

            <div
              aria-hidden
              className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35"
            >
              {PIPELINE_STEPS.map((step, i) => (
                <span key={step} className="flex items-center gap-3">
                  <span>{step}</span>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <span className="h-px w-4 bg-white/10" />
                  )}
                </span>
              ))}
            </div>

            <div className="mt-5 text-center">
              <NavLink
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
              >
                <ArrowLeft size={12} />
                Back to home
              </NavLink>
            </div>
          </div>
        </main>

        <footer className="mx-auto w-full max-w-6xl px-6 pb-6 text-center text-[10px] uppercase tracking-[0.22em] text-white/25">
          LinkedPush - Secure sign-in
        </footer>
      </div>
    </div>
  )
}
