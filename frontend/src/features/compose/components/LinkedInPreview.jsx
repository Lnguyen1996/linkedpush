import { Eye, Play, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'
  const first = mediaItems?.[0]

  return (
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
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-semibold">{initials}</span>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-foreground">{user?.name || 'Your Name'}</div>
              <div className="text-xs text-muted-foreground">Just now</div>
            </div>
          </div>

          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-3 max-h-[300px] overflow-y-auto">
            {plainText || <span className="text-muted-foreground/50 italic">Your post content will appear here...</span>}
          </div>

          {mediaType === 'image' && mediaItems.length === 1 && (
            <div className="rounded-lg overflow-hidden border border-border mb-3 -mx-1">
              <img src={first.url} alt="" className="w-full object-contain" />
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
          {mediaType === 'video' && first && (
            <div className="rounded-lg overflow-hidden border border-border mb-3 -mx-1 bg-black/40 flex items-center justify-center py-8">
              <div className="text-center">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/10 mb-2">
                  <Play size={24} className="text-white/70 ml-0.5" />
                </div>
                <p className="text-xs text-muted-foreground">Video attached</p>
                {first.duration && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDuration(first.duration)}</p>
                )}
              </div>
            </div>
          )}
          {mediaType === 'document' && first && (
            <div className="rounded-lg overflow-hidden border border-border mb-3 -mx-1 bg-black relative group">
              <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
                <object
                  data={`${first.url}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                  type="application/pdf"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
                    <FileText size={32} className="text-blue-400" />
                  </div>
                </object>
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

          <div className="flex items-center gap-4 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Like</span>
            <span className="text-xs text-muted-foreground">Comment</span>
            <span className="text-xs text-muted-foreground">Repost</span>
            <span className="text-xs text-muted-foreground">Send</span>
          </div>

          {firstComment && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">{initials}</span>
                </div>
                <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground flex-1">
                  {firstComment}
                </div>
              </div>
            </div>
          )}
        </CardContent>

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
  )
}
