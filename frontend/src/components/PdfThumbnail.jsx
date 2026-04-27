import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'

// pdfjs v5 worker uses import.meta, requiring a module worker. Vite's ?url
// import served a working URL + MIME but the browser still refused the worker
// (likely due to the minified worker's internal subresource lookups vs a
// hashed path). Pin to the matching-version CDN build for reliability.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const cache = new Map()
const documentCache = new Map()
const pageCountCache = new Map()

function loadPdf(src) {
  if (!documentCache.has(src)) {
    const promise = pdfjs.getDocument({ url: src, withCredentials: true }).promise
      .catch(error => {
        documentCache.delete(src)
        throw error
      })
    documentCache.set(src, promise)
  }
  return documentCache.get(src)
}

export default function PdfThumbnail({
  src,
  width = 200,
  className = '',
  fallback = null,
  alt = 'PDF preview',
  pageNumber = 1,
  onPageCount,
}) {
  const deviceScale = typeof window === 'undefined'
    ? 1
    : Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
  const cacheKey = `${src || ''}:${pageNumber}:${width}:${deviceScale}`
  const [dataUrl, setDataUrl] = useState(() => cache.get(cacheKey) ?? null)
  const [errored, setErrored] = useState(false)
  const previousSrcRef = useRef(src)

  useEffect(() => {
    if (!src) return
    setErrored(false)
    if (pageCountCache.has(src)) onPageCount?.(pageCountCache.get(src))
    if (cache.has(cacheKey)) {
      setDataUrl(cache.get(cacheKey))
      return
    }
    if (previousSrcRef.current !== src) {
      previousSrcRef.current = src
      setDataUrl(null)
    }
    let cancelled = false
    ;(async () => {
      try {
        const pdf = await loadPdf(src)
        pageCountCache.set(src, pdf.numPages)
        if (!cancelled) onPageCount?.(pdf.numPages)

        const targetPage = Math.min(Math.max(pageNumber, 1), pdf.numPages)
        const page = await pdf.getPage(targetPage)
        const unscaled = page.getViewport({ scale: 1 })
        const scale = Math.max(0.5, width / unscaled.width) * deviceScale
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        await page.render({ canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL('image/png')
        cache.set(cacheKey, url)
        if (!cancelled) setDataUrl(url)
      } catch {
        if (!cancelled) setErrored(true)
      }
    })()
    return () => { cancelled = true }
  }, [src, width, pageNumber, cacheKey, deviceScale, onPageCount])

  if (errored && fallback) return fallback
  if (!dataUrl) return fallback ?? <div className={`animate-pulse bg-white/5 ${className}`} />
  return <img src={dataUrl} alt={alt} className={className} loading="lazy" />
}
