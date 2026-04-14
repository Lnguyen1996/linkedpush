import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronDown, ChevronUp, Calendar, Save, Send, ImagePlus, X,
  FolderOpen, Zap, Sparkles, MessageSquare, Globe, Eye, Clock,
  ArrowLeft, Check, Loader2, Video, FileText, Play, Plus
} from 'lucide-react'
import TipTapEditor from '../components/TipTapEditor'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

export default function Compose() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef(null)
  const { addToast } = useToast()
  const { user } = useAuth()
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
  const [mediaType, setMediaType] = useState(null) // 'image' | 'video' | 'document'
  const [mediaIds, setMediaIds] = useState([])
  const [mediaItems, setMediaItems] = useState([]) // { id, url, media_type, original_filename, duration, mime_type }
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [libraryItems, setLibraryItems] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiTone, setAiTone] = useState('professional')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [postStatus, setPostStatus] = useState('draft')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (id) loadPost(id)
  }, [id])

  useEffect(() => {
    if (id) return
    const dateParam = searchParams.get('date')
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return
    setScheduledDate(dateParam)
    setScheduledTime(t => t || '09:00')
    setShowSchedule(true)
    setSearchParams({}, { replace: true })
  }, [id, searchParams, setSearchParams])

  async function loadPost(postId) {
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(`/api/posts/${postId}`, { credentials: 'include' })
      if (!res.ok) {
        setNotFound(true)
        return
      }
      if (res.ok) {
        const post = await res.json()
        setTitle(post.title || '')
        setContent(post.content || '')
        const raw = post.content || ''
        if (raw.includes('<p>') || raw.includes('<br')) {
          const stripped = raw
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .trim()
          setPlainText(stripped)
        } else {
          setPlainText(raw)
        }
        setPostStatus(post.status || 'draft')
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
        // Load media attachments from post.media array
        if (post.media && post.media.length > 0) {
          const items = post.media.map(m => ({
            id: m.id,
            url: m.url || `/api/media/${m.id}/file`,
            media_type: m.media_type || 'image',
            original_filename: m.original_filename || '',
            duration: m.duration,
            mime_type: m.mime_type || '',
          }))
          setMediaItems(items)
          setMediaIds(items.map(m => m.id))
          setMediaType(items[0].media_type)
        } else if (post.image_id) {
          // Backward compat: single image_id
          const item = {
            id: post.image_id,
            url: post.image_url || `/api/media/${post.image_id}/file`,
            media_type: 'image',
            original_filename: '',
            duration: null,
            mime_type: '',
          }
          setMediaItems([item])
          setMediaIds([post.image_id])
          setMediaType('image')
        }
      }
    } catch (err) {
      console.error('Failed to load post:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Enforce limits
    if (mediaType === 'image' && mediaItems.length + files.length > 9) {
      addToast('Maximum 9 images per post', 'error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if ((mediaType === 'video' || mediaType === 'document') && (mediaItems.length > 0 || files.length > 1)) {
      addToast(`Only 1 ${mediaType} per post`, 'error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        let media
        // Use XMLHttpRequest for video to track progress
        if (mediaType === 'video') {
          media = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/api/media')
            xhr.withCredentials = true
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setUploadProgress(Math.round((e.loaded / e.total) * 100))
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText))
              } else {
                try {
                  const err = JSON.parse(xhr.responseText)
                  reject(new Error(err.detail || 'Upload failed'))
                } catch {
                  reject(new Error('Upload failed'))
                }
              }
            }
            xhr.onerror = () => reject(new Error('Upload failed'))
            xhr.send(formData)
          })
        } else {
          const res = await fetch('/api/media', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            addToast(err.detail || 'Upload failed', 'error')
            continue
          }
          media = await res.json()
        }

        const item = {
          id: media.id,
          url: media.url || `/api/media/${media.id}/file`,
          media_type: media.media_type || mediaType,
          original_filename: media.original_filename || file.name,
          duration: media.duration,
          mime_type: media.mime_type || file.type,
        }
        setMediaItems(prev => [...prev, item])
        setMediaIds(prev => [...prev, media.id])
        addToast(`${mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document'} uploaded`)
      }
    } catch (err) {
      console.error('Upload failed:', err)
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removeMediaItem(id) {
    setMediaItems(prev => prev.filter(m => m.id !== id))
    setMediaIds(prev => prev.filter(mid => mid !== id))
  }

  function clearAllMedia() {
    setMediaItems([])
    setMediaIds([])
    setMediaType(null)
  }

  function switchMediaType(type) {
    if (type === mediaType) {
      // Toggle off
      clearAllMedia()
      return
    }
    // Clear existing and switch
    setMediaItems([])
    setMediaIds([])
    setMediaType(type)
  }

  async function openMediaPicker() {
    try {
      const res = await fetch('/api/media', { credentials: 'include' })
      if (res.ok) setLibraryItems(await res.json())
    } catch {}
    setShowMediaPicker(true)
  }

  function selectFromLibrary(item) {
    const mType = item.media_type || 'image'
    // If switching types, clear first
    if (mediaType && mediaType !== mType) {
      setMediaItems([])
      setMediaIds([])
    }
    if (mType !== 'image' && mediaItems.length > 0) {
      addToast(`Only 1 ${mType} per post`, 'error')
      return
    }
    if (mType === 'image' && mediaItems.length >= 9) {
      addToast('Maximum 9 images per post', 'error')
      return
    }
    const newItem = {
      id: item.id,
      url: `/api/media/${item.id}/file`,
      media_type: mType,
      original_filename: item.original_filename || '',
      duration: item.duration,
      mime_type: item.mime_type || '',
    }
    setMediaType(mType)
    setMediaItems(prev => [...prev, newItem])
    setMediaIds(prev => [...prev, item.id])
    setShowMediaPicker(false)
    addToast('Media attached')
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
        media_ids: mediaIds.length > 0 ? mediaIds : undefined,
        // Backward compat: if single image, also send image_id
        image_id: (mediaItems.length === 1 && mediaType === 'image') ? mediaItems[0].id : undefined,
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
        setPostStatus(status)
        addToast(status === 'scheduled' ? 'Post scheduled!' : 'Draft saved!')
        if (!id) {
          navigate(`/compose/${saved.id}`, { replace: true })
        }
      } else {
        addToast('Failed to save post', 'error')
      }
    } catch (err) {
      console.error('Failed to save post:', err)
      addToast('Failed to save post', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function publishNow() {
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
        setPostStatus('published')
        addToast('Post published successfully!')
        await loadPost(postId)
      } else {
        const err = await res.json()
        addToast(err.detail || 'Publishing failed', 'error')
      }
    } catch (err) {
      console.error('Publish failed:', err)
      addToast('Publishing failed', 'error')
    } finally {
      setPublishing(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        savePost('draft')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [content, title, firstComment, timezone, mediaIds])

  async function generateCaption() {
    setAiGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topic: aiTopic, tone: aiTone }),
      })
      if (res.ok) {
        const data = await res.json()
        setContent(`<p>${data.caption.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
        setShowAiModal(false)
        setAiTopic('')
        addToast('Caption generated!')
      }
    } catch (err) {
      console.error('AI generation failed:', err)
      addToast('Generation failed', 'error')
    } finally {
      setAiGenerating(false)
    }
  }

  const charCount = plainText.length
  const isNearLimit = charCount > 2700
  const isOverLimit = charCount >= 3000

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
          <Eye size={28} className="text-white/40" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Post not found</h2>
        <p className="text-sm text-white/50 mb-6">This post may have been deleted or doesn't exist.</p>
        <Button variant="outline" onClick={() => navigate('/app')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {id ? 'Edit Post' : 'New Post'}
            </h1>
            {id && (
              <span className={cn(
                'text-xs font-medium',
                postStatus === 'published' && 'text-emerald-600 dark:text-emerald-400',
                postStatus === 'scheduled' && 'text-purple-600 dark:text-purple-400',
                postStatus === 'failed' && 'text-destructive',
                postStatus === 'draft' && 'text-muted-foreground',
              )}>
                {postStatus.charAt(0).toUpperCase() + postStatus.slice(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Editor column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Title */}
          <Input
            type="text"
            placeholder="Post title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl"
          />

          {/* Rich text editor */}
          <TipTapEditor
            content={content}
            onChange={(html, text) => {
              setContent(html)
              setPlainText(text)
            }}
          />

          {/* Media attachment */}
          <Card>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 mb-3">
                <ImagePlus size={15} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media</span>
              </div>

              {/* Media type selector buttons */}
              <div className="flex items-center gap-2 mb-3">
                {[
                  { type: 'image', icon: ImagePlus, label: 'Image', accept: 'image/jpeg,image/png,image/gif', multiple: true },
                  { type: 'video', icon: Video, label: 'Video', accept: 'video/mp4,video/webm,video/quicktime', multiple: false },
                  { type: 'document', icon: FileText, label: 'Document', accept: '.pdf,.pptx', multiple: false },
                ].map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant={mediaType === type ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => switchMediaType(type)}
                    className={cn(
                      'transition-all',
                      mediaType === type && 'bg-purple-600/20 text-purple-400 border-purple-500/30 hover:bg-purple-600/30'
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </Button>
                ))}
                {mediaItems.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllMedia} className="text-muted-foreground hover:text-destructive">
                    <X size={14} />
                    Clear
                  </Button>
                )}
              </div>

              {/* Upload area — shown when a type is selected */}
              {mediaType && mediaItems.length === 0 && !uploading && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="border-dashed"
                  >
                    <ImagePlus size={15} />
                    Upload {mediaType === 'image' ? 'Image(s)' : mediaType === 'video' ? 'Video' : 'Document'}
                  </Button>
                  <Button variant="outline" onClick={openMediaPicker}>
                    <FolderOpen size={15} />
                    Library
                  </Button>
                </div>
              )}

              {/* Upload progress bar (video) */}
              {uploading && mediaType === 'video' && uploadProgress > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    <span className="text-xs text-muted-foreground">Uploading video... {uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Generic uploading state */}
              {uploading && !(mediaType === 'video' && uploadProgress > 0) && (
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 size={14} className="animate-spin text-purple-400" />
                  <span className="text-xs text-muted-foreground">
                    Uploading{mediaType === 'document' ? ' (converting if PPTX)...' : '...'}
                  </span>
                </div>
              )}

              {/* Image thumbnails strip */}
              {mediaType === 'image' && mediaItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {mediaItems.map(item => (
                      <div key={item.id} className="relative group">
                        <img
                          src={item.url}
                          alt="Attached"
                          className="h-20 w-20 rounded-lg border border-border object-cover shadow-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeMediaItem(item.id)}
                          className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full shadow-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all"
                        >
                          <X size={10} />
                        </Button>
                      </div>
                    ))}
                    {mediaItems.length < 9 && !uploading && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-white/30 hover:border-purple-500/30 hover:text-purple-400 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{mediaItems.length}/9 images</p>
                </div>
              )}

              {/* Video preview */}
              {mediaType === 'video' && mediaItems.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    <Play size={18} className="text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{mediaItems[0].original_filename || 'Video'}</p>
                    {mediaItems[0].duration && (
                      <p className="text-xs text-muted-foreground">Duration: {formatDuration(mediaItems[0].duration)}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMediaItem(mediaItems[0].id)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </Button>
                </div>
              )}

              {/* Document preview */}
              {mediaType === 'document' && mediaItems.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText size={18} className="text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{mediaItems[0].original_filename || 'Document'}</p>
                    <p className="text-xs text-muted-foreground">
                      {mediaItems[0].mime_type === 'application/pdf' ? 'PDF Carousel' : 'Document'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMediaItem(mediaItems[0].id)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </Button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept={
                  mediaType === 'video' ? 'video/mp4,video/webm,video/quicktime' :
                  mediaType === 'document' ? '.pdf,.pptx' :
                  'image/jpeg,image/png,image/gif'
                }
                multiple={mediaType === 'image'}
                onChange={handleMediaUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* First Comment Section */}
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFirstComment(!showFirstComment)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={15} />
                <span>First Comment</span>
                {firstComment && <Check size={14} className="text-emerald-500" />}
              </div>
              {showFirstComment ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showFirstComment && (
              <CardContent className="pt-0 pb-4 animate-fade-in">
                <Textarea
                  placeholder="Write a comment to be auto-posted after your main post..."
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            )}
          </Card>

          {/* Schedule Section */}
          {showSchedule && (
            <Card className="border-purple-200 dark:border-purple-800 animate-fade-in-up">
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={15} className="text-purple-500 dark:text-purple-400" />
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Schedule</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full">
                      <Globe size={14} className="text-muted-foreground mr-1.5" />
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Intl.supportedValuesOf('timeZone').map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <Separator />
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => savePost('draft')}
              disabled={saving}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>

            <div className="flex items-center gap-2">
              {!showSchedule ? (
                <Button
                  onClick={() => setShowSchedule(true)}
                >
                  <Calendar size={15} />
                  Schedule
                </Button>
              ) : (
                <Button
                  onClick={() => savePost('scheduled')}
                  disabled={saving || !scheduledDate || !scheduledTime}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {saving ? 'Scheduling...' : 'Schedule Post'}
                </Button>
              )}
              <Separator orientation="vertical" className="h-5" />
              <Button
                onClick={publishNow}
                disabled={publishing || saving}
                className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md hover:shadow-emerald-500/15"
              >
                {publishing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                {publishing ? 'Publishing...' : 'Publish Now'}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Cmd+Enter</kbd> to quick-save as draft
          </p>
        </div>

        {/* Preview column */}
        <div className="hidden xl:block w-[380px] shrink-0 sticky top-24">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-muted-foreground" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  LinkedIn Preview
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent>
              {/* Author info */}
              <div className="flex items-center gap-3 mb-3">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-semibold">
                      {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground">{user?.name || 'Your Name'}</div>
                  <div className="text-xs text-muted-foreground">Just now</div>
                </div>
              </div>

              {/* Post content */}
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-3 max-h-[300px] overflow-y-auto">
                {plainText || <span className="text-muted-foreground/50 italic">Your post content will appear here...</span>}
              </div>

              {/* Media preview */}
              {mediaType === 'image' && mediaItems.length === 1 && (
                <div className="rounded-lg overflow-hidden border border-border mb-3 -mx-1">
                  <img src={mediaItems[0].url} alt="" className="w-full object-contain" />
                </div>
              )}
              {mediaType === 'image' && mediaItems.length > 1 && (
                <div className={cn(
                  'grid gap-1 rounded-lg overflow-hidden border border-border mb-3 -mx-1',
                  mediaItems.length === 2 && 'grid-cols-2',
                  mediaItems.length >= 3 && 'grid-cols-3',
                )}>
                  {mediaItems.slice(0, 9).map(item => (
                    <img key={item.id} src={item.url} alt="" className="w-full aspect-square object-cover" />
                  ))}
                </div>
              )}
              {mediaType === 'video' && mediaItems.length > 0 && (
                <div className="rounded-lg overflow-hidden border border-border mb-3 -mx-1 bg-black/40 flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/10 mb-2">
                      <Play size={24} className="text-white/70 ml-0.5" />
                    </div>
                    <p className="text-xs text-muted-foreground">Video attached</p>
                    {mediaItems[0].duration && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDuration(mediaItems[0].duration)}</p>
                    )}
                  </div>
                </div>
              )}
              {mediaType === 'document' && mediaItems.length > 0 && (
                <div className="rounded-lg border border-border mb-3 -mx-1 bg-blue-500/5 flex items-center gap-2 px-3 py-3">
                  <FileText size={18} className="text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Carousel</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {mediaItems[0].mime_type === 'application/pdf' ? 'PDF' : 'Document'}
                    </p>
                  </div>
                </div>
              )}

              {/* Engagement bar */}
              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Like</span>
                <span className="text-xs text-muted-foreground">Comment</span>
                <span className="text-xs text-muted-foreground">Repost</span>
                <span className="text-xs text-muted-foreground">Send</span>
              </div>

              {/* First comment preview */}
              {firstComment && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                      </span>
                    </div>
                    <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground flex-1">
                      {firstComment}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Character count */}
            <CardContent className={cn(
              'border-t border-border text-xs text-right py-2.5',
              isOverLimit ? 'text-destructive bg-destructive/10 font-semibold' :
              isNearLimit ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 font-medium' :
              'text-muted-foreground'
            )}>
              {charCount.toLocaleString()} / 3,000 characters
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Media Picker Modal */}
      <Dialog open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Select from Media Library</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {libraryItems.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No media in library</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {libraryItems.map(item => {
                  const mType = item.media_type || 'image'
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectFromLibrary(item)}
                      className="group relative aspect-square rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all hover:shadow-md"
                    >
                      {mType === 'image' ? (
                        <img src={`/api/media/${item.id}/file`} alt={item.original_filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : mType === 'video' ? (
                        <div className="w-full h-full bg-black/40 flex items-center justify-center">
                          <Play size={28} className="text-white/60" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-blue-500/5 flex flex-col items-center justify-center gap-1">
                          <FileText size={28} className="text-blue-400/60" />
                          <span className="text-[10px] text-muted-foreground truncate px-2 max-w-full">{item.original_filename}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Assist Modal */}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 -m-4 mb-0 p-4 rounded-t-xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <DialogTitle>AI Caption Assistant</DialogTitle>
                <DialogDescription>Powered by Claude</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Topic / Idea
              </Label>
              <Textarea
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                placeholder="Describe what you want to post about..."
                rows={3}
                className="resize-none focus-visible:border-purple-400 focus-visible:ring-purple-200 dark:focus-visible:ring-purple-800"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tone
              </Label>
              <div className="flex gap-2">
                {[
                  { value: 'professional', label: 'Professional', emoji: '\uD83D\uDCBC' },
                  { value: 'casual', label: 'Casual', emoji: '\uD83D\uDE42' },
                  { value: 'storytelling', label: 'Story', emoji: '\uD83D\uDCD6' },
                ].map(tone => (
                  <Button
                    key={tone.value}
                    variant={aiTone === tone.value ? 'secondary' : 'ghost'}
                    onClick={() => setAiTone(tone.value)}
                    className={cn(
                      'flex-1',
                      aiTone === tone.value && 'bg-purple-50 text-purple-700 border-2 border-purple-200 shadow-sm dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800'
                    )}
                  >
                    <span>{tone.emoji}</span>
                    {tone.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              onClick={generateCaption}
              disabled={!aiTopic.trim() || aiGenerating}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98]"
            >
              {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {aiGenerating ? 'Generating...' : 'Generate Caption'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
