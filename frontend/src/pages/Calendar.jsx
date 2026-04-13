import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const ROW_HEIGHT = 56

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return div.textContent || div.innerText || ''
}

function formatLocalYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatHourLabel(hour) {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:00 ${ampm}`
}

function getMonday(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d
}

function getWeekDays(date) {
  const monday = getMonday(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getMonthMatrix(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const firstOffset = (first.getDay() + 6) % 7 // Monday-first
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < firstOffset; i++) {
    const d = new Date(year, month, 1 - (firstOffset - i))
    cells.push({ date: d, currentMonth: false })
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ date: new Date(year, month, i), currentMonth: true })
  }
  while (cells.length < 42) {
    const nextIndex = cells.length - (firstOffset + totalDays) + 1
    cells.push({ date: new Date(year, month + 1, nextIndex), currentMonth: false })
  }
  return cells
}

export default function Calendar() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [viewMode, setViewMode] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    setLoading(true)
    try {
      const res = await fetch('/api/posts?per_page=200', { credentials: 'include' })
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

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const monthCells = useMemo(() => getMonthMatrix(currentDate), [currentDate])
  const todayStr = formatLocalYMD(new Date())

  const visibleDays = viewMode === 'day' ? [currentDate] : weekDays
  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const p of posts) {
      const source = p.scheduled_at || p.created_at
      if (!source) continue
      const dt = new Date(source)
      const key = formatLocalYMD(dt)
      const arr = map.get(key) || []
      arr.push({ ...p, __date: dt })
      map.set(key, arr)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.__date - b.__date)
    }
    return map
  }, [posts])

  function nav(delta) {
    const d = new Date(currentDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() + delta)
    else if (viewMode === 'day') d.setDate(d.getDate() + delta)
    else d.setDate(d.getDate() + delta * 7)
    setCurrentDate(d)
  }

  function dateRangeLabel() {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })
    }
    const start = weekDays[0]
    const end = weekDays[6]
    return `${start.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })}`
  }

  return (
    <div className="max-w-7xl text-white">
      <div className="mb-4 text-[30px] font-extrabold tracking-tight">Calendar</div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Left utility panel */}
          <aside className="border-b border-white/10 bg-[#111111] p-3 lg:border-b-0 lg:border-r">
            <p className="mb-2 text-sm font-bold text-white">Channels</p>
            <div className="space-y-2">
              <button className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/[0.06]">
                + Add Channel
              </button>
              <button
                onClick={() => navigate('/compose')}
                className="w-full rounded-lg bg-purple px-3 py-2 text-left text-xs font-bold text-white hover:bg-purple-dark"
              >
                + Create Post
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {['Lam Nguyen', 'Moist_Company', 'Lam Nguyen'].map(name => (
                <div key={name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-purple to-purple-dark" />
                  <span className="truncate text-xs font-semibold text-white/85">{name}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Right schedule area */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nav(-1)}
                  className="rounded-lg p-2 text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/90">
                  {dateRangeLabel()}
                </div>
                <button
                  type="button"
                  onClick={() => nav(1)}
                  className="rounded-lg p-2 text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate(new Date())}
                  className="ml-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/[0.06]"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-1">
                {['day', 'week', 'month'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                      viewMode === mode
                        ? 'bg-white text-slate-900'
                        : 'border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
                    )}
                  >
                    {mode}
                  </button>
                ))}
                <button className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/80 hover:bg-white/[0.06]">
                  <CalendarDays size={14} />
                </button>
                <button className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/80 hover:bg-white/[0.06]">
                  <List size={14} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-4">
                <div className="skeleton h-[620px] w-full rounded-xl" />
              </div>
            ) : viewMode === 'month' ? (
              <div>
                <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
                  {WEEKDAYS.map(day => (
                    <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-white/50">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map(({ date, currentMonth }, idx) => {
                    const key = formatLocalYMD(date)
                    const dayPosts = eventsByDate.get(key) || []
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => navigate(`/compose?date=${key}`)}
                        className={cn(
                          'min-h-[104px] border-b border-r border-white/10 p-2 text-left transition-colors',
                          currentMonth ? 'hover:bg-purple/10' : 'bg-white/[0.02] text-white/35'
                        )}
                      >
                        <div className="mb-1 text-xs font-bold">{date.getDate()}</div>
                        {dayPosts.slice(0, 2).map(p => (
                          <div key={p.id} className="mb-1 truncate rounded bg-purple/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-light">
                            {p.title || stripHtml(p.content).slice(0, 24) || 'Untitled'}
                          </div>
                        ))}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="overflow-auto">
                <div className={cn('grid border-b border-white/10 bg-white/[0.02]', viewMode === 'day' ? 'grid-cols-[90px_minmax(0,1fr)]' : 'grid-cols-[90px_repeat(7,minmax(0,1fr))]')}>
                  <div className="border-r border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Time
                  </div>
                  {visibleDays.map(d => {
                    const dateKey = formatLocalYMD(d)
                    const isToday = dateKey === todayStr
                    return (
                      <div key={dateKey} className={cn('border-r border-white/10 px-2 py-2 text-center', isToday && 'text-purple-light')}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                          {d.toLocaleDateString(undefined, { weekday: 'long' })}
                        </div>
                        <div className={cn('text-[13px] font-bold text-white', isToday && 'text-purple-light')}>
                          {d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className={cn('grid', viewMode === 'day' ? 'grid-cols-[90px_minmax(0,1fr)]' : 'grid-cols-[90px_repeat(7,minmax(0,1fr))]')}>
                  {/* Time axis */}
                  <div className="border-r border-white/10">
                    {HOURS.map(hour => (
                      <div key={hour} className="border-b border-white/10 px-2 pt-1 text-[11px] font-semibold text-white/45" style={{ height: `${ROW_HEIGHT}px` }}>
                        {formatHourLabel(hour)}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {visibleDays.map(d => {
                    const dateKey = formatLocalYMD(d)
                    const dayEvents = eventsByDate.get(dateKey) || []
                    return (
                      <div key={dateKey} className="relative border-r border-white/10">
                        {HOURS.map(hour => (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => {
                              const hourStr = String(hour).padStart(2, '0')
                              navigate(`/compose?date=${dateKey}&time=${hourStr}:00`)
                            }}
                            className="block w-full border-b border-white/10 transition-colors hover:bg-white/[0.02]"
                            style={{ height: `${ROW_HEIGHT}px` }}
                            aria-label={`Schedule at ${formatHourLabel(hour)} on ${dateKey}`}
                          />
                        ))}

                        {dayEvents.map((event, i) => {
                          const h = event.__date.getHours()
                          const m = event.__date.getMinutes()
                          const top = h * ROW_HEIGHT + Math.floor((m / 60) * ROW_HEIGHT) + 4
                          const title = event.title || stripHtml(event.content).slice(0, 38) || 'Untitled'
                          return (
                            <button
                              key={`${event.id}-${i}`}
                              onClick={() => navigate(`/compose/${event.id}`)}
                              className="absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-purple/35 bg-purple/20 px-2 py-1 text-left shadow-[0_4px_14px_rgba(124,58,237,0.24)] hover:bg-purple/25"
                              style={{ top, height: 34 }}
                              title={title}
                            >
                              <span className="truncate text-[11px] font-semibold text-purple-light">{title}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
