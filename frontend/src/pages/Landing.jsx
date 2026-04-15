import { Navigate, NavLink } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  BarChart3,
  Zap,
  Sparkles,
  PenSquare,
  Server,
} from 'lucide-react'

function GithubIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.73.5.73 5.5.73 11.77c0 4.98 3.23 9.2 7.7 10.7.57.1.78-.24.78-.54v-1.88c-3.13.68-3.8-1.51-3.8-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.64 1.22 3.28.93.1-.73.4-1.22.72-1.5-2.5-.28-5.13-1.25-5.13-5.58 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.34-2.64 5.3-5.15 5.57.4.35.76 1.04.76 2.1v3.11c0 .3.2.65.79.54 4.47-1.5 7.69-5.72 7.69-10.7C23.27 5.5 18.27.5 12 .5z" />
    </svg>
  )
}
import AppLogo from '@/components/AppLogo'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const features = [
  { title: 'Smart scheduling', desc: 'Timezone-aware queues so posts land when your audience is awake.', icon: CalendarClock },
  { title: 'Auto-publish', desc: 'Background worker polls every 60 seconds and ships on time.', icon: Zap },
  { title: 'AI writing', desc: 'Claude drafts captions from a prompt, hook, or raw idea.', icon: Sparkles },
  { title: 'Analytics', desc: 'Impressions and engagement synced straight from LinkedIn.', icon: BarChart3 },
  { title: 'Rich editor', desc: 'TipTap + image uploads, character counts, and link previews.', icon: PenSquare },
  { title: 'Self-hosted', desc: 'One Docker compose command. Your data stays on your box.', icon: Server },
]

const steps = [
  { title: 'Write the post', body: 'Use the TipTap editor or have Claude generate a first draft.' },
  { title: 'Pick a time', body: 'Schedule in your timezone. LinkedPush handles the rest.' },
  { title: 'Track what works', body: 'Analytics sync back from LinkedIn so you can iterate.' },
]

export default function Landing() {
  const { user, loading } = useAuth()

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
    <div className="relative min-h-screen bg-[#0a0a0a] text-white grid-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] radial-glow" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/70 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <AppLogo variant="navMinimal" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="GitHub"
            >
              <GithubIcon size={16} />
            </a>
            <Button
              asChild
              variant="ghost"
              className="h-8 rounded-md px-3 text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white"
            >
              <NavLink to="/login">Sign in</NavLink>
            </Button>
            <Button
              asChild
              className="h-8 rounded-md bg-white px-3 text-sm font-medium text-black hover:bg-white/90"
            >
              <NavLink to="/login">Get started</NavLink>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto w-full max-w-3xl px-6 pt-24 pb-16 text-center sm:pt-28 sm:pb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-purple" />
            Self-hosted · v1.0
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl">
            LinkedIn content,
            <br />
            scheduled.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/60 sm:text-lg">
            Write, schedule, and publish to LinkedIn without the SaaS tax. Self-hosted, one-person-team friendly, Claude-powered.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="group h-10 gap-2 rounded-md bg-purple px-5 text-sm font-medium text-white hover:bg-purple-dark"
            >
              <NavLink to="/login">
                Get started
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </NavLink>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 gap-2 rounded-md border-white/10 bg-white/[0.02] px-5 text-sm font-medium text-white hover:bg-white/[0.06] hover:text-white"
            >
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <GithubIcon size={14} />
                View on GitHub
              </a>
            </Button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-24">
          <DashboardMock />
        </section>

        <section className="border-t border-white/[0.06]">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 sm:p-10 lg:p-12">
              <div className="mb-12 max-w-2xl sm:mb-14">
                <h2 className="text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
                  Everything you need. Nothing you don't.
                </h2>
                <p className="mt-3 text-base text-white/55">
                  A focused toolkit for creators who want to ship consistently without renting a CRM.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
                {features.map(({ title, desc, icon: Icon }) => (
                  <div key={title}>
                    <Icon size={20} className="text-white/70" strokeWidth={1.75} />
                    <h3 className="mt-4 text-base font-medium text-white">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06]">
          <div className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-24">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
              <div className="mb-8 max-w-2xl sm:mb-10">
                <h2 className="text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
                  How it works
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                  Three focused steps to turn ideas into published LinkedIn posts without extra ceremony.
                </p>
              </div>

              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div
                    key={step.title}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-4 py-4 sm:px-5 sm:py-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-purple/15 text-xs font-semibold tabular-nums text-purple-light">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-white sm:text-lg">{step.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-white/60">{step.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06]">
          <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Ship your next post in minutes.
            </h2>
            <p className="mt-3 text-base text-white/55">
              Sign in with LinkedIn and start scheduling today.
            </p>
            <Button
              asChild
              className="group mt-8 h-10 gap-2 rounded-md bg-purple px-5 text-sm font-medium text-white hover:bg-purple-dark"
            >
              <NavLink to="/login">
                Get started
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </NavLink>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-6 py-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 LinkedPush</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70">GitHub</a>
            <a href="#" className="hover:text-white/70">Docs</a>
            <a href="#" className="hover:text-white/70">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DashboardMock() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const scheduled = new Set(['1-2', '2-4', '3-0', '0-5'])
  const published = new Set(['0-1', '1-5'])

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_40px_80px_-20px_rgba(124,58,237,0.25)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="ml-3 text-xs text-white/40">linkedpush · dashboard</span>
      </div>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">This week</p>
            <p className="text-xs text-white/40">April 14 – April 20</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60">Week</span>
            <span className="rounded-md bg-purple/20 px-2 py-1 text-[11px] text-purple-light">+ New post</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map(d => (
            <div key={d} className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              {d}
            </div>
          ))}
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 7 }).map((__, col) => {
              const key = `${row}-${col}`
              const isScheduled = scheduled.has(key)
              const isPublished = published.has(key)
              return (
                <div
                  key={key}
                  className={`h-14 rounded-md border ${
                    isScheduled
                      ? 'border-purple/40 bg-purple/15'
                      : isPublished
                      ? 'border-white/10 bg-white/[0.04]'
                      : 'border-white/[0.06] bg-transparent'
                  } p-1.5`}
                >
                  {isScheduled && (
                    <>
                      <div className="h-1 w-6 rounded-full bg-purple/60" />
                      <div className="mt-1.5 text-[9px] text-purple-light">9:00 AM</div>
                    </>
                  )}
                  {isPublished && (
                    <>
                      <div className="h-1 w-5 rounded-full bg-white/25" />
                      <div className="mt-1.5 text-[9px] text-white/40">Shipped</div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
