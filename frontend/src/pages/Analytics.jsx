import { useState, useEffect } from 'react'
import { BarChart3, Eye, Heart, MessageCircle, Share2, RefreshCw, ArrowUpDown } from 'lucide-react'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState('published_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics', { credentials: 'include' })
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/analytics/refresh', { method: 'POST', credentials: 'include' })
      await loadAnalytics()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setRefreshing(false)
    }
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedPosts = data?.posts?.slice().sort((a, b) => {
    let aVal = a[sortKey]
    let bVal = b[sortKey]
    if (sortKey === 'published_at' || sortKey === 'title') {
      aVal = aVal || ''
      bVal = bVal || ''
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  }) || []

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading analytics...</div>
    )
  }

  const summary = data?.summary || { total_posts: 0, total_impressions: 0, total_engagements: 0 }

  const SortHeader = ({ label, field }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
    >
      {label}
      <ArrowUpDown size={12} className={sortKey === field ? 'text-linkedin' : 'text-gray-300'} />
    </button>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-linkedin" />
          <h1 className="text-2xl font-semibold text-dark">Analytics</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <BarChart3 size={16} />
            Total Posts
          </div>
          <div className="text-2xl font-semibold text-dark">{summary.total_posts}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Eye size={16} />
            Total Impressions
          </div>
          <div className="text-2xl font-semibold text-dark">{summary.total_impressions.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Heart size={16} />
            Total Engagements
          </div>
          <div className="text-2xl font-semibold text-dark">{summary.total_engagements.toLocaleString()}</div>
        </div>
      </div>

      {/* Posts table */}
      {sortedPosts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No published posts yet</p>
          <p className="text-sm text-gray-400 mt-1">Publish posts to see analytics here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3"><SortHeader label="Title" field="title" /></th>
                  <th className="text-left px-4 py-3"><SortHeader label="Published" field="published_at" /></th>
                  <th className="text-right px-4 py-3"><SortHeader label="Impressions" field="impressions" /></th>
                  <th className="text-right px-4 py-3"><SortHeader label="Likes" field="likes" /></th>
                  <th className="text-right px-4 py-3"><SortHeader label="Comments" field="comments" /></th>
                  <th className="text-right px-4 py-3"><SortHeader label="Shares" field="shares" /></th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map(post => (
                  <tr key={post.post_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-dark font-medium max-w-[200px] truncate">
                      {post.title || 'Untitled'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {post.has_engagement ? (
                        <span className="flex items-center justify-end gap-1">
                          <Eye size={14} className="text-gray-400" />
                          {post.impressions.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No data yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {post.has_engagement ? (
                        <span className="flex items-center justify-end gap-1">
                          <Heart size={14} className="text-gray-400" />
                          {post.likes}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No data yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {post.has_engagement ? (
                        <span className="flex items-center justify-end gap-1">
                          <MessageCircle size={14} className="text-gray-400" />
                          {post.comments}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No data yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {post.has_engagement ? (
                        <span className="flex items-center justify-end gap-1">
                          <Share2 size={14} className="text-gray-400" />
                          {post.shares}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No data yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
