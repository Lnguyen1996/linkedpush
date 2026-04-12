import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, PenSquare, Clock, CheckCircle2, XCircle, FileText, Plus } from 'lucide-react'

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  publishing: { label: 'Publishing', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  published: { label: 'Published', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function Dashboard() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadPosts()
  }, [filter])

  async function loadPosts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', per_page: '50' })
      if (filter) params.set('status', filter)
      const res = await fetch(`/api/posts?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  function stripHtml(html) {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={24} className="text-linkedin" />
          <h1 className="text-2xl font-semibold text-dark">Dashboard</h1>
        </div>
        <Link
          to="/compose"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linkedin text-white text-sm font-medium hover:bg-linkedin-dark transition-colors"
        >
          <Plus size={16} />
          New Post
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { value: '', label: 'All' },
          { value: 'draft', label: 'Drafts' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'published', label: 'Published' },
          { value: 'failed', label: 'Failed' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === tab.value
                ? 'bg-linkedin/10 text-linkedin'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <PenSquare size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No posts yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first post to get started</p>
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg bg-linkedin text-white text-sm font-medium hover:bg-linkedin-dark transition-colors"
          >
            <Plus size={16} />
            Create Post
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const cfg = statusConfig[post.status] || statusConfig.draft
            const StatusIcon = cfg.icon
            return (
              <Link
                key={post.id}
                to={`/compose/${post.id}`}
                className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-linkedin/30 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-dark truncate">
                    {post.title || stripHtml(post.content).slice(0, 80) || 'Untitled post'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {post.scheduled_at && (
                      <span className="ml-2">
                        Scheduled: {new Date(post.scheduled_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                  <StatusIcon size={12} />
                  {cfg.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
