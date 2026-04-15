import { useState, useEffect, useRef } from 'react'
import { Image, Upload, X, Trash2, FileImage, Calendar, HardDrive, Loader2, Check, Copy, Play, Video, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog'
import MediaPreviewEditor from '@/components/MediaPreviewEditor'
import PdfThumbnail from '@/components/PdfThumbnail'

export default function MediaLibrary() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mediaFilter, setMediaFilter] = useState('all')
  const fileRef = useRef(null)

  function formatDuration(seconds) {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  useEffect(() => {
    loadMedia()
  }, [])

  async function loadMedia() {
    setLoading(true)
    try {
      const res = await fetch('/api/media', { credentials: 'include' })
      if (res.ok) {
        setItems(await res.json())
      }
    } catch (err) {
      console.error('Failed to load media:', err)
    } finally {
      setLoading(false)
    }
  }

  async function uploadFiles(files) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
      }
      await loadMedia()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (files) uploadFiles(files)
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/media/${id}`, { method: 'DELETE', credentials: 'include' })
      setItems(items.filter(i => i.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredItems = mediaFilter === 'all'
    ? items
    : items.filter(i => (i.media_type || 'image') === mediaFilter)

  const totalSize = items.reduce((sum, i) => sum + (i.file_size || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'file' : 'files'} &middot; {formatSize(totalSize)} total
          </p>
        </div>
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.pptx"
          multiple
          onChange={(e) => uploadFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 w-fit">
        {[
          { value: 'all', label: 'All' },
          { value: 'image', label: 'Images', icon: Image },
          { value: 'video', label: 'Videos', icon: Video },
          { value: 'document', label: 'Documents', icon: FileText },
        ].map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMediaFilter(tab.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mediaFilter === tab.value
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/70'
            )}
          >
            {tab.icon && <tab.icon size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'transition-all duration-200',
              dragOver && 'ring-2 ring-primary ring-offset-4 rounded-2xl'
            )}
          >
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <Card
                className="border-2 border-dashed hover:border-primary/30 transition-colors cursor-pointer p-16 text-center"
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-purple/5 dark:bg-purple/10 flex items-center justify-center mx-auto mb-5">
                  <FileImage size={28} className="text-purple/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No media yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                  Drop files here or click to upload. Supports images (JPEG, PNG, GIF), videos (MP4, WebM, MOV), and documents (PDF, PPTX).
                </p>
                <Button variant="secondary" size="sm">
                  <Upload size={15} />
                  Choose files
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 stagger-children">
                {filteredItems.map(item => {
                  const mType = item.media_type || 'image'
                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        'group relative overflow-hidden cursor-pointer border-2 transition-all duration-200 hover:shadow-lg p-0',
                        selected?.id === item.id
                          ? 'border-primary shadow-md ring-2 ring-primary/20'
                          : 'border-border hover:border-foreground/20'
                      )}
                      onClick={() => { setSelected(item); setPreview(item) }}
                    >
                      <div className="bg-white/5 flex items-center justify-center" style={{ minHeight: 200 }}>
                        {mType === 'image' && (
                          <img
                            src={`/api/media/${item.id}/file?v=${item.file_size ?? 0}`}
                            alt={item.original_filename}
                            className="w-full h-auto max-h-80 object-contain group-hover:scale-[1.02] transition-transform duration-300"
                            style={{ imageRendering: '-webkit-optimize-contrast' }}
                          />
                        )}
                        {mType === 'video' && (
                          <div className="relative w-full h-48 flex items-center justify-center bg-black/30">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                              <Play size={28} className="text-white/80 ml-1" />
                            </div>
                            {item.duration && (
                              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                                {formatDuration(item.duration)}
                              </div>
                            )}
                          </div>
                        )}
                        {mType === 'document' && (
                          <div className="w-full h-48 bg-blue-500/5 relative overflow-hidden">
                            <PdfThumbnail
                              src={`/api/media/${item.id}/file`}
                              width={200}
                              className="w-full h-full object-contain"
                              fallback={
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                  <FileText size={40} className="text-blue-400/60" />
                                  <span className="text-xs text-muted-foreground truncate max-w-[80%] px-2">{item.original_filename}</span>
                                </div>
                              }
                            />
                          </div>
                        )}
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="text-white text-[11px] font-medium truncate">{item.original_filename}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{formatSize(item.file_size)}</Badge>
                          {mType !== 'image' && (
                            <Badge variant="outline" className="text-[10px] capitalize">{mType}</Badge>
                          )}
                        </div>
                      </div>
                      {/* Selected check */}
                      {selected?.id === item.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                          <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel (desktop sidebar) */}
        {selected && (
          <div className="w-96 shrink-0 hidden lg:block animate-fade-in-up">
            <Card className="sticky top-24 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between border-b">
                <CardTitle className="text-sm">Details</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelected(null)}
                >
                  <X size={14} />
                </Button>
              </CardHeader>

              <CardContent className="pt-4">
                {/* Preview — type-aware */}
                {(selected.media_type || 'image') === 'image' && (
                  <a href={`/api/media/${selected.id}/file?v=${selected.file_size ?? 0}`} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={`/api/media/${selected.id}/file?v=${selected.file_size ?? 0}`}
                      alt={selected.original_filename}
                      className="w-full rounded-xl border border-border mb-4 cursor-zoom-in hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
                {(selected.media_type) === 'video' && (
                  <video
                    src={`/api/media/${selected.id}/file`}
                    controls
                    className="w-full rounded-xl border border-border mb-4"
                  />
                )}
                {(selected.media_type) === 'document' && (
                  <div className="w-full h-64 rounded-xl border border-border mb-4 bg-blue-500/5 overflow-hidden">
                    <PdfThumbnail
                      src={`/api/media/${selected.id}/file`}
                      width={480}
                      className="w-full h-full object-contain"
                      fallback={
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <FileText size={40} className="text-blue-400/60" />
                          <span className="text-xs text-muted-foreground">PDF Document</span>
                        </div>
                      }
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="space-y-3">
                  <MetaRow icon={FileImage} label="Filename" value={selected.original_filename} />
                  <MetaRow icon={HardDrive} label="Size" value={formatSize(selected.file_size)} />
                  {selected.media_type && selected.media_type !== 'image' && (
                    <MetaRow icon={selected.media_type === 'video' ? Video : FileText} label="Type" value={selected.media_type.charAt(0).toUpperCase() + selected.media_type.slice(1)} />
                  )}
                  {selected.duration && (
                    <MetaRow icon={Play} label="Duration" value={formatDuration(selected.duration)} />
                  )}
                  {selected.width && selected.height && (
                    <MetaRow icon={Image} label="Dimensions" value={`${selected.width} x ${selected.height}px`} />
                  )}
                  <MetaRow
                    icon={Calendar}
                    label="Uploaded"
                    value={new Date(selected.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  />
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-border space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/media/${selected.id}/file`).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy URL'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => handleDelete(selected.id)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Full-size preview lightbox */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="max-h-[92vh] sm:max-w-5xl overflow-y-auto p-0 bg-black/95 border-white/10">
          {preview && (
            <>
              <DialogHeader className="px-5 pt-4 pb-2">
                <DialogTitle className="truncate text-white">{preview.original_filename}</DialogTitle>
              </DialogHeader>

              <div className="px-4 pb-2">
                {(preview.media_type || 'image') === 'image' && (
                  <MediaPreviewEditor
                    key={`${preview.id}-${preview.file_size ?? 0}`}
                    preview={preview}
                    onSaved={updated => {
                      setPreview(updated)
                      setSelected(s => (s?.id === updated.id ? { ...s, ...updated } : s))
                      loadMedia()
                    }}
                  />
                )}
                {preview.media_type === 'video' && (
                  <video
                    src={`/api/media/${preview.id}/file`}
                    controls
                    className="w-full rounded-lg"
                  />
                )}
                {preview.media_type === 'document' && (
                  <iframe
                    src={`/api/media/${preview.id}/file`}
                    className="w-full h-[60vh] rounded-lg bg-white"
                    title={preview.original_filename}
                  />
                )}
              </div>

              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{formatSize(preview.file_size)}</Badge>
                  {preview.width && preview.height && (
                    <Badge variant="secondary">{preview.width} x {preview.height}px</Badge>
                  )}
                  <Badge variant="outline">
                    {new Date(preview.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/media/${preview.id}/file`).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy URL'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { handleDelete(preview.id); setPreview(null) }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-1.5 rounded-lg bg-muted mt-0.5">
        <Icon size={13} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
        <div className="text-sm text-foreground truncate">{value}</div>
      </div>
    </div>
  )
}
