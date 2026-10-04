import { Link } from 'react-router-dom'
import { AlertCircle, Bell, Clock, KeyRound, Loader2, Settings, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNotification } from '@/context/NotificationContext'

function kindMeta(kind) {
  switch (kind) {
    case 'post_failed':
      return { icon: AlertCircle, color: 'text-red-400' }
    case 'post_scheduled':
      return { icon: Clock, color: 'text-blue-400' }
    case 'linkedin_token_expiring':
      return { icon: KeyRound, color: 'text-amber-400' }
    case 'linkedin_token_expired':
      return { icon: AlertCircle, color: 'text-rose-400' }
    default:
      return { icon: Bell, color: 'text-white/50' }
  }
}

function NotificationBell() {
  const {
    visibleItems,
    visibleCount,
    loading,
    error,
    refetch,
    dismiss,
    markRead,
    markAllRead,
  } = useNotification()

  async function handleMarkAllRead() {
    await markAllRead()
  }

  async function handleNotificationClick(item, e) {
    // Don't intercept when clicking the dismiss button
    if (e.defaultPrevented) return
    if (item.read_at) return
    e.preventDefault()
    await markRead(item.id)
    // Then navigate
    if (item.post_id) {
      window.location.href = `/app/compose/${item.post_id}`
    } else if (item.kind === 'linkedin_token_expiring' || item.kind === 'linkedin_token_expired') {
      window.location.href = '/app/settings?tab=notifications'
    }
  }

  return (
    <Popover
      onOpenChange={open => {
        if (open) refetch()
      }}
    >
      <PopoverTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 text-white/65 hover:text-white hover:bg-white/[0.06]"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {visibleCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#111111]">
                {visibleCount > 9 ? '9+' : visibleCount}
              </span>
            )}
          </Button>
        )}
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-[min(100vw-2rem,24rem)] max-h-[min(70vh,28rem)] overflow-hidden',
          'border border-white/10 bg-[#141414] p-0 text-white shadow-2xl ring-white/10'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            <Link
              to="/app/notifications"
              className="ml-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Notification settings"
              asChild
            >
              <Link to="/app/settings?tab=notifications">
                <Settings size={13} strokeWidth={2} />
              </Link>
            </Button>
            {visibleCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[min(65vh,24rem)] overflow-y-auto overscroll-contain px-2 py-2">
          {loading && visibleItems.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-white/50">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {error && !loading && (
            <p className="px-2 py-6 text-center text-sm text-red-300/90">{error}</p>
          )}

          {!loading && !error && visibleItems.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-white/50">You're all caught up.</p>
          )}

          <ul className="space-y-1">
            {visibleItems.map(item => {
              const { icon: Icon, color: iconColor } = kindMeta(item.kind)
              const when = item.occurred_at
                ? formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })
                : ''
              const tone =
                item.severity === 'error'
                  ? 'text-red-300/90'
                  : item.severity === 'warning'
                    ? 'text-amber-200/90'
                    : 'text-white/80'

              const body = (
                <>
                  <div className={cn('text-sm font-medium leading-snug', tone)}>{item.title}</div>
                  {item.body && (
                    <p className="mt-0.5 line-clamp-3 text-xs text-white/50">{item.body}</p>
                  )}
                  {when && <p className="mt-1 text-[10px] text-white/35">{when}</p>}
                </>
              )

              const itemProps = {
                className: 'group rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 transition-colors hover:bg-white/[0.06]',
              }

              let content = (
                <div className="flex gap-2">
                  <div className={cn('mt-0.5 shrink-0', iconColor)}>
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">{body}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-white/35 hover:bg-white/10 hover:text-white"
                    aria-label="Dismiss"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      dismiss(item.id)
                    }}
                  >
                    <X size={14} />
                  </Button>
                </div>
              )

              // Make the item clickable to mark read and navigate
              const navigate = item.post_id
                ? `/app/compose/${item.post_id}`
                : item.kind === 'linkedin_token_expiring' || item.kind === 'linkedin_token_expired'
                  ? '/app/settings?tab=notifications'
                  : null

              if (navigate) {
                return (
                  <li key={item.id}>
                    <Link
                      to={navigate}
                      className={itemProps.className}
                      onClick={e => handleNotificationClick(item, e)}
                    >
                      {content}
                    </Link>
                  </li>
                )
              }

              return (
                <li key={item.id} {...itemProps}>
                  {content}
                </li>
              )
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationBell
