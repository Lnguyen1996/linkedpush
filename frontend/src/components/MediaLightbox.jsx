import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MediaLightbox({ items, initialIndex, onClose }) {
  const [current, setCurrent] = useState(initialIndex ?? 0)
  const [loaded, setLoaded] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const total = items.length
  const item = items[current]

  const prev = useCallback(() => {
    setLoaded(false)
    setCurrent(c => (c - 1 + total) % total)
  }, [total])

  const next = useCallback(() => {
    setLoaded(false)
    setCurrent(c => (c + 1) % total)
  }, [total])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) next()
      else prev()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={onClose} />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-sm text-white/70 font-medium">
          {current + 1} of {total}
        </span>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Media */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-12">
        {item?.url && item.media_type === 'document' && (
          <iframe
            src={item.url}
            title={item.original_filename || 'Document preview'}
            className="h-full w-full max-w-5xl rounded-lg bg-white shadow-2xl"
          />
        )}
        {item?.url && item.media_type !== 'document' && (
          <img
            key={item.id}
            src={item.url}
            alt={item.original_filename || ''}
            className={cn(
              'max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setLoaded(true)}
            draggable={false}
          />
        )}
      </div>

      {/* Nav buttons */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>
  )
}
