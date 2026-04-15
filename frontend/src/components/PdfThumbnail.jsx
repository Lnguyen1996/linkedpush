import { useEffect, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'

// pdfjs v5 worker uses import.meta, requiring a module worker. Vite's ?url
// import served a working URL + MIME but the browser still refused the worker
// (likely due to the minified worker's internal subresource lookups vs a
// hashed path). Pin to the matching-version CDN build for reliability.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const cache = new Map()

export default function PdfThumbnail({ src, width = 200, className = '', fallback = null, alt = 'PDF preview' }) {
  const [dataUrl, setDataUrl] = useState(() => cache.get(src) ?? null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (!src) return
    if (cache.has(src)) { setDataUrl(cache.get(src)); return }
    let cancelled = false
    ;(async () => {
      try {
        const pdf = await pdfjs.getDocument({ url: src, withCredentials: true }).promise
        const page = await pdf.getPage(1)
        const unscaled = page.getViewport({ scale: 1 })
        const scale = Math.max(0.5, width / unscaled.width)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL('image/png')
        cache.set(src, url)
        if (!cancelled) setDataUrl(url)
      } catch {
        if (!cancelled) setErrored(true)
      }
    })()
    return () => { cancelled = true }
  }, [src, width])

  if (errored && fallback) return fallback
  if (!dataUrl) return fallback ?? <div className={`animate-pulse bg-white/5 ${className}`} />
  return <img src={dataUrl} alt={alt} className={className} loading="lazy" />
}
