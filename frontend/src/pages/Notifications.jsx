import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Bell,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { formatDistanceToNow, isToday, isYesterday, startOfWeek, isBefore } from 'date-fns'
import { cn } from '@/lib/utils'
import { useNotification } from '@/context/NotificationContext'
import { Button } from '@/components/ui/button'

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'posts', label: 'Posts' },
  { value: 'system', label: 'System' },
]

function kindMeta(kind) {
  switch (kind) {
    case 'post_failed':
    case 'post_published':
    case 'post_scheduled':
      return { icon: Bell, color: 'text-blue-400', bg: 'bg-blue-400/10' }
    case 'linkedin_token_expiring':
    case 'linkedin_token_expired':
      return { icon: KeyRound, color: 'text-amber-400', bg: 'bg-amber-400/10' }
    case 'ai_compose_complete':
      return { icon: Sparkles, color: 'text-purple', bg: 'bg-purple/10' }
    case 'weekly_digest':
    case 'email':
      return { icon: Mail, color: 'text-white/50', bg: 'bg-white/5' }
    default:
      return { icon: Bell, color: 'text-white/50', bg: 'bg-white/5' }
  }
}

function severityTone(severity) {
  if (severity === 'error') return 'text-red-300/90'
  if (severity === 'warning') return 'text-amber-200/90'
  return 'text-white/80'
}

function groupByDate(items) {
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  for (const item of items) {
    const d = new Date(item.occurred_at ?? item.created_at)
    if (isToday(d)) {
      groups.today.push(item)
    } else if (isYesterday(d)) {
      groups.yesterday.push(item)
    } else if (isBefore(d, weekStart)) {
      groups.earlier.push(item)
    } else {
      groups.thisWeek.push(item)
    }
  }

  return groups
}

function NotificationItem({ item, onMarkRead }) {
  const navigate = useNavigate()
  const { icon: Icon, color: iconColor, bg: iconBg } = kindMeta(item.kind)
  const tone = severityTone(item.severity)
  const when = item.occurred_at ?? item.created_at
    ? formatDistanceToNow(new Date(item.occurred_at ?? item.created_at), { addSuffix: true })
    : ''

  function getDestination() {
    if (item.post_id) return `/app/compose/${item.post_id}`
    if (item.kind === 'linkedin_token_expiring' || item.kind === 'linkedin_token_expired') {
      return '/app/settings?tab=notifications'
    }
    return null
  }

  async function handleClick(e) {
    if (e.defaultPrevented) return
    const dest = getDestination()
    if (!item.read_at) {
      await onMarkRead(item.id)
    }
    if (dest) {
      navigate(dest)
    }
  }

  const content = (
    <div className="flex gap-3">
      <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconBg)}>
        <Icon size={16} className={iconColor} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium leading-snug', tone)}>{item.title}</div>
        {item.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{item.body}</p>
        )}
        {when && <p className="mt-1 text-[10px] text-white/35">{when}</p>}
      </div>
      {!item.read_at && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      )}
    </div>
  )

  const dest = getDestination()

  if (dest) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'group w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition-all hover:border-white/15 hover:bg-white/[0.05]',
          !item.read_at && 'border-purple/20'
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-all',
        !item.read_at && 'border-purple/20'
      )}
    >
      {content}
    </div>
  )
}

function SkeletonItem() {
  return (
    <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/4 rounded" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/20"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white/70">No notifications yet</p>
        <p className="mt-1 text-xs text-white/40">
          We'll let you know when something important happens.
        </p>
      </div>
    </div>
  )
}

function GroupHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/40">{label}</span>
      {count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-white/60">
          {count}
        </span>
      )}
    </div>
  )
}

export default function Notifications() {
  const { items, visibleCount, loading, refetch, markRead, markAllRead } = useNotification()
  const [filter, setFilter] = useState('all')

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter(i => !i.read_at)
    if (filter === 'posts') {
      return items.filter(i =>
        i.kind === 'post_failed' ||
        i.kind === 'post_published' ||
        i.kind === 'post_scheduled'
      )
    }
    if (filter === 'system') {
      return items.filter(i =>
        i.kind === 'linkedin_token_expiring' ||
        i.kind === 'linkedin_token_expired' ||
        i.kind === 'weekly_digest'
      )
    }
    return items
  }, [items, filter])

  const groups = useMemo(() => groupByDate(filteredItems), [filteredItems])

  const totalUnread = useMemo(() => items.filter(i => !i.read_at).length, [items])

  const showSkeleton = loading && items.length === 0

  return (
    <div className="animate-fade-in-up flex min-h-0 w-full flex-1 flex-col gap-6 p-4 lg:p-5">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold text-white">Notifications</h1>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Refresh notifications"
              onClick={() => refetch()}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </Button>
            {visibleCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === tab.value
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              {tab.label}
              {tab.value === 'unread' && totalUnread > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple px-1.5 text-[10px] font-bold text-white">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {showSkeleton ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {groups.today.length > 0 && (
              <section>
                <GroupHeader label="Today" count={groups.today.filter(i => !i.read_at).length} />
                <div className="mt-3 space-y-2.5">
                  {groups.today.map(item => (
                    <NotificationItem key={item.id} item={item} onMarkRead={markRead} />
                  ))}
                </div>
              </section>
            )}

            {groups.yesterday.length > 0 && (
              <section>
                <GroupHeader label="Yesterday" count={groups.yesterday.filter(i => !i.read_at).length} />
                <div className="mt-3 space-y-2.5">
                  {groups.yesterday.map(item => (
                    <NotificationItem key={item.id} item={item} onMarkRead={markRead} />
                  ))}
                </div>
              </section>
            )}

            {groups.thisWeek.length > 0 && (
              <section>
                <GroupHeader label="Earlier this week" count={groups.thisWeek.filter(i => !i.read_at).length} />
                <div className="mt-3 space-y-2.5">
                  {groups.thisWeek.map(item => (
                    <NotificationItem key={item.id} item={item} onMarkRead={markRead} />
                  ))}
                </div>
              </section>
            )}

            {groups.earlier.length > 0 && (
              <section>
                <GroupHeader label="Earlier" count={groups.earlier.filter(i => !i.read_at).length} />
                <div className="mt-3 space-y-2.5">
                  {groups.earlier.map(item => (
                    <NotificationItem key={item.id} item={item} onMarkRead={markRead} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
