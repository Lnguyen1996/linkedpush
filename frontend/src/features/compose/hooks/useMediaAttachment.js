import { useRef, useState } from 'react'

const LABEL = { image: 'Image', video: 'Video', document: 'Document' }

export default function useMediaAttachment({ addToast }) {
  const [mediaType, setMediaType] = useState(null)
  const [mediaIds, setMediaIds] = useState([])
  const [mediaItems, setMediaItems] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileRef = useRef(null)

  function hydrateFromPost(post) {
    if (post.media && post.media.length > 0) {
      const items = post.media.map(m => ({
        id: m.id,
        url: m.url || `/api/media/${m.id}/file`,
        media_type: m.media_type || 'image',
        original_filename: m.original_filename || '',
        duration: m.duration,
        mime_type: m.mime_type || '',
      }))
      setMediaItems(items)
      setMediaIds(items.map(m => m.id))
      setMediaType(items[0].media_type)
    } else if (post.image_id) {
      const item = {
        id: post.image_id,
        url: post.image_url || `/api/media/${post.image_id}/file`,
        media_type: 'image',
        original_filename: '',
        duration: null,
        mime_type: '',
      }
      setMediaItems([item])
      setMediaIds([post.image_id])
      setMediaType('image')
    }
  }

  function removeMediaItem(id) {
    setMediaItems(prev => prev.filter(m => m.id !== id))
    setMediaIds(prev => prev.filter(mid => mid !== id))
  }

  function clearAllMedia() {
    setMediaItems([])
    setMediaIds([])
    setMediaType(null)
  }

  function switchMediaType(type) {
    if (type === mediaType) {
      clearAllMedia()
      return
    }
    setMediaItems([])
    setMediaIds([])
    setMediaType(type)
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (mediaType === 'image' && mediaItems.length + files.length > 9) {
      addToast('Maximum 9 images per post', 'error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if ((mediaType === 'video' || mediaType === 'document') && (mediaItems.length > 0 || files.length > 1)) {
      addToast(`Only 1 ${mediaType} per post`, 'error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        let media
        if (mediaType === 'video') {
          media = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/api/media')
            xhr.withCredentials = true
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText))
              } else {
                try {
                  const err = JSON.parse(xhr.responseText)
                  reject(new Error(err.detail || 'Upload failed'))
                } catch {
                  reject(new Error('Upload failed'))
                }
              }
            }
            xhr.onerror = () => reject(new Error('Upload failed'))
            xhr.send(formData)
          })
        } else {
          const res = await fetch('/api/media', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            addToast(err.detail || 'Upload failed', 'error')
            continue
          }
          media = await res.json()
        }

        const item = {
          id: media.id,
          url: media.url || `/api/media/${media.id}/file`,
          media_type: media.media_type || mediaType,
          original_filename: media.original_filename || file.name,
          duration: media.duration,
          mime_type: media.mime_type || file.type,
        }
        setMediaItems(prev => [...prev, item])
        setMediaIds(prev => [...prev, media.id])
        addToast(`${LABEL[mediaType] || 'Media'} uploaded`)
      }
    } catch (err) {
      console.error('Upload failed:', err)
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function tryAddFromLibrary(item) {
    const mType = item.media_type || 'image'
    if (mediaType && mediaType !== mType) {
      setMediaItems([])
      setMediaIds([])
    }
    if (mType !== 'image' && mediaItems.length > 0) {
      addToast(`Only 1 ${mType} per post`, 'error')
      return false
    }
    if (mType === 'image' && mediaItems.length >= 9) {
      addToast('Maximum 9 images per post', 'error')
      return false
    }
    const newItem = {
      id: item.id,
      url: `/api/media/${item.id}/file`,
      media_type: mType,
      original_filename: item.original_filename || '',
      duration: item.duration,
      mime_type: item.mime_type || '',
    }
    setMediaType(mType)
    setMediaItems(prev => [...prev, newItem])
    setMediaIds(prev => [...prev, item.id])
    addToast('Media attached')
    return true
  }

  return {
    mediaType,
    mediaIds,
    mediaItems,
    uploading,
    uploadProgress,
    fileRef,
    hydrateFromPost,
    removeMediaItem,
    clearAllMedia,
    switchMediaType,
    handleMediaUpload,
    tryAddFromLibrary,
  }
}
