import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PenSquare, ChevronDown, ChevronUp, Calendar, Save, Send, ImagePlus, X, FolderOpen, Zap } from 'lucide-react'
import TipTapEditor from '../components/TipTapEditor'

export default function Compose() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)
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
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageId, setImageId] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaItems, setMediaItems] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (id) loadPost(id)
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
        if (post.image_id) {
          setImageId(post.image_id)
          setImageUrl(post.image_url)
        }
      }
    } catch (err) {
      console.error('Failed to load post:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) {
        const media = await res.json()
        setImageId(media.id)
        setImageUrl(`/uploads/${media.filename}`)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openMediaPicker() {
    try {
      const res = await fetch('/api/media', { credentials: 'include' })
      if (res.ok) setMediaItems(await res.json())
    } catch {}
    setShowMediaPicker(true)
  }

  function selectFromLibrary(item) {
    setImageId(item.id)
    setImageUrl(`/uploads/${item.filename}`)
    setShowMediaPicker(false)
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
        image_id: imageId,
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

  async function publishNow() {
    // Save first if new post
    if (!id) {
      await savePost('draft')
    }
    const postId = id || null
    if (!postId) return

    setPublishing(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await loadPost(postId)
      } else {
        const err = await res.json()
        console.error('Publish failed:', err.detail)
      }
    } catch (err) {
      console.error('Publish failed:', err)
    } finally {
      setPublishing(false)
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

        {/* Image attachment */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Attached" className="max-h-40 rounded-lg border border-gray-200" />
              <button
                onClick={() => { setImageId(null); setImageUrl(null) }}
                className="absolute -top-2 -right-2 p-1 bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-50"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ImagePlus size={16} />
                {uploading ? 'Uploading...' : 'Upload Image'}
              </button>
              <button
                onClick={openMediaPicker}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FolderOpen size={16} />
                From Library
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

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

          <button
            onClick={publishNow}
            disabled={publishing || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 ml-auto"
          >
            <Zap size={16} />
            {publishing ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-dark">Select from Media Library</h3>
              <button onClick={() => setShowMediaPicker(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              {mediaItems.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No images in library</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {mediaItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectFromLibrary(item)}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-linkedin transition-colors"
                    >
                      <img src={`/uploads/${item.filename}`} alt={item.original_filename} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
