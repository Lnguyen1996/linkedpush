import { useState, useEffect, useRef } from 'react'
import { Image, Upload, X, Trash2, FileImage, Calendar, HardDrive, Loader2, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog'

export default function MediaLibrary() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef(null)

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
          accept="image/jpeg,image/png,image/gif"
          multiple
          onChange={(e) => uploadFiles(e.target.files)}
          className="hidden"
        />
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
            ) : items.length === 0 ? (
              <Card
                className="border-2 border-dashed hover:border-primary/30 transition-colors cursor-pointer p-16 text-center"
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-purple/5 dark:bg-purple/10 flex items-center justify-center mx-auto mb-5">
                  <FileImage size={28} className="text-purple/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No images yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                  Drop images here or click to upload. Supports JPEG, PNG, and GIF up to 5MB.
                </p>
                <Button variant="secondary" size="sm">
                  <Upload size={15} />
                  Choose files
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
                {items.map(item => (
                  <Card
                    key={item.id}
                    className={cn(
                      'group relative aspect-square overflow-hidden cursor-pointer border-2 transition-all duration-200 hover:shadow-lg p-0',
                      selected?.id === item.id
                        ? 'border-primary shadow-md ring-2 ring-primary/20'
                        : 'border-border hover:border-foreground/20'
                    )}
                    onClick={() => setSelected(item)}
                  >
                    <img
                      src={`/uploads/${item.filename}`}
                      alt={item.original_filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="text-white text-[11px] font-medium truncate">{item.original_filename}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">{formatSize(item.file_size)}</Badge>
                    </div>
                    {/* Selected check */}
                    {selected?.id === item.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel (desktop sidebar) */}
        {selected && (
          <div className="w-80 shrink-0 hidden lg:block animate-fade-in-up">
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
                {/* Preview */}
                <img
                  src={`/uploads/${selected.filename}`}
                  alt={selected.original_filename}
                  className="w-full rounded-xl border border-border mb-4"
                />

                {/* Metadata */}
                <div className="space-y-3">
                  <MetaRow icon={FileImage} label="Filename" value={selected.original_filename} />
                  <MetaRow icon={HardDrive} label="Size" value={formatSize(selected.file_size)} />
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
                      navigator.clipboard.writeText(`/uploads/${selected.filename}`).then(() => {
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
                    Delete Image
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile preview dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="lg:hidden sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selected.original_filename}</DialogTitle>
              </DialogHeader>

              <img
                src={`/uploads/${selected.filename}`}
                alt={selected.original_filename}
                className="w-full rounded-xl border border-border"
              />

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{formatSize(selected.file_size)}</Badge>
                {selected.width && selected.height && (
                  <Badge variant="secondary">{selected.width} x {selected.height}px</Badge>
                )}
                <Badge variant="outline">
                  {new Date(selected.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Badge>
              </div>

              <DialogFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`/uploads/${selected.filename}`).then(() => {
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
                  className="flex-1"
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </DialogFooter>
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
