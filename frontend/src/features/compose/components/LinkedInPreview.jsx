import { useState } from 'react'
import { Eye, Play, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getProfileAvatarSrc } from '@/lib/avatar'
import PdfThumbnail from '@/components/PdfThumbnail'
import MediaLightbox from '@/components/MediaLightbox'

export default function LinkedInPreview({
  user,
  plainText,
  mediaType,
  mediaItems,
  firstComment,
  charCount,
  isNearLimit,
  isOverLimit,
  formatDuration,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'
  const first = mediaItems?.[0]
  const avatarSrc = getProfileAvatarSrc(user)

  return (
    <div className="hidden xl:block w-[380px] shrink-0 sticky top-24">
      <Card className="shadow-sm">
        <CardHeader className="border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-white/55" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-white/55">
              LinkedIn Preview
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple flex items-center justify-center">
                <span className="text-white text-sm font-semibold">{initials}</span>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-white">{user?.name || 'Your Name'}</div>
              <div className="text-xs text-white/55">Just now</div>
            </div>
          </div>

          <div className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words mb-3 max-h-[300px] overflow-y-auto">
            {plainText || <span className="text-white/40 italic">Your post content will appear here...</span>}
          </div>

          {mediaType === 'image' && mediaItems.length === 1 && (
            <div className="rounded-lg overflow-hidden border border-white/10 mb-3 -mx-1 cursor-zoom-in" onClick={() => setLightboxIndex(0)}>
              <img src={first.url} alt="" className="w-full object-contain" />
            </div>
          )}
          {mediaType === 'image' && mediaItems.length > 1 && (
            <div className={cn(
              'grid gap-1 rounded-lg overflow-hidden border border-white/10 mb-3 -mx-1 cursor-zoom-in',
              mediaItems.length === 2 && 'grid-cols-2',
              mediaItems.length >= 3 && 'grid-cols-3',
            )}
              onClick={() => setLightboxIndex(0)}>
              {mediaItems.slice(0, 9).map(item => (
                <img key={item.id} src={item.url} alt="" className="w-full aspect-square object-cover" />
              ))}
            </div>
          )}
          {mediaType === 'video' && first && (
            <div className="rounded-lg overflow-hidden border border-white/10 mb-3 -mx-1 bg-black/40 flex items-center justify-center py-8">
              <div className="text-center">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/10 mb-2">
                  <Play size={24} className="text-white/70 ml-0.5" />
                </div>
                <p className="text-xs text-white/55">Video attached</p>
                {first.duration && (
                  <p className="text-[10px] text-white/55 mt-0.5">{formatDuration(first.duration)}</p>
                )}
              </div>
            </div>
          )}
          {mediaType === 'document' && first && (
            <div className="rounded-lg overflow-hidden border border-white/10 mb-3 -mx-1 bg-black relative group">
              <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
                <PdfThumbnail
                  src={first.url}
                  width={480}
                  className="absolute inset-0 w-full h-full object-contain bg-white"
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
                      <FileText size={32} className="text-blue-400" />
                    </div>
                  }
                />
                <div className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                  Carousel
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2">
                  <p className="text-xs font-medium text-white truncate">{first.original_filename || 'Document'}</p>
                  <p className="text-[10px] text-white/70">
                    {first.mime_type === 'application/pdf' ? 'PDF' : 'Document'} · Swipe to view
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-3 border-t border-white/10">
            <span className="text-xs text-white/55">Like</span>
            <span className="text-xs text-white/55">Comment</span>
            <span className="text-xs text-white/55">Repost</span>
            <span className="text-xs text-white/55">Send</span>
          </div>

          {firstComment && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-semibold text-white/55">{initials}</span>
                </div>
                <div className="bg-white/[0.04] rounded-xl px-3 py-2 text-xs text-white/55 flex-1">
                  {firstComment}
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardContent className={cn(
          'border-t border-white/10 text-xs text-right py-2.5',
          isOverLimit ? 'text-rose-300 font-semibold' :
          isNearLimit ? 'text-amber-300 font-medium' :
          'text-white/55'
        )}>
          {charCount.toLocaleString()} / 3,000 characters
        </CardContent>
      </Card>

      {lightboxIndex !== null && (
        <MediaLightbox
          items={mediaItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
