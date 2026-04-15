import {
  ImagePlus, Video, FileText, X, Plus, Play, FolderOpen, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TYPE_CONFIG = [
  { type: 'image', icon: ImagePlus, label: 'Image' },
  { type: 'video', icon: Video, label: 'Video' },
  { type: 'document', icon: FileText, label: 'Document' },
]

const ACCEPT = {
  image: 'image/jpeg,image/png,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  document: '.pdf,.pptx',
}

export default function MediaSection({
  mediaType,
  mediaItems,
  uploading,
  uploadProgress,
  fileRef,
  switchMediaType,
  clearAllMedia,
  removeMediaItem,
  handleMediaUpload,
  onOpenPicker,
  formatDuration,
}) {
  const first = mediaItems[0]

  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3">
          <ImagePlus size={15} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {TYPE_CONFIG.map(({ type, icon: Icon, label }) => (
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

        {mediaType && mediaItems.length === 0 && !uploading && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-dashed">
              <ImagePlus size={15} />
              Upload {mediaType === 'image' ? 'Image(s)' : mediaType === 'video' ? 'Video' : 'Document'}
            </Button>
            <Button variant="outline" onClick={onOpenPicker}>
              <FolderOpen size={15} />
              Library
            </Button>
          </div>
        )}

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

        {uploading && !(mediaType === 'video' && uploadProgress > 0) && (
          <div className="flex items-center gap-2 mb-3">
            <Loader2 size={14} className="animate-spin text-purple-400" />
            <span className="text-xs text-muted-foreground">
              Uploading{mediaType === 'document' ? ' (converting if PPTX)...' : '...'}
            </span>
          </div>
        )}

        {mediaType === 'image' && mediaItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {mediaItems.map(item => (
                <div key={item.id} className="relative group">
                  <img src={item.url} alt="Attached" className="h-20 w-20 rounded-lg border border-border object-cover shadow-sm" />
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

        {mediaType === 'video' && first && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <Play size={18} className="text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{first.original_filename || 'Video'}</p>
              {first.duration && (
                <p className="text-xs text-muted-foreground">Duration: {formatDuration(first.duration)}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeMediaItem(first.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X size={14} />
            </Button>
          </div>
        )}

        {mediaType === 'document' && first && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <FileText size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{first.original_filename || 'Document'}</p>
              <p className="text-xs text-muted-foreground">
                {first.mime_type === 'application/pdf' ? 'PDF Carousel' : 'Document'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeMediaItem(first.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X size={14} />
            </Button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT[mediaType] || ACCEPT.image}
          multiple={mediaType === 'image'}
          onChange={handleMediaUpload}
          className="hidden"
        />
      </CardContent>
    </Card>
  )
}
