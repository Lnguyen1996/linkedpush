import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const statusColors = {
  draft: 'bg-gray-200 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  publishing: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // month | week
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    setLoading(true)
    try {
      const res = await fetch('/api/posts?per_page=200', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  function getPostsForDate(date) {
    const dateStr = date.toISOString().split('T')[0]
    return posts.filter(p => {
      const postDate = p.scheduled_at || p.created_at
      if (!postDate) return false
      return postDate.split('T')[0] === dateStr
    })
  }

  function stripHtml(html) {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  // Generate calendar grid for month view
  function getMonthDays() {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days = []
    // Previous month padding
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, -startOffset + i + 1)
      days.push({ date: d, isCurrentMonth: false })
    }
    // Current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    // Next month padding
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    return days
  }

  // Generate week days
  function getWeekDays() {
    const day = currentDate.getDay()
    const start = new Date(currentDate)
    start.setDate(start.getDate() - day)
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push({ date: d, isCurrentMonth: d.getMonth() === month })
    }
    return days
  }

  function navigateMonth(delta) {
    setCurrentDate(new Date(year, month + delta, 1))
  }

  function navigateWeek(delta) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + delta * 7)
    setCurrentDate(d)
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const days = viewMode === 'month' ? getMonthDays() : getWeekDays()

  const monthName = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const weekRange = viewMode === 'week'
    ? `${days[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${days[6].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-linkedin" />
          <h1 className="text-2xl font-semibold text-dark">Calendar</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'month' ? 'bg-linkedin text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'week' ? 'bg-linkedin text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-medium text-dark">
          {viewMode === 'month' ? monthName : weekRange}
        </h2>
        <button
          onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAYS.map(day => (
              <div key={day} className="px-2 py-2 text-xs font-medium text-gray-500 text-center">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className={`grid grid-cols-7 ${viewMode === 'month' ? '' : ''}`}>
            {days.map(({ date, isCurrentMonth }, idx) => {
              const dateStr = date.toISOString().split('T')[0]
              const isToday = dateStr === todayStr
              const dayPosts = getPostsForDate(date)

              return (
                <div
                  key={idx}
                  className={`border-b border-r border-gray-100 p-1.5 ${
                    viewMode === 'week' ? 'min-h-[200px]' : 'min-h-[100px]'
                  } ${!isCurrentMonth ? 'bg-gray-50' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-linkedin text-white' : isCurrentMonth ? 'text-dark' : 'text-gray-300'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, viewMode === 'week' ? 10 : 3).map(post => (
                      <button
                        key={post.id}
                        onClick={() => navigate(`/compose/${post.id}`)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium truncate ${
                          statusColors[post.status] || statusColors.draft
                        } hover:opacity-80 transition-opacity`}
                        title={post.title || stripHtml(post.content).slice(0, 50)}
                      >
                        {post.title || stripHtml(post.content).slice(0, 30) || 'Untitled'}
                      </button>
                    ))}
                    {dayPosts.length > (viewMode === 'week' ? 10 : 3) && (
                      <div className="text-[10px] text-gray-400 px-1.5">
                        +{dayPosts.length - (viewMode === 'week' ? 10 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
