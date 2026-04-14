import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Clock,
  Eye,
  FileText,
  Flame,
  Image,
  Pencil,
  PenSquare,
  Plus,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    loadPosts()
  }, [filter])

  useEffect(() => {
    fetch('/api/posts/streak', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setStreak(data.streak) })
      .catch(() => {})
  }, [posts])

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

  const hasPostContent = loading || posts.length > 0

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-1 flex-col text-white lg:min-h-[calc(100dvh-7rem)]">
      {/* Compact action bar */}
      <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {streak > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5">
              <Flame size={16} className="text-amber-400" />
              <span className="text-sm font-bold tabular-nums text-amber-300">{streak}</span>
              <span className="text-[10px] font-semibold text-amber-300/70">day{streak !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <StatusMini label="Total" value={stats.total} color="bg-purple" />
            <StatusMini label="Drafts" value={stats.drafts} color="bg-slate-400" />
            <StatusMini label="Scheduled" value={stats.scheduled} color="bg-blue-400" hideOnMobile />
            <StatusMini label="Published" value={stats.published} color="bg-emerald-400" hideOnMobile />
          </div>
        </div>
        <Link
          to="/compose"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple px-3 sm:px-4 text-sm font-semibold text-white shadow-md shadow-purple/30 transition-all hover:bg-purple-dark"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Post</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0">
        {/* Week grid fills space above posts (full-height calendar like Postiz) */}
        <div className="flex min-h-[22rem] flex-1 flex-col">
          <DashboardCalendar
            posts={posts}
            currentDate={calDate}
            setCurrentDate={setCalDate}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            navigate={navigate}
            loadPosts={loadPosts}
          />
        </div>

        {nextScheduledPost && (
          <div className="mt-2 shrink-0 rounded-xl border border-purple/25 bg-purple/10 px-3 py-2.5 text-xs text-blue-100 sm:mt-3 sm:px-4 sm:py-3">
            <span className="font-semibold">Next scheduled post:</span> {new Date(nextScheduledPost.scheduled_at).toLocaleString()}
          </div>
        )}

        {/* Compact strip so the week calendar stays visually full; list scrolls inside */}
        <section
          className={cn(
            'mt-2 flex shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90',
            hasPostContent
              ? 'h-[min(13rem,22dvh)] min-h-[9rem] max-h-[26dvh] sm:mt-3 sm:h-[min(15rem,24dvh)] sm:min-h-[10rem] lg:h-[min(17rem,26dvh)] lg:max-h-[min(20rem,30dvh)]'
              : 'h-[8.5rem] min-h-[8.5rem] sm:h-[10rem] sm:min-h-[10rem]'
          )}
          aria-label="Posts by status"
        >
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-t-2xl border-b border-white/10 bg-[#111111] p-2">
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-[76px] w-full rounded-2xl" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="relative overflow-hidden rounded-xl border border-purple/30 bg-gradient-to-b from-purple/[0.12] via-[#1a1625] to-[#141218] px-3 py-2.5 shadow-[0_0_28px_-18px_rgba(124,58,237,0.45)] sm:px-4 sm:py-3">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-purple/25 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-blue-500/15 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-[#7C3AED] shadow-md shadow-purple/35 ring-1 ring-white/15">
                    <PenSquare size={16} className="text-white" strokeWidth={2.3} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">No posts yet</p>
                    <p className="truncate text-xs text-white/65">
                      Create your first LinkedIn post to start building your content pipeline.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {posts.map(post => {
                  const cfg = statusConfig[post.status] || statusConfig.draft
                  const StatusIcon = cfg.icon
                  const preview = post.title || stripHtml(post.content).slice(0, 100) || 'Untitled post'

                  // Determine media type icon from post.media array
                  let MediaIcon = null
                  if (post.media && post.media.length > 0) {
                    const mType = post.media[0].media_type
                    if (mType === 'video') MediaIcon = Video
                    else if (mType === 'document') MediaIcon = FileText
                    else MediaIcon = Image
                  }

                  return (
                    <Link
                      key={post.id}
                      to={`/compose/${post.id}`}
                      className="group flex items-center gap-2.5 sm:gap-4 rounded-xl sm:rounded-2xl border border-white/10 bg-[#171717] px-3 sm:px-5 py-3 sm:py-4 transition-all hover:border-purple/40 hover:bg-[#1a1a1a]"
                    >
                      <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                        <StatusIcon size={21} className="text-white/75" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-[13px] sm:text-[15px] font-bold text-white group-hover:text-purple">
                          {MediaIcon && <MediaIcon size={14} className="shrink-0 text-white/40" />}
                          <span className="truncate">{preview}</span>
                        </div>
                        <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-medium text-white/55">
                          {new Date(post.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold shrink-0', cfg.badge)}>
                        <span className={cn('h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full', cfg.dot)} />
                        {cfg.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function DashboardCalendar({
  posts,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  navigate,
  loadPosts,
}) {
  const [activePopup, setActivePopup] = useState(null)
  const [now, setNow] = useState(new Date())
  const [nowLineTop, setNowLineTop] = useState(null)
  const [calView, setCalView] = useState('week')
  const scrollContainerRef = useRef(null)
  const tableWrapRef = useRef(null)
  const currentHourRef = useRef(null)
  const todayStr = formatLocalYMD(new Date())
  const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0 AM to 11 PM

  function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
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

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scroll to current time on mount and when view changes
  useEffect(() => {
    if (currentHourRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const row = currentHourRef.current
      const rowTop = row.offsetTop
      const containerHeight = container.clientHeight
      container.scrollTop = Math.max(0, rowTop - containerHeight / 3)
    }
  }, [calView])

  const viewHasToday = useMemo(() => {
    if (calView === 'day') return formatLocalYMD(currentDate) === todayStr
    if (calView === 'week') return weekDays.some(d => formatLocalYMD(d) === todayStr)
    if (calView === 'month') {
      const todayDate = new Date()
      return todayDate.getFullYear() === currentDate.getFullYear() && todayDate.getMonth() === currentDate.getMonth()
    }
    return false
  }, [calView, weekDays, currentDate, todayStr])

  useLayoutEffect(() => {
    function measureNowLine() {
      const wrap = tableWrapRef.current
      const tr = currentHourRef.current
      if (!wrap || !tr || !viewHasToday) {
        setNowLineTop(null)
        return
      }
      const wrapRect = wrap.getBoundingClientRect()
      const trRect = tr.getBoundingClientRect()
      const y =
        trRect.top -
        wrapRect.top +
        (now.getMinutes() / 60) * tr.offsetHeight
      setNowLineTop(Number.isFinite(y) ? y : null)
    }

    measureNowLine()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureNowLine) : null
    if (ro && tableWrapRef.current) ro.observe(tableWrapRef.current)
    window.addEventListener('resize', measureNowLine)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measureNowLine)
    }
  }, [now, viewHasToday, posts, currentDate, calView])

  function formatHeaderLabel() {
    if (calView === 'day') {
      return currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
    if (calView === 'month') {
      return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    }
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    return `${fmt(weekStart)} - ${fmt(weekEnd)}`
  }

  function navigateCal(dir) {
    const d = new Date(currentDate)
    if (calView === 'day') {
      d.setDate(d.getDate() + dir)
    } else if (calView === 'week') {
      d.setDate(d.getDate() + dir * 7)
    } else {
      d.setMonth(d.getMonth() + dir)
    }
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

  function getPostsForDay(date) {
    const dateStr = formatLocalYMD(date)
    return posts.filter(p => {
      const postDate = p.scheduled_at || p.created_at
      if (!postDate) return false
      return formatLocalYMD(new Date(postDate)) === dateStr
    })
  }

  function formatHourLabel(hour) {
    return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
  }

  const WEEKDAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const WEEKDAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Month view helpers
  function getMonthGrid(date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const days = []
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, currentMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), currentMonth: true })
    }
    while (days.length < 42) {
      const nextIdx = days.length - startDow - lastDay.getDate()
      days.push({ date: new Date(year, month + 1, nextIdx + 1), currentMonth: false })
    }
    const weeks = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }
    return weeks
  }

  // Shared post card for hourly views (day/week)
  function PostCard({ post, isPast }) {
    const colors = calendarStatusColors[post.status] || calendarStatusColors.draft
    const isOpen = activePopup === post.id
    const preview = post.title || stripHtml(post.content).slice(0, 60) || 'Untitled'
    return (
      <div className="relative">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            setActivePopup(isOpen ? null : post.id)
          }}
          className={cn(
            'w-full overflow-hidden rounded-lg text-left transition-colors',
            isPast ? 'bg-white/[0.06] ring-1 ring-white/[0.06]' : 'ring-1 ring-white/[0.08]',
            isOpen ? 'ring-1 ring-purple/60' : 'hover:ring-1 hover:ring-purple/40'
          )}
        >
          <div className={cn(
            'h-1.5 w-full',
            isPast ? 'bg-white/10' : 'bg-purple'
          )} />
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <svg className="h-4 w-4 shrink-0 text-blue-400/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span
              className={cn(
                'block w-full truncate text-[11px] font-semibold',
                isPast ? 'text-white/40' : colors.text
              )}
            >
              {preview}
            </span>
          </div>
        </button>
        {isOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-white/15 bg-[#1a1a2e] shadow-2xl shadow-black/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 bg-purple px-3 py-2">
              <button type="button" title="Edit" onClick={() => navigate(`/compose/${post.id}`)} className="rounded-md p-1.5 text-white/80 hover:bg-white/20 hover:text-white"><Pencil size={15} /></button>
              <button type="button" title="Preview" onClick={() => navigate(`/app/post/${post.id}`)} className="rounded-md p-1.5 text-white/80 hover:bg-white/20 hover:text-white"><Eye size={15} /></button>
              <button type="button" title="Analytics" onClick={() => navigate('/analytics')} className="rounded-md p-1.5 text-white/80 hover:bg-white/20 hover:text-white"><BarChart3 size={15} /></button>
              <button
                type="button"
                title="Delete"
                onClick={async () => {
                  if (!confirm('Delete this post?')) return
                  await fetch(`/api/posts/${post.id}`, { method: 'DELETE', credentials: 'include' })
                  setActivePopup(null)
                  loadPosts()
                }}
                className="rounded-md p-1.5 text-white/80 hover:bg-red-500/30 hover:text-red-300"
              ><Trash2 size={15} /></button>
            </div>
            <div className="flex items-start gap-2.5 px-3 py-3">
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-purple/30 flex items-center justify-center">
                <FileText size={13} className="text-purple-light" />
              </div>
              <p className="text-xs leading-relaxed text-white/75 line-clamp-3">
                {stripHtml(post.content).slice(0, 120) || 'No content'}...
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a] shadow-sm shadow-black/40">
      {/* Header with navigation and view toggle */}
      <div className="flex flex-col gap-3 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigateCal(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-white/90 tracking-tight">{formatHeaderLabel()}</span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigateCal(1)}
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

        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
          {['Day', 'Week', 'Month'].map(v => (
            <button key={v} onClick={() => setCalView(v.toLowerCase())}
              className={cn('rounded-lg px-3 py-1 text-sm font-medium transition-colors',
                calView === v.toLowerCase() ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70'
              )}>{v}</button>
          ))}
        </div>
      </div>

      {/* === DAY VIEW === */}
      {calView === 'day' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              <div ref={tableWrapRef} className="relative">
                {/* Day header */}
                <div className="sticky top-0 z-[15] flex items-center justify-center gap-2 border-b border-white/[0.06] bg-[#0a0a0a] px-4 py-3">
                  <span className="text-sm font-medium text-white/60">
                    {currentDate.toLocaleDateString(undefined, { weekday: 'long' })}
                  </span>
                  <span className={cn(
                    'text-sm font-medium inline-flex items-center gap-1.5',
                    formatLocalYMD(currentDate) === todayStr ? 'text-purple' : 'text-white/40'
                  )}>
                    {formatLocalYMD(currentDate) === todayStr && <span className="inline-block h-2 w-2 rounded-full bg-purple" />}
                    {`${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`}
                  </span>
                </div>
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[72px]" style={{ minWidth: 52 }} />
                    <col />
                  </colgroup>
                  <tbody>
                    {HOURS.map(hour => {
                      const dateStr = formatLocalYMD(currentDate)
                      const isToday = dateStr === todayStr
                      const hourPosts = getPostsForDayAndHour(currentDate, hour)
                      const isPast = dateStr < todayStr || (isToday && hour < now.getHours())
                      return (
                        <tr key={hour} ref={hour === now.getHours() ? currentHourRef : undefined} className="border-b border-white/[0.04]">
                          <td className={cn(
                            "border-r border-white/[0.06] px-2 py-3 align-top text-right text-[11px] font-medium",
                            (isPast && isToday) ? 'text-white/15 line-through' : 'text-white/30'
                          )}>
                            {formatHourLabel(hour)}
                          </td>
                          <td
                            className={cn(
                              'border-r border-white/[0.05] p-0 align-top relative',
                              isToday && !isPast && 'bg-purple/[0.03]'
                            )}
                            style={isPast ? {
                              backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
                            } : undefined}
                          >
                            {isToday && hour === now.getHours() && (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-[2] flex items-center"
                                style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                              >
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                                <div className="h-[2px] flex-1 bg-red-500 shadow-[0_1px_3px_rgba(239,68,68,0.3)]" />
                              </div>
                            )}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedDate(dateStr)
                                navigate(`/compose?date=${dateStr}`)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedDate(dateStr)
                                  navigate(`/compose?date=${dateStr}`)
                                }
                              }}
                              className="group min-h-[48px] cursor-pointer transition-colors hover:bg-white/[0.03]"
                            >
                              {hourPosts.map(post => (
                                <PostCard key={post.id} post={post} isPast={isPast} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === WEEK VIEW === */}
      {calView === 'week' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              <div ref={tableWrapRef} className="relative">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[52px] sm:w-[72px]" style={{ minWidth: 42 }} />
                  {weekDays.map((_, i) => (
                    <col key={i} />
                  ))}
                </colgroup>
                <thead className="relative z-[20]">
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 z-[15] border-b border-r border-white/[0.06] bg-[#0a0a0a] px-2 py-3"
                      aria-hidden={true}
                    />
                    {weekDays.map((day, i) => {
                      const dateStr = formatLocalYMD(day)
                      const isToday = dateStr === todayStr
                      return (
                        <th
                          key={i}
                          scope="col"
                          className="sticky top-0 z-[15] border-b border-r border-white/[0.04] bg-[#0a0a0a] px-2 py-3 text-center align-bottom font-normal"
                        >
                          <div className="text-[11px] sm:text-sm font-medium text-white/60">
                            <span className="hidden sm:inline">{WEEKDAY_NAMES_FULL[i]}</span>
                            <span className="sm:hidden">{WEEKDAY_NAMES_SHORT[i]}</span>
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 text-[10px] sm:text-sm font-medium inline-flex items-center gap-1 sm:gap-1.5 justify-center',
                              isToday ? 'text-purple' : 'text-white/40'
                            )}
                          >
                            {isToday && <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-purple" />}
                            {`${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour} ref={hour === now.getHours() ? currentHourRef : undefined} className="border-b border-white/[0.04]">
                      <td className={cn(
                        "border-r border-white/[0.06] px-1 sm:px-2 py-2 sm:py-3 align-top text-right text-[10px] sm:text-[11px] font-medium",
                        (hour < now.getHours()) ? 'text-white/15 line-through' : 'text-white/30'
                      )}>
                        {formatHourLabel(hour)}
                      </td>
                      {weekDays.map((day, dayIdx) => {
                        const dateStr = formatLocalYMD(day)
                        const isToday = dateStr === todayStr
                        const hourPosts = getPostsForDayAndHour(day, hour)

                        const isPast = dateStr < todayStr || (isToday && hour < now.getHours())

                        return (
                          <td
                            key={dayIdx}
                            className={cn(
                              'border-r border-white/[0.05] p-0 align-top relative',
                              isToday && !isPast && 'bg-purple/[0.03]'
                            )}
                            style={isPast ? {
                              backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
                            } : undefined}
                          >
                            {isToday && hour === now.getHours() && (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-[2] flex items-center"
                                style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                              >
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                                <div className="h-[2px] flex-1 bg-red-500 shadow-[0_1px_3px_rgba(239,68,68,0.3)]" />
                              </div>
                            )}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedDate(dateStr)
                                navigate(`/compose?date=${dateStr}`)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedDate(dateStr)
                                  navigate(`/compose?date=${dateStr}`)
                                }
                              }}
                              className="group min-h-[48px] cursor-pointer transition-colors hover:bg-white/[0.03]"
                            >
                              {hourPosts.map(post => (
                                <PostCard key={post.id} post={post} isPast={isPast} />
                              ))}
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
      )}

      {/* === MONTH VIEW === */}
      {calView === 'month' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                {WEEKDAY_NAMES_SHORT.map(name => (
                  <th key={name} className="border-b border-white/[0.06] px-1 py-2 text-center text-[11px] sm:text-xs font-medium text-white/50">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getMonthGrid(currentDate).map((week, wi) => (
                <tr key={wi} className="border-b border-white/[0.04]">
                  {week.map((cell, di) => {
                    const dateStr = formatLocalYMD(cell.date)
                    const isToday = dateStr === todayStr
                    const isPast = dateStr < todayStr
                    const dayPosts = getPostsForDay(cell.date)
                    const statusSet = [...new Set(dayPosts.map(p => p.status))]
                    return (
                      <td
                        key={di}
                        className={cn(
                          'relative h-[3.5rem] sm:h-[4.5rem] cursor-pointer border-r border-white/[0.04] p-1 align-top transition-colors hover:bg-white/[0.03]',
                          !cell.currentMonth && 'opacity-30',
                          isPast && cell.currentMonth && 'opacity-50'
                        )}
                        style={isPast && cell.currentMonth ? {
                          backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
                        } : undefined}
                        onClick={() => {
                          setSelectedDate(dateStr)
                          setCurrentDate(cell.date)
                          setCalView('day')
                        }}
                      >
                        <div className={cn(
                          'flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-medium',
                          isToday ? 'bg-purple text-white' : 'text-white/60'
                        )}>
                          {cell.date.getDate()}
                        </div>
                        {statusSet.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-0.5 px-0.5">
                            {statusSet.map(status => {
                              const colors = calendarStatusColors[status] || calendarStatusColors.draft
                              return <span key={status} className={cn('inline-block h-1.5 w-1.5 rounded-full', colors.dot)} />
                            })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusMini({ label, value, color, hideOnMobile }) {
  return (
    <div className={cn(
      'items-center gap-1 sm:gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-white/75',
      hideOnMobile ? 'hidden sm:flex' : 'flex'
    )}>
      <span className={cn('h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full', color)} />
      <span className="hidden sm:inline">{label}</span>
      <span className="tabular-nums text-white">{value}</span>
    </div>
  )
}
