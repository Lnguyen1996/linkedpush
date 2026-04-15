import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Eye } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import LinkedInPreview from '@/features/compose/components/LinkedInPreview'
import MediaPickerModal from '@/features/compose/components/MediaPickerModal'
import AiComposeModal from '@/features/compose/components/AiComposeModal'
import ActionBar from '@/features/compose/components/ActionBar'
import MediaSection from '@/features/compose/components/MediaSection'
import PostEditor from '@/features/compose/components/PostEditor'
import FirstCommentSection from '@/features/compose/components/FirstCommentSection'
import ScheduleSection from '@/features/compose/components/ScheduleSection'
import useMediaAttachment from '@/features/compose/hooks/useMediaAttachment'
import usePostDraft from '@/features/compose/hooks/usePostDraft'
import useScheduleFields from '@/features/compose/hooks/useScheduleFields'

function formatDuration(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Compose() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { user } = useAuth()

  const draft = usePostDraft()
  const schedule = useScheduleFields()
  const media = useMediaAttachment({ addToast })

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [libraryItems, setLibraryItems] = useState([])
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiTone, setAiTone] = useState('professional')
  const [aiGenerating, setAiGenerating] = useState(false)

  useEffect(() => {
    if (id) loadPost(id)
  }, [id])

  useEffect(() => {
    if (id) return
    const dateParam = searchParams.get('date')
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return
    schedule.applyDateParam(dateParam)
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
      const post = await res.json()
      draft.hydrateFromPost(post)
      schedule.hydrateFromPost(post)
      media.hydrateFromPost(post)
    } catch (err) {
      console.error('Failed to load post:', err)
    } finally {
      setLoading(false)
    }
  }

  async function openMediaPicker() {
    try {
      const res = await fetch('/api/media', { credentials: 'include' })
      if (res.ok) setLibraryItems(await res.json())
    } catch {}
    setShowMediaPicker(true)
  }

  function selectFromLibrary(item) {
    if (media.tryAddFromLibrary(item)) setShowMediaPicker(false)
  }

  async function savePost(status) {
    setSaving(true)
    try {
      const { mediaIds, mediaItems, mediaType } = media
      const body = {
        title: draft.title || null,
        content: draft.content,
        status,
        first_comment: draft.firstComment || null,
        timezone: schedule.timezone,
        media_ids: mediaIds.length > 0 ? mediaIds : undefined,
        image_id: (mediaItems.length === 1 && mediaType === 'image') ? mediaItems[0].id : undefined,
      }

      const scheduledAt = status === 'scheduled' ? schedule.toScheduledAtString() : null
      if (scheduledAt) body.scheduled_at = scheduledAt

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
        draft.setPostStatus(status)
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
        draft.setPostStatus('published')
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
  }, [draft.content, draft.title, draft.firstComment, schedule.timezone, media.mediaIds])

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
        draft.setContent(`<p>${data.caption.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
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

  const charCount = draft.plainText.length
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
                draft.postStatus === 'published' && 'text-emerald-600 dark:text-emerald-400',
                draft.postStatus === 'scheduled' && 'text-purple-600 dark:text-purple-400',
                draft.postStatus === 'failed' && 'text-destructive',
                draft.postStatus === 'draft' && 'text-muted-foreground',
              )}>
                {draft.postStatus.charAt(0).toUpperCase() + draft.postStatus.slice(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <PostEditor
            title={draft.title}
            setTitle={draft.setTitle}
            content={draft.content}
            onContentChange={draft.onContentChange}
          />

          <MediaSection
            mediaType={media.mediaType}
            mediaItems={media.mediaItems}
            uploading={media.uploading}
            uploadProgress={media.uploadProgress}
            fileRef={media.fileRef}
            switchMediaType={media.switchMediaType}
            clearAllMedia={media.clearAllMedia}
            removeMediaItem={media.removeMediaItem}
            handleMediaUpload={media.handleMediaUpload}
            onOpenPicker={openMediaPicker}
            formatDuration={formatDuration}
          />

          <FirstCommentSection
            firstComment={draft.firstComment}
            setFirstComment={draft.setFirstComment}
            open={draft.showFirstComment}
            setOpen={draft.setShowFirstComment}
          />

          {schedule.showSchedule && (
            <ScheduleSection
              scheduledDate={schedule.scheduledDate}
              setScheduledDate={schedule.setScheduledDate}
              scheduledTime={schedule.scheduledTime}
              setScheduledTime={schedule.setScheduledTime}
              timezone={schedule.timezone}
              setTimezone={schedule.setTimezone}
            />
          )}

          <ActionBar
            saving={saving}
            publishing={publishing}
            showSchedule={schedule.showSchedule}
            scheduledDate={schedule.scheduledDate}
            scheduledTime={schedule.scheduledTime}
            onSaveDraft={() => savePost('draft')}
            onShowSchedule={() => schedule.setShowSchedule(true)}
            onSchedule={() => savePost('scheduled')}
            onPublish={publishNow}
          />
        </div>

        <LinkedInPreview
          user={user}
          plainText={draft.plainText}
          mediaType={media.mediaType}
          mediaItems={media.mediaItems}
          firstComment={draft.firstComment}
          charCount={charCount}
          isNearLimit={isNearLimit}
          isOverLimit={isOverLimit}
          formatDuration={formatDuration}
        />
      </div>

      <MediaPickerModal
        open={showMediaPicker}
        onOpenChange={setShowMediaPicker}
        libraryItems={libraryItems}
        onSelect={selectFromLibrary}
      />

      <AiComposeModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
        topic={aiTopic}
        setTopic={setAiTopic}
        tone={aiTone}
        setTone={setAiTone}
        onGenerate={generateCaption}
        generating={aiGenerating}
      />
    </div>
  )
}
