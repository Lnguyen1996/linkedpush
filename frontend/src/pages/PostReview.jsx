import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  Send,
  ThumbsUp,
  Repeat2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import PdfThumbnail from '@/components/PdfThumbnail'

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-white/10 text-slate-300 border-white/10', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/15 text-blue-300 border-blue-400/20', icon: Clock },
  publishing: { label: 'Publishing', color: 'bg-amber-500/15 text-amber-300 border-amber-400/20', icon: Clock },
  published: { label: 'Published', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-500/15 text-red-300 border-red-400/20', icon: XCircle },
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTime(iso) {
  if (!iso) return 'Just now'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

function stripHtmlToText(html) {
  if (!html) return ''
  if (!html.includes('<p>') && !html.includes('<br')) return html
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function UserAvatar({ user, size = 48 }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || ''}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="flex items-center justify-center rounded-full bg-purple/20 text-sm font-semibold text-purple"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

export default function PostReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Post not found')
        return res.json()
      })
      .then(setPost)
      .catch(() => {
        showToast('Post not found', 'error')
        navigate('/app')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handlePublish() {
    setPublishing(true)
    try {
      const res = await fetch(`/api/posts/${id}/publish`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Post published successfully!', 'success')
        setPost(prev => ({ ...prev, status: 'published', published_at: new Date().toISOString() }))
      } else {
        showToast(data.detail || 'Publishing failed', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48 bg-white/10" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/10" />
      </div>
    )
  }

  if (!post) return null

  const cfg = statusConfig[post.status] || statusConfig.draft
  const StatusIcon = cfg.icon
  const canPublish = post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed'

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => navigate('/app')}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2">
          <Link to={`/app/compose/${post.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white">
              <Edit3 size={14} />
              Edit
            </Button>
          </Link>
          {canPublish && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="gap-1.5 bg-purple text-white hover:bg-purple-dark"
            >
              <Send size={14} />
              {publishing ? 'Publishing...' : 'Publish Now'}
            </Button>
          )}
        </div>
      </div>

      {/* Status + Meta bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171717] px-5 py-3">
        <Badge className={cn('gap-1.5 border px-2.5 py-1 text-xs font-semibold', cfg.color)}>
          <StatusIcon size={13} />
          {cfg.label}
        </Badge>
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span>Created {formatDate(post.created_at)}</span>
          {post.scheduled_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {formatDate(post.scheduled_at)}
            </span>
          )}
          {post.published_at && (
            <span className="text-emerald-400">Published {formatDate(post.published_at)}</span>
          )}
        </div>
        {post.error_message && (
          <div className="mt-2 w-full rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {post.error_message}
          </div>
        )}
      </div>

      {/* ===== LinkedIn Post Preview ===== */}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#1B1F23]">
        {/* Post header label */}
        <div className="border-b border-white/[0.06] px-5 py-3">
          <p className="text-sm font-medium text-white/60">Post Preview</p>
        </div>

        {/* LinkedIn post card */}
        <div className="px-5 pt-4 pb-0">
          {/* Profile header */}
          <div className="mb-3 flex items-start gap-3">
            <UserAvatar user={user} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">{user?.name || 'You'}</p>
              <p className="text-xs text-white/50">{user?.email || 'LinkedIn User'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                <span>{formatRelativeTime(post.created_at)}</span>
                <span>·</span>
                <Globe size={11} />
              </p>
            </div>
          </div>

          {/* Post content */}
          <div className="text-[14px] leading-[1.6] text-white/90 whitespace-pre-wrap break-words">
            {stripHtmlToText(post.content) || <span className="text-white/40 italic">No content</span>}
          </div>
        </div>

        {/* Attached media — full bleed, no padding */}
        {(() => {
          const firstMedia = Array.isArray(post.media) && post.media.length > 0 ? post.media[0] : null
          const mType = firstMedia?.media_type
          if (mType === 'document') {
            return (
              <div className="mt-3 relative bg-black">
                <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
                  <PdfThumbnail
                    src={firstMedia.url}
                    width={640}
                    className="absolute inset-0 w-full h-full object-contain bg-white"
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
                        <FileText size={40} className="text-blue-400" />
                      </div>
                    }
                  />
                  <div className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                    Carousel
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3">
                    <p className="text-sm font-medium text-white truncate">
                      {firstMedia.original_filename || 'Document'}
                    </p>
                    <p className="text-[11px] text-white/70">
                      {firstMedia.mime_type === 'application/pdf' ? 'PDF' : 'Document'} · Swipe to view
                    </p>
                  </div>
                </div>
              </div>
            )
          }
          if (mType === 'image') {
            return (
              <div className="mt-3">
                <img src={firstMedia.url} alt="Post attachment" className="w-full" />
              </div>
            )
          }
          if (post.image_url) {
            return (
              <div className="mt-3">
                <img src={post.image_url} alt="Post attachment" className="w-full" />
              </div>
            )
          }
          return null
        })()}

        {/* Engagement bar */}
        <div className="px-5">
          <div className="flex items-center justify-between border-b border-white/[0.06] py-2.5 text-xs text-white/40">
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                <ThumbsUp size={9} className="text-white" />
              </span>
              <span>0</span>
            </div>
            <span>0 comments · 0 reposts</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-around py-1">
            {[
              { icon: ThumbsUp, label: 'Like' },
              { icon: MessageSquare, label: 'Comment' },
              { icon: Repeat2, label: 'Repost' },
              { icon: Send, label: 'Send' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* First comment — threaded reply */}
        {post.first_comment && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="flex items-start gap-3">
              <UserAvatar user={user} size={36} />
              <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white">{user?.name || 'You'}</span>
                  <span className="text-xs text-white/40">· 1st</span>
                </div>
                <p className="text-[13px] leading-relaxed text-white/75 whitespace-pre-wrap break-words">
                  {post.first_comment}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn link (if published) */}
      {post.status === 'published' && post.linkedin_post_id && (
        <div className="mt-4 text-center">
          <a
            href={`https://www.linkedin.com/feed/update/${post.linkedin_post_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple transition-colors hover:text-purple-light"
          >
            <ExternalLink size={14} />
            View on LinkedIn
          </a>
        </div>
      )}
    </div>
  )
}
