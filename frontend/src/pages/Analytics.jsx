import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3, Eye, Heart, MessageCircle, Share2, RefreshCw,
  ArrowUpDown, TrendingUp, Loader2, ArrowUp, ArrowDown, Link2, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHead
} from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'

const LINKEDIN_AUTH_ERROR_SUBSTRINGS = [
  'linkedin not connected',
  'linkedin access token',
  'please re-authenticate',
  'linkedin access expired',
  'unauthorized',
]

function isAuthErrorDetail(detail) {
  if (!detail || typeof detail !== 'string') return false
  const lower = detail.toLowerCase()
  return LINKEDIN_AUTH_ERROR_SUBSTRINGS.some(s => lower.includes(s))
}

export default function Analytics() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { isConnected } = useLinkedInStatus(user)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const [sortKey, setSortKey] = useState('published_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    // Opportunistically re-evaluate auth state on mount.
    refreshUser?.()
    if (!isConnected) {
      setLoading(false)
      return
    }
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics', { credentials: 'include' })
      if (res.ok) {
        const body = await res.json()
        if (isAuthErrorDetail(body?.error_message)) {
          setAuthExpired(true)
          refreshUser?.()
          return
        }
        setAuthExpired(false)
        setData(body)
        return
      }
      // Non-OK: distinguish 401 / auth error from generic failures.
      if (res.status === 401) {
        setAuthExpired(true)
        refreshUser?.()
        return
      }
      const errBody = await res.json().catch(() => ({}))
      if (isAuthErrorDetail(errBody?.detail) || isAuthErrorDetail(errBody?.error_message)) {
        setAuthExpired(true)
        refreshUser?.()
        return
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
      const res = await fetch('/api/analytics/refresh', { method: 'POST', credentials: 'include' })
      if (res.status === 401) {
        setAuthExpired(true)
        refreshUser?.()
        return
      }
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
    if (sortKey === 'published_at' || sortKey === 'content_snippet') {
      aVal = aVal || ''
      bVal = bVal || ''
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  }) || []

  const maxImpressions = Math.max(0, ...(sortedPosts.map(p => p.impressions || 0)))
  const maxLikes = Math.max(0, ...(sortedPosts.map(p => p.likes || 0)))

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (authExpired) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-white/55 mt-1">Track your LinkedIn post performance</p>
          </div>
        </div>
        <Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={28} className="text-amber-300" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connection expired</h3>
          <p className="text-sm text-white/55 max-w-sm mx-auto mb-6">
            Your LinkedIn access has expired or been revoked. Reconnect to fetch fresh engagement metrics.
          </p>
          <Link
            to="/app/settings"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            <RefreshCw size={15} />
            Reconnect LinkedIn
          </Link>
        </Card>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-white/55 mt-1">Track your LinkedIn post performance</p>
          </div>
        </div>
        <Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple/10 flex items-center justify-center mx-auto mb-5">
            <Link2 size={28} className="text-purple-300" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connect LinkedIn to see your analytics</h3>
          <p className="text-sm text-white/55 max-w-sm mx-auto mb-6">
            Once your LinkedIn account is connected, engagement metrics for your published posts will show up here.
          </p>
          <Link
            to="/app/settings"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
          >
            <Link2 size={15} />
            Go to Settings
          </Link>
        </Card>
      </div>
    )
  }

  const summary = data?.summary || { total_posts: 0, total_impressions: 0, total_engagements: 0 }
  const avgEngagement = summary.total_posts > 0
    ? (summary.total_engagements / summary.total_posts).toFixed(1)
    : '0'

  const SortHeader = ({ label, field, align = 'left' }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleSort(field)}
      className={cn(
        'h-auto px-0 py-0 text-[11px] font-semibold text-white/55 uppercase tracking-wider hover:text-white',
        align === 'right' && 'ml-auto'
      )}
    >
      {label}
      {sortKey === field ? (
        sortDir === 'asc' ? <ArrowUp size={11} className="text-primary ml-1" /> : <ArrowDown size={11} className="text-primary ml-1" />
      ) : (
        <ArrowUpDown size={11} className="text-white/30 ml-1" />
      )}
    </Button>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-white/55 mt-1">Track your LinkedIn post performance</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <SummaryCard
          label="Published Posts"
          value={summary.total_posts}
          icon={BarChart3}
          color="purple"
          detail="all time"
        />
        <SummaryCard
          label="Total Impressions"
          value={summary.total_impressions}
          icon={Eye}
          color="purple"
          detail="across all posts"
          format
        />
        <SummaryCard
          label="Total Engagements"
          value={summary.total_engagements}
          icon={Heart}
          color="rose"
          detail="likes + comments + shares"
          format
        />
        <SummaryCard
          label="Avg. Engagement"
          value={avgEngagement}
          icon={TrendingUp}
          color="emerald"
          detail="per post"
        />
      </div>

      {/* Posts table */}
      {sortedPosts.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple/10 flex items-center justify-center mx-auto mb-5">
            <BarChart3 size={28} className="text-purple/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No published posts yet</h3>
          <p className="text-sm text-white/55 max-w-sm mx-auto">
            Publish posts to see analytics here. Your engagement data will appear automatically.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 py-4"><SortHeader label="Post" field="content_snippet" /></TableHead>
                <TableHead className="px-5 py-4"><SortHeader label="Published" field="published_at" /></TableHead>
                <TableHead className="px-5 py-4 text-right"><SortHeader label="Impressions" field="impressions" align="right" /></TableHead>
                <TableHead className="px-5 py-4 text-right"><SortHeader label="Likes" field="likes" align="right" /></TableHead>
                <TableHead className="px-5 py-4 text-right"><SortHeader label="Comments" field="comments" align="right" /></TableHead>
                <TableHead className="px-5 py-4 text-right"><SortHeader label="Shares" field="shares" align="right" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.map((post, idx) => (
                <TableRow
                  key={post.post_id}
                  className={cn('cursor-pointer transition-colors hover:bg-white/[0.04]', idx % 2 !== 0 && 'bg-white/[0.02]')}
                  onClick={() => navigate(`/app/post/${post.post_id}`)}
                >
                  <TableCell className="px-5 py-4 font-medium max-w-[280px] truncate">
                    {post.content_snippet || post.title || 'Untitled'}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-white/55">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      : '—'
                    }
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    {post.has_engagement ? (
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 right-0 bg-purple/10 rounded-sm transition-all duration-500"
                          style={{ width: `${maxImpressions > 0 ? (post.impressions / maxImpressions) * 100 : 0}%` }}
                        />
                        <span className="relative font-medium text-white">
                          {post.impressions?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal italic">No data</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    {post.has_engagement ? (
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 right-0 bg-rose-500/10 rounded-sm transition-all duration-500"
                          style={{ width: `${maxLikes > 0 ? (post.likes / maxLikes) * 100 : 0}%` }}
                        />
                        <span className="relative font-medium text-white">
                          {post.likes?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal italic">No data</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    {post.has_engagement ? (
                      <Badge variant="outline" className="gap-1.5 font-medium">
                        <MessageCircle size={13} className="text-purple-400" />
                        {post.comments}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal italic">No data</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    {post.has_engagement ? (
                      <Badge variant="outline" className="gap-1.5 font-medium">
                        <Share2 size={13} className="text-emerald-400" />
                        {post.shares}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal italic">No data</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color, detail, format }) {
  const colorMap = {
    purple: { icon: 'bg-purple/10', text: 'text-purple-300' },
    rose: { icon: 'bg-rose-500/10', text: 'text-rose-300' },
    emerald: { icon: 'bg-emerald-500/10', text: 'text-emerald-300' },
  }
  const c = colorMap[color] || colorMap.purple
  const displayValue = format ? Number(value).toLocaleString() : value

  return (
    <Card className="card-hover">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2.5 rounded-xl', c.icon)}>
            <Icon size={18} className={c.text} />
          </div>
        </div>
        <div className="text-2xl font-bold text-white">{displayValue}</div>
        <div className="text-xs text-white/55 mt-0.5">{label}</div>
        {detail && <div className="text-[10px] text-white/40 mt-1">{detail}</div>}
      </CardContent>
    </Card>
  )
}
