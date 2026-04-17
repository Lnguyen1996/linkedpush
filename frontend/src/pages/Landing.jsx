import { Navigate, NavLink } from 'react-router-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  BarChart3,
  Zap,
  Sparkles,
  PenSquare,
  Server,
} from 'lucide-react'

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
          <NavLink to="/privacy" className="hover:text-white/70">Privacy</NavLink>
        </div>
      </footer>
    </div>
  )
}

function DashboardMock() {
  const weekDays = [
    { short: 'Mon', full: 'Monday', date: '04/14' },
    { short: 'Tue', full: 'Tuesday', date: '04/15' },
    { short: 'Wed', full: 'Wednesday', date: '04/16', isToday: true },
    { short: 'Thu', full: 'Thursday', date: '04/17' },
    { short: 'Fri', full: 'Friday', date: '04/18' },
    { short: 'Sat', full: 'Saturday', date: '04/19' },
    { short: 'Sun', full: 'Sunday', date: '04/20' },
  ]
  const hours = [8, 9, 10, 11, 12, 13, 14, 15]
  const currentHour = 11
  const mockPosts = {
    '1-9': { title: 'April recap post', status: 'published' },
    '2-11': { title: 'Product teaser', status: 'scheduled' },
    '4-10': { title: 'Founder story', status: 'scheduled' },
    '6-13': { title: 'Results thread', status: 'published' },
  }
  const statusStyles = {
    scheduled: { bg: 'bg-blue-500/15', text: 'text-blue-300', ring: 'ring-blue-400/20' },
    published: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-400/20' },
  }

  function formatHourLabel(hour) {
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const h = hour % 12 || 12
    return `${h}:00${suffix}`
  }

  return (
    <div className="flex h-[410px] min-h-[410px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a] shadow-sm shadow-black/40">
      <div className="flex flex-col gap-3 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-1.5 text-white/50" aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium tracking-tight text-white/90">04/14/2026 - 04/20/2026</span>
          <button type="button" className="rounded-lg p-1.5 text-white/50" aria-label="Next week">
            <ChevronRight size={16} />
          </button>
          <span className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70">Today</span>
        </div>

        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
          <span className="rounded-lg px-3 py-1 text-sm font-medium text-white/50">Day</span>
          <span className="rounded-lg bg-white/10 px-3 py-1 text-sm font-medium text-white">Week</span>
          <span className="rounded-lg px-3 py-1 text-sm font-medium text-white/50">Month</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[52px] sm:w-[72px]" style={{ minWidth: 42 }} />
                {weekDays.map(day => (
                  <col key={day.date} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-r border-white/[0.06] bg-[#0a0a0a] px-2 py-3" aria-hidden />
                  {weekDays.map(day => (
                    <th
                      key={day.date}
                      className="border-b border-r border-white/[0.04] bg-[#0a0a0a] px-2 py-3 text-center align-bottom font-normal"
                    >
                      <div className="text-[11px] font-medium text-white/60">
                        <span className="hidden sm:inline">{day.full}</span>
                        <span className="sm:hidden">{day.short}</span>
                      </div>
                      <div className={`mt-0.5 inline-flex items-center justify-center gap-1 text-[10px] font-medium sm:text-sm ${day.isToday ? 'text-purple' : 'text-white/40'}`}>
                        {day.isToday && <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple sm:h-2 sm:w-2" />}
                        {day.date}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(hour => (
                  <tr key={hour} className="border-b border-white/[0.04]">
                    <td className={`border-r border-white/[0.06] px-1 py-2 text-right align-top text-[10px] font-medium sm:px-2 sm:py-3 sm:text-[11px] ${hour < currentHour ? 'text-white/15 line-through' : 'text-white/30'}`}>
                      {formatHourLabel(hour)}
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const key = `${dayIdx}-${hour}`
                      const post = mockPosts[key]
                      const isPast = dayIdx < 2 || (day.isToday && hour < currentHour)
                      const colors = post ? statusStyles[post.status] : null

                      return (
                        <td
                          key={key}
                          className={`border-r border-white/[0.05] p-0 align-top relative ${day.isToday && !isPast ? 'bg-purple/[0.03]' : ''}`}
                          style={
                            isPast
                              ? {
                                  backgroundImage:
                                    'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
                                }
                              : undefined
                          }
                        >
                          <div className="min-h-[42px]">
                            {post && colors && (
                              <div className={`mx-1 my-1 overflow-hidden rounded-lg ring-1 ${isPast ? 'bg-white/[0.06] ring-white/[0.06]' : `${colors.bg} ${colors.ring}`}`}>
                                <div className={`h-1.5 w-full ${isPast ? 'bg-white/10' : 'bg-purple'}`} />
                                <div className="flex items-center gap-1.5 px-2 py-1.5">
                                  <svg className="h-4 w-4 shrink-0 text-blue-400/60" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                  </svg>
                                  <span className={`block w-full truncate text-[11px] font-semibold ${isPast ? 'text-white/40' : colors.text}`}>
                                    {post.title}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
