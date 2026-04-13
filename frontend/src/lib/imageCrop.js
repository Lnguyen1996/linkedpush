/** @param {string} url */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * @param {string} imageSrc Object URL or data URL
 * @param {{ x: number; y: number; width: number; height: number }} pixelCrop
 * @param {{ mimeType?: string; quality?: number; maxWidth?: number | null }} opts
 * @returns {Promise<Blob>}
 */
export async function getCroppedImageBlob(imageSrc, pixelCrop, opts = {}) {
  const { mimeType = 'image/jpeg', quality = 0.92, maxWidth = null } = opts
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  let { width, height, x, y } = pixelCrop

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(image, x, y, width, height, 0, 0, width, height)

  if (maxWidth && width > maxWidth) {
    const nw = maxWidth
    const nh = Math.round((height * maxWidth) / width)
    const c2 = document.createElement('canvas')
    c2.width = nw
    c2.height = nh
    const c2ctx = c2.getContext('2d')
    if (!c2ctx) throw new Error('Canvas not supported')
    c2ctx.drawImage(canvas, 0, 0, width, height, 0, 0, nw, nh)
    return new Promise((resolve, reject) => {
      c2.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), mimeType, quality)
    })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), mimeType, quality)
  })
}
