import { Navigate, NavLink } from 'react-router-dom'
import { ArrowRight, CalendarClock, BarChart3, Zap, Sparkles, CheckCircle2 } from 'lucide-react'
import AppLogo from '@/components/AppLogo'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const highlights = [
  {
    title: 'Smart Scheduling',
    description: 'Plan posts by timezone so your content lands when your audience is active.',
    icon: CalendarClock,
  },
  {
    title: 'Auto-Publish',
    description: 'Set it once and let LinkedPush publish at exactly the right time.',
    icon: Zap,
  },
  {
    title: 'AI Writing',
    description: 'Generate first drafts and improve post quality without staring at a blank page.',
    icon: Sparkles,
  },
  {
    title: 'Performance Insights',
    description: 'Track impressions and engagement to double down on what works.',
    icon: BarChart3,
  },
]

const steps = [
  'Draft your post with rich editor + AI assist',
  'Pick a publish time that fits your audience',
  'Review analytics and improve your next post',
]

export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-discord-bg bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/brand/login-bg.png')" }}
        />
        <div className="absolute inset-0 bg-discord-bg/80" />
        <Skeleton className="relative h-8 w-8 rounded-full bg-purple/30" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-discord-bg">
      <div
        className="absolute inset-0 bg-discord-bg bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/brand/login-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-discord-bg/80 via-discord-bg/85 to-discord-bg/95" />
      <div className="pointer-events-none absolute inset-0 opacity-45">
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-purple/30 blur-3xl" />
        <div className="absolute -right-20 bottom-16 h-72 w-72 rounded-full bg-purple/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <AppLogo variant="hero" />
          <Button
            asChild
            variant="outline"
            className="border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.08] hover:text-white"
          >
            <NavLink to="/login">Sign in</NavLink>
          </Button>
        </header>

        <Card className="border-white/[0.08] bg-discord-bg-elevated shadow-[0_28px_60px_-18px_rgba(0,0,0,0.45)]">
          <CardContent className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.13em] text-purple-light/90">
                Built for solo creators
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-discord-text-primary sm:text-4xl">
                Plan LinkedIn content in minutes, not hours.
              </h1>
              <p className="mt-4 max-w-xl text-base text-discord-text-secondary sm:text-lg">
                LinkedPush helps you write, schedule, and publish consistent content so your personal brand keeps growing
                even when your calendar is packed.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="group h-auto rounded-2xl bg-purple px-6 py-3 font-medium text-white hover:bg-purple-dark"
                >
                  <NavLink to="/login">
                    Start with LinkedIn
                    <ArrowRight
                      size={16}
                      className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </NavLink>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-auto rounded-2xl border-white/15 bg-white/[0.02] px-5 py-3 text-white hover:bg-white/[0.08] hover:text-white"
                >
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-discord-text-secondary">
                Preview workflow
              </p>
              <div className="space-y-3">
                {steps.map(step => (
                  <div key={step} className="flex items-start gap-3 rounded-xl bg-black/20 px-3 py-2.5">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-purple-light" />
                    <p className="text-sm text-discord-text-primary">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-white/[0.08] bg-discord-bg-elevated">
              <CardContent className="px-4 py-4">
                <div className="mb-2 inline-flex rounded-lg bg-purple/20 p-2 text-purple-light">
                  <Icon size={16} />
                </div>
                <h3 className="text-sm font-semibold text-discord-text-primary">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-discord-text-secondary">{description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="how-it-works" className="rounded-2xl border border-white/[0.08] bg-discord-bg-elevated px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-discord-text-secondary">How it works</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {['Write', 'Schedule', 'Grow'].map((label, index) => (
              <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-xs text-purple-light">Step {index + 1}</p>
                <h4 className="mt-1 text-lg font-semibold text-discord-text-primary">{label}</h4>
                <p className="mt-2 text-sm text-discord-text-secondary">{steps[index]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
