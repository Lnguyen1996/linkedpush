import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PenSquare, ChevronDown, ChevronUp, Calendar, Save, Send } from 'lucide-react'
import TipTapEditor from '../components/TipTapEditor'

export default function Compose() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [plainText, setPlainText] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [showFirstComment, setShowFirstComment] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadPost(id)
    }
  }, [id])

  async function loadPost(postId) {
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, { credentials: 'include' })
      if (res.ok) {
        const post = await res.json()
        setTitle(post.title || '')
        setContent(post.content || '')
        if (post.first_comment) {
          setFirstComment(post.first_comment)
          setShowFirstComment(true)
        }
        if (post.scheduled_at) {
          const dt = new Date(post.scheduled_at)
          setScheduledDate(dt.toISOString().split('T')[0])
          setScheduledTime(dt.toISOString().split('T')[1].slice(0, 5))
          setShowSchedule(true)
        }
        if (post.timezone) setTimezone(post.timezone)
      }
    } catch (err) {
      console.error('Failed to load post:', err)
    } finally {
      setLoading(false)
    }
  }

  async function savePost(status) {
    setSaving(true)
    try {
      const body = {
        title: title || null,
        content,
        status,
        first_comment: firstComment || null,
        timezone,
      }

      if (status === 'scheduled' && scheduledDate && scheduledTime) {
        body.scheduled_at = `${scheduledDate}T${scheduledTime}:00`
      }

      const url = id ? `/api/posts/${id}` : '/api/posts'
      const method = id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const saved = await res.json()
        if (!id) {
          navigate(`/compose/${saved.id}`, { replace: true })
        }
      }
    } catch (err) {
      console.error('Failed to save post:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading post...</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <PenSquare size={24} className="text-linkedin" />
        <h1 className="text-2xl font-semibold text-dark">
          {id ? 'Edit Post' : 'Compose'}
        </h1>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <input
          type="text"
          placeholder="Post title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin"
        />

        {/* Rich text editor */}
        <TipTapEditor
          content={content}
          onChange={(html, text) => {
            setContent(html)
            setPlainText(text)
          }}
        />

        {/* First Comment Section */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFirstComment(!showFirstComment)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>First Comment</span>
            {showFirstComment ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showFirstComment && (
            <div className="px-4 pb-4">
              <textarea
                placeholder="Write a comment to be posted right after your main post..."
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin resize-none"
              />
            </div>
          )}
        </div>

        {/* Schedule Section */}
        {showSchedule && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-linkedin/30 focus:border-linkedin bg-white"
              >
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => savePost('draft')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>

          {!showSchedule ? (
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linkedin text-white text-sm font-medium hover:bg-linkedin-dark transition-colors"
            >
              <Calendar size={16} />
              Schedule
            </button>
          ) : (
            <button
              onClick={() => savePost('scheduled')}
              disabled={saving || !scheduledDate || !scheduledTime}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linkedin text-white text-sm font-medium hover:bg-linkedin-dark transition-colors disabled:opacity-50"
            >
              <Send size={16} />
              {saving ? 'Scheduling...' : 'Schedule Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
