import { useState, useEffect, useRef } from 'react'
import { Image, Upload, X, Trash2, FileImage } from 'lucide-react'

export default function MediaLibrary() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
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

  async function handleUpload(e) {
    const files = e.target.files
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Image size={24} className="text-linkedin" />
          <h1 className="text-2xl font-semibold text-dark">Media Library</h1>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linkedin text-white text-sm font-medium hover:bg-linkedin-dark transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading media...</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileImage size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No images yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload images to use in your posts</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                    selected?.id === item.id ? 'border-linkedin shadow-md' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={`/uploads/${item.filename}`}
                    alt={item.original_filename}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 p-4 h-fit hidden lg:block">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-dark">Details</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={`/uploads/${selected.filename}`}
              alt={selected.original_filename}
              className="w-full rounded-lg mb-3"
            />
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Filename</span>
                <p className="text-dark truncate">{selected.original_filename}</p>
              </div>
              <div>
                <span className="text-gray-400">Size</span>
                <p className="text-dark">{formatSize(selected.file_size)}</p>
              </div>
              {selected.width && selected.height && (
                <div>
                  <span className="text-gray-400">Dimensions</span>
                  <p className="text-dark">{selected.width} x {selected.height}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400">Uploaded</span>
                <p className="text-dark">
                  {new Date(selected.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(selected.id)}
              className="mt-4 flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
