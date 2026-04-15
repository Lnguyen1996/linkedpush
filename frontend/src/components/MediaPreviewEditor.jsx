import { useState, useEffect, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crop,
  ImageIcon,
  Loader2,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getCroppedImageBlob } from '@/lib/imageCrop'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

export default function MediaPreviewEditor({ preview, onSaved, className }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [mode, setMode] = useState('view')
  const [viewZoom, setViewZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [aspectKey, setAspectKey] = useState('free')
  const [maxWidth, setMaxWidth] = useState('')
  const [saving, setSaving] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const scrollRef = useRef(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    if (!preview?.id) return
    let revoked = false
    let url = null
    ;(async () => {
      try {
        const res = await fetch(`/api/media/${preview.id}/file`, { credentials: 'include' })
        if (!res.ok) return
        const blob = await res.blob()
        if (revoked) return
        url = URL.createObjectURL(blob)
        setObjectUrl(u => {
          if (u) URL.revokeObjectURL(u)
          return url
        })
      } catch {
        setObjectUrl(u => {
          if (u) URL.revokeObjectURL(u)
          return null
        })
      }
    })()
    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
      setObjectUrl(u => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
    }
  }, [preview?.id])

  useEffect(() => {
    setMode('view')
    setViewZoom(1)
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedAreaPixels(null)
    setAspectKey('free')
    setMaxWidth('')
    setNaturalSize({ w: 0, h: 0 })
  }, [preview?.id])

  const aspectMap = { free: undefined, '1': 1, '16_9': 16 / 9, '4_3': 4 / 3 }
  const aspectValue = aspectMap[aspectKey]

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const onDragStart = useCallback(e => {
    const el = scrollRef.current
    if (!el) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
    el.style.cursor = 'grabbing'
  }, [])
  const onDragMove = useCallback(e => {
    const d = dragState.current
    if (!d.dragging) return
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = d.scrollLeft - (e.clientX - d.startX)
    el.scrollTop = d.scrollTop - (e.clientY - d.startY)
  }, [])
  const onDragEnd = useCallback(() => {
    dragState.current.dragging = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }, [])

  const outputMime = preview?.mime_type?.includes('png') ? 'image/png' : 'image/jpeg'
  const outputExt = outputMime === 'image/png' ? 'png' : 'jpg'

  async function handleSaveCrop() {
    if (!objectUrl || !croppedAreaPixels || !preview?.id) return
    const mw = maxWidth.trim() ? parseInt(maxWidth, 10) : null
    if (mw !== null && (Number.isNaN(mw) || mw < 1)) {
      return
    }
    setSaving(true)
    try {
      const blob = await getCroppedImageBlob(objectUrl, croppedAreaPixels, {
        mimeType: outputMime,
        quality: 0.92,
        maxWidth: mw,
      })
      if (blob.size > 5 * 1024 * 1024) {
        alert('Result is larger than 5MB. Try a smaller crop or max width.')
        setSaving(false)
        return
      }
      const fd = new FormData()
      const baseName = (preview.original_filename || 'image').replace(/\.[^.]+$/, '')
      const file = new File([blob], `${baseName}-edited.${outputExt}`, { type: outputMime })
      fd.append('file', file)

      const res = await fetch(`/api/media/${preview.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText)
      }
      onSaved?.(await res.json())
      setMode('view')
      setViewZoom(1)
    } catch (e) {
      console.error(e)
      alert(e.message || 'Failed to save image')
    } finally {
      setSaving(false)
    }
  }

  if (!preview) return null

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-1 pb-3">
        <div className="flex rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
          <Button
            type="button"
            variant={mode === 'view' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMode('view')}
          >
            <ImageIcon size={14} />
            View
          </Button>
          <Button
            type="button"
            variant={mode === 'crop' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMode('crop')}
          >
            <Crop size={14} />
            Crop
          </Button>
        </div>

        {mode === 'view' && (
          <>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => setViewZoom(z => Math.max(ZOOM_MIN, Math.round((z - 0.15) * 100) / 100))}
              >
                <ZoomOut size={15} />
              </Button>
              <input
                type="range"
                min={25}
                max={400}
                value={Math.round(viewZoom * 100)}
                onChange={e => setViewZoom(Number(e.target.value) / 100)}
                className="mx-1 h-2 w-24 cursor-pointer accent-purple md:w-32"
                aria-label="Zoom"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => setViewZoom(z => Math.min(ZOOM_MAX, Math.round((z + 0.15) * 100) / 100))}
              >
                <ZoomIn size={15} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-white/70 hover:text-white"
                onClick={() => setViewZoom(1)}
              >
                <RotateCcw size={14} />
                Reset
              </Button>
            </div>
            <span className="text-xs text-white/45">Scroll wheel zooms</span>
          </>
        )}

        {mode === 'crop' && objectUrl && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-white/50">Aspect</Label>
                <Select value={aspectKey} onValueChange={setAspectKey}>
                  <SelectTrigger className="h-8 w-[120px] border-white/20 bg-white/[0.06] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="1">1:1</SelectItem>
                    <SelectItem value="16_9">16:9</SelectItem>
                    <SelectItem value="4_3">4:3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-white/50">Max width (px)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Optional"
                  value={maxWidth}
                  onChange={e => setMaxWidth(e.target.value)}
                  className="h-8 w-28 border-white/20 bg-white/[0.06] text-white placeholder:text-white/35"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-purple hover:bg-purple-dark"
                disabled={saving || !croppedAreaPixels}
                onClick={handleSaveCrop}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </Button>
            </div>
            <span className="w-full text-xs text-white/45">Drag to move, pinch or scroll to zoom crop</span>
          </>
        )}
      </div>

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg bg-black/60',
          mode === 'view' ? 'min-h-[min(50vh,400px)]' : 'h-[min(55vh,520px)]'
        )}
        onWheel={e => {
          if (mode !== 'view') return
          e.preventDefault()
          e.stopPropagation()
          const delta = e.deltaY > 0 ? -0.08 : 0.08
          setViewZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)))
        }}
      >
        {mode === 'view' && objectUrl && (
          <div
            ref={scrollRef}
            className="max-h-[min(68vh,680px)] w-full overflow-auto"
            style={{ cursor: viewZoom > 1 ? 'grab' : 'default' }}
            onMouseDown={viewZoom > 1 ? onDragStart : undefined}
            onMouseMove={viewZoom > 1 ? onDragMove : undefined}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
          >
            <div className="flex min-h-[min(50vh,360px)] w-full justify-center p-3">
              <div
                className="inline-block rounded-md shadow-lg ring-1 ring-white/10"
                style={
                  naturalSize.w && naturalSize.h
                    ? {
                        width: Math.max(1, Math.round(naturalSize.w * viewZoom)),
                        height: Math.max(1, Math.round(naturalSize.h * viewZoom)),
                      }
                    : { maxWidth: '100%' }
                }
              >
                <img
                  src={objectUrl}
                  alt={preview.original_filename}
                  className={cn(
                    'block rounded-md',
                    naturalSize.w && naturalSize.h ? 'h-full w-full object-contain' : 'max-h-[60vh] max-w-full object-contain'
                  )}
                  draggable={false}
                  onLoad={e => {
                    const el = e.currentTarget
                    setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {mode === 'crop' && objectUrl && (
          <Cropper
            image={objectUrl}
            crop={crop}
            zoom={cropZoom}
            aspect={aspectValue}
            onCropChange={setCrop}
            onZoomChange={setCropZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
            classes={{
              containerClassName: 'rounded-lg',
              mediaClassName: 'max-h-full',
            }}
          />
        )}

        {!objectUrl && (
          <div className="flex h-48 items-center justify-center text-white/50">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
