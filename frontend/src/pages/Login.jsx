import { useState, useEffect, useRef } from 'react'
import { Navigate, NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, CheckCircle2, UserCog, Loader2 } from 'lucide-react'
import AppLogo from '../components/AppLogo'
import { BrandMark } from '../components/AppLogo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Login() {
  const { user, loading, login } = useAuth()
  const [searchParams] = useSearchParams()
  const justSignedOut = searchParams.get('signedout') === '1'
  const [switching, setSwitching] = useState(false)
  const popupRef = useRef(null)
  const timerRef = useRef(null)

  function cleanupSwitch() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    popupRef.current = null
    setSwitching(false)
  }

  useEffect(() => () => cleanupSwitch(), [])

  function startSwitchAccount() {
    const popup = window.open(
      'https://www.linkedin.com/m/logout',
      'lpSwitch',
      'width=560,height=680,menubar=no,toolbar=no,location=no,status=no'
    )
    if (!popup) {
      alert("Your browser blocked the sign-out popup. Please allow popups for this site and try again.")
      return
    }
    popupRef.current = popup
    setSwitching(true)
    timerRef.current = setTimeout(() => {
      try { popup.close() } catch {}
      cleanupSwitch()
      login()
    }, 2500)
  }

  function cancelSwitch() {
    try { popupRef.current?.close() } catch {}
    cleanupSwitch()
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#0a0a0a] grid-bg">
        <Skeleton className="h-8 w-8 rounded-full bg-purple/30" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a0a] text-white grid-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] radial-glow" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-6 pt-6">
        <AppLogo variant="navMinimal" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]">
            <div className="mb-6 flex justify-center">
              <div className="h-8 w-8 overflow-hidden rounded-lg">
                <BrandMark className="h-full w-full" />
              </div>
            </div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in to LinkedPush</h1>
              <p className="mt-2 text-sm text-white/55">Continue with your LinkedIn account.</p>
            </div>

            {justSignedOut && (
              <div className="mb-5 flex items-start gap-2 border-l-2 border-emerald-400/60 bg-emerald-400/[0.04] py-1.5 pl-3 text-xs text-emerald-200/90">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400/80" />
                <span>You've been signed out. Click below to sign back in.</span>
              </div>
            )}

            <Button
              onClick={login}
              disabled={switching}
              className="group h-10 w-full gap-2.5 rounded-md bg-purple text-sm font-medium text-white hover:bg-purple-dark disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Sign in with LinkedIn
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={switching ? cancelSwitch : startSwitchAccount}
              className="mt-2 h-9 w-full gap-2 rounded-md text-xs font-medium text-white/55 hover:bg-white/[0.04] hover:text-white/80"
            >
              {switching ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Waiting for LinkedIn sign-out… (click to cancel)
                </>
              ) : (
                <>
                  <UserCog size={13} />
                  Use a different LinkedIn account
                </>
              )}
            </Button>

            <p className="mt-5 text-center text-[11px] text-white/40">
              OAuth2 · we never see your password
            </p>
          </div>

          <div className="mt-6 text-center">
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
    </div>
  )
}
