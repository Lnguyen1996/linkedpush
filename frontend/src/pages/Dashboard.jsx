import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Clock,
  FileText,
  Plus,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const calendarStatusColors = {
  draft: { bg: 'bg-white/5', text: 'text-slate-300', dot: 'bg-slate-400' },
  scheduled: { bg: 'bg-blue-500/15', text: 'text-blue-300', dot: 'bg-blue-400' },
  publishing: { bg: 'bg-amber-500/15', text: 'text-amber-300', dot: 'bg-amber-400' },
  published: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-300', dot: 'bg-red-400' },
}

const statusConfig = {
  draft: { label: 'Draft', badge: 'bg-white/5 text-slate-300 border-white/10', dot: 'bg-slate-400', icon: FileText },
  scheduled: { label: 'Scheduled', badge: 'bg-blue-500/15 text-blue-300 border-blue-400/20', dot: 'bg-blue-400', icon: Clock },
  publishing: { label: 'Publishing', badge: 'bg-amber-500/15 text-amber-300 border-amber-400/20', dot: 'bg-amber-400', icon: Clock },
  published: { label: 'Published', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20', dot: 'bg-emerald-400', icon: CheckCircle2 },
  failed: { label: 'Failed', badge: 'bg-red-500/15 text-red-300 border-red-400/20', dot: 'bg-red-400', icon: XCircle },
}

const filterTabs = [
  { value: 'all', label: 'All Posts' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
]

function formatLocalYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(formatLocalYMD(new Date()))

  useEffect(() => {
    loadPosts()
  }, [filter])

  async function loadPosts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', per_page: '50' })
      if (filter && filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/posts?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: posts.length,
    drafts: posts.filter(p => p.status === 'draft').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
  }

  const nextScheduledPost = useMemo(
    () =>
      posts
        .filter(p => p.status === 'scheduled' && p.scheduled_at)
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null,
    [posts]
  )

  const selectedDayPosts = useMemo(
    () =>
      posts.filter(p => {
        const postDate = p.scheduled_at || p.created_at
        if (!postDate) return false
        return formatLocalYMD(new Date(postDate)) === selectedDate
      }),
    [posts, selectedDate]
  )

  return (
    <div className="max-w-7xl text-white">
      <div className="mb-7 rounded-2xl border border-white/10 bg-gradient-to-r from-[#1a1a2e] to-[#171717] px-5 py-4 shadow-sm shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center rounded-full border border-purple/30 bg-purple/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-purple-light">
              Overview
            </div>
            <h1 className="text-[32px] font-extrabold leading-none tracking-tight text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-sm font-medium text-white/65">
              Manage and track your LinkedIn content
            </p>
          </div>
          <Link
            to="/compose"
            className="group inline-flex h-11 items-center gap-2 rounded-xl bg-purple px-5 text-sm font-bold text-white shadow-md shadow-purple/30 transition-all duration-200 hover:bg-purple-dark hover:shadow-lg hover:shadow-purple/35"
          >
            <Plus size={18} />
            New Post
            <ArrowRight size={16} className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        </div>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Total Posts" value={stats.total} glyph="total" accent="purple" />
        <StatCard label="Drafts" value={stats.drafts} glyph="drafts" accent="slate" />
        <StatCard label="Scheduled" value={stats.scheduled} glyph="scheduled" accent="blue" />
        <StatCard label="Published" value={stats.published} glyph="published" accent="emerald" />
      </div>

      <DashboardCalendar
        posts={posts}
        currentDate={calDate}
        setCurrentDate={setCalDate}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedDayPosts={selectedDayPosts}
        navigate={navigate}
      />

      <div className="mb-5 mt-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150',
              filter === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-white/65 hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-[76px] w-full rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#171717] p-16 text-center">
          <h3 className="mb-2 text-lg font-semibold text-white">No posts yet</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-white/60">Create your first LinkedIn post to start building your content pipeline.</p>
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-dark"
          >
            <Plus size={16} />
            Create Your First Post
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {posts.map(post => {
            const cfg = statusConfig[post.status] || statusConfig.draft
            const StatusIcon = cfg.icon
            const preview = post.title || stripHtml(post.content).slice(0, 100) || 'Untitled post'

            return (
              <Link
                key={post.id}
                to={`/compose/${post.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#171717] px-5 py-4 transition-all hover:border-purple/40 hover:bg-[#1a1a1a]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                  <StatusIcon size={21} className="text-white/75" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-white group-hover:text-purple">{preview}</div>
                  <div className="mt-1 text-xs font-medium text-white/55">
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold', cfg.badge)}>
                  <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                  {cfg.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {nextScheduledPost && (
        <div className="mt-5 rounded-xl border border-purple/25 bg-purple/10 px-4 py-3 text-xs text-blue-100">
          <span className="font-semibold">Next scheduled post:</span> {new Date(nextScheduledPost.scheduled_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

function DashboardCalendar({
  posts,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  selectedDayPosts,
  navigate,
}) {
  const [view, setView] = useState('week')
  const todayStr = formatLocalYMD(new Date())
  const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0 AM to 11 PM

  function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    // Monday-based week: if Sunday (0), go back 6 days; otherwise go back (day - 1)
    const diff = day === 0 ? 6 : day - 1
    d.setDate(d.getDate() - diff)
    return d
  }

  function getWeekDays(date) {
    const start = getWeekStart(date)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const weekDays = getWeekDays(currentDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  function formatDateRange() {
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    return `${fmt(weekStart)} - ${fmt(weekEnd)}`
  }

  function navigateWeek(dir) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + dir * 7)
    setCurrentDate(d)
  }

  function getPostsForDayAndHour(date, hour) {
    const dateStr = formatLocalYMD(date)
    return posts.filter(p => {
      const postDate = p.scheduled_at || p.created_at
      if (!postDate) return false
      const pd = new Date(postDate)
      return formatLocalYMD(pd) === dateStr && pd.getHours() === hour
    })
  }

  const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a] shadow-sm shadow-black/40">
      {/* Header with navigation and view toggle */}
      <div className="flex flex-col gap-3 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigateWeek(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-white/90 tracking-tight">{formatDateRange()}</span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigateWeek(1)}
          >
            <ChevronRightIcon size={16} />
          </button>
          <button
            type="button"
            className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {['Day', 'Week', 'Month'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v.toLowerCase())}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                view === v.toLowerCase()
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/50 hover:text-white'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Week view time grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-white/[0.06]">
            <div className="border-r border-white/[0.04]" />
            {weekDays.map((day, i) => {
              const dateStr = formatLocalYMD(day)
              const isToday = dateStr === todayStr
              const dateLabel = `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}/${day.getFullYear()}`
              return (
                <div
                  key={i}
                  className="border-r border-white/[0.04] px-2 py-3 text-center"
                >
                  <div className="text-sm font-medium text-white/60">
                    {WEEKDAY_NAMES[i]}
                  </div>
                  <div className={cn(
                    'mt-0.5 text-sm font-medium inline-flex items-center gap-1.5 justify-center',
                    isToday ? 'text-purple' : 'text-white/40'
                  )}>
                    {isToday && <span className="inline-block h-2 w-2 rounded-full bg-purple" />}
                    {dateLabel}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="max-h-[480px] overflow-y-auto">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-white/[0.04]">
                <div className="border-r border-white/[0.06] px-2 py-3 text-right text-[11px] font-medium text-white/30">
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </div>
                {weekDays.map((day, dayIdx) => {
                  const dateStr = formatLocalYMD(day)
                  const isToday = dateStr === todayStr
                  const hourPosts = getPostsForDayAndHour(day, hour)

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => {
                        setSelectedDate(dateStr)
                        navigate(`/compose?date=${dateStr}`)
                      }}
                      className={cn(
                        'min-h-[48px] cursor-pointer border-r border-white/[0.05] px-1 py-1 transition-colors hover:bg-white/[0.03]',
                        isToday && 'bg-purple/[0.03]'
                      )}
                    >
                      {hourPosts.map(post => {
                        const colors = calendarStatusColors[post.status] || calendarStatusColors.draft
                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              navigate(`/compose/${post.id}`)
                            }}
                            className={cn(
                              'mb-0.5 w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors',
                              colors.bg, colors.text,
                              'hover:ring-1 hover:ring-purple/40'
                            )}
                          >
                            {post.title || 'Untitled'}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusMini({ label, value, color }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[11px] font-semibold text-white/75">
      <span className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', color)} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-white">{value}</span>
    </div>
  )
}

function StatGlyph({ type }) {
  if (type === 'total') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <rect x="4" y="5" width="11" height="11" rx="2.5" />
        <rect x="9" y="9" width="11" height="11" rx="2.5" className="opacity-80" />
      </svg>
    )
  }

  if (type === 'drafts') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z" />
        <path d="M14 3.5V8h4" className="fill-[#171717]" />
        <rect x="8" y="12" width="8" height="1.8" rx="0.9" className="fill-[#171717]" />
        <rect x="8" y="15.4" width="6" height="1.8" rx="0.9" className="fill-[#171717]" />
      </svg>
    )
  }

  if (type === 'scheduled') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <rect x="3.5" y="8.3" width="17" height="2.2" className="fill-[#171717]" />
        <circle cx="12" cy="15" r="3.2" className="fill-[#171717]" />
        <rect x="11.45" y="13.1" width="1.1" height="2.2" rx="0.55" />
        <rect x="12" y="14.5" width="2.1" height="1.1" rx="0.55" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.8L10.6 15.2 16.2 9.6" className="fill-none stroke-[#171717] stroke-[2.3] stroke-linecap-round stroke-linejoin-round" />
    </svg>
  )
}

function StatCard({ label, value, glyph, accent = 'slate' }) {
  const accentClass = {
    purple: 'text-purple bg-gradient-to-br from-purple/30 to-purple/10 ring-purple/40 shadow-purple/20',
    slate: 'text-slate-200 bg-gradient-to-br from-white/[0.12] to-white/[0.03] ring-white/15 shadow-black/30',
    blue: 'text-blue-300 bg-gradient-to-br from-blue-500/30 to-blue-500/10 ring-blue-400/40 shadow-blue-500/20',
    emerald: 'text-emerald-300 bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 ring-emerald-400/40 shadow-emerald-500/20',
  }[accent]

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#111a2d] to-[#0d1423] px-4 py-3.5 shadow-sm shadow-black/30 ring-1 ring-white/5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className={cn('relative rounded-xl p-2.5 ring-1 shadow-md shadow-black/20', accentClass)}>
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-white/70 ring-2 ring-[#171717]" />
          <StatGlyph type={glyph} />
        </div>
      </div>
      <div className="text-[32px] leading-none font-extrabold tabular-nums tracking-tight text-white">{value}</div>
      <div className="mt-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/60">{label}</div>
    </div>
  )
}
