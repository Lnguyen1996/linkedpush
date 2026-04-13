import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowRight } from 'lucide-react'
import AppLogo from '../components/AppLogo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const features = [
  { title: 'Smart Scheduling', desc: 'Timezone-aware scheduling' },
  { title: 'Analytics', desc: 'Impressions and engagement' },
  { title: 'Auto-Publish', desc: 'Posts go live on time' },
  { title: 'AI Writing', desc: 'Claude-powered captions' },
]

export default function Login() {
  const { user, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-discord-bg bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/brand/login-bg.png')" }}
        />
        <div className="absolute inset-0 bg-discord-bg/75" />
        <Skeleton className="relative h-8 w-8 rounded-full bg-purple/30" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-8 md:px-12">
      <div
        className="absolute inset-0 bg-discord-bg bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/brand/login-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-discord-bg/80 via-discord-bg/85 to-discord-bg/90" />
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-24 top-24 h-56 w-56 rounded-full bg-purple/30 blur-3xl" />
        <div className="absolute -right-20 bottom-24 h-72 w-72 rounded-full bg-purple/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl animate-fade-in-up sm:max-w-2xl lg:max-w-4xl">
        <Card className="border-white/[0.08] bg-discord-bg-elevated shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] ring-0">
          <CardContent className="px-6 pt-6 pb-6 sm:px-7 lg:px-8">
            <AppLogo variant="loginDark" className="mb-5" />

            <div className="mb-5 text-center">
              <h2 className="mb-1.5 text-xl font-semibold text-discord-text-primary sm:text-2xl">Welcome back</h2>
              <p className="text-sm text-discord-text-secondary">
                Sign in to manage your LinkedIn content
              </p>
            </div>

            <Button
              onClick={login}
              className="group h-auto w-full gap-3 rounded-2xl bg-purple px-6 py-3.5 font-medium text-white shadow-none transition-all duration-200 hover:bg-purple-dark hover:shadow-lg hover:shadow-purple/25 active:scale-[0.98]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Sign in with LinkedIn
              <ArrowRight
                size={16}
                className="-translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              />
            </Button>

            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1 bg-white/10" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-text-secondary">
                Secure login
              </span>
              <Separator className="flex-1 bg-white/10" />
            </div>

            <ul className="space-y-2.5">
              {[
                'OAuth2 authentication — we never see your password',
                'Self-hosted — your data stays on your server',
                'Open source — inspect every line of code',
              ].map(text => (
                <li key={text} className="flex gap-3 text-sm text-discord-text-secondary">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-discord-success/15">
                    <svg className="h-3 w-3 text-discord-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-discord-text-secondary/90">
                What you get
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                {features.map(({ title, desc }) => (
                  <Badge
                    key={title}
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-0 rounded-lg border-white/[0.06] bg-white/[0.02] px-3 py-2.5 shadow-[inset_3px_0_0_0_rgba(88,101,242,0.55)] transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="text-xs font-medium text-discord-text-primary">{title}</span>
                    <span className="mt-0.5 text-[11px] font-normal leading-snug text-discord-text-secondary">{desc}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-discord-text-secondary/80">
          Self-hosted. Open source. Your data stays yours.
        </p>
      </div>
    </div>
  )
}
