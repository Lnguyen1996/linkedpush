import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Bell, Clock, KeyRound, Loader2, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'

function kindMeta(kind) {
  switch (kind) {
    case 'publish_failed':
      return { icon: AlertCircle, color: 'text-red-400' }
    case 'scheduled_soon':
      return { icon: Clock, color: 'text-blue-400' }
    case 'linkedin_token_expiring':
      return { icon: KeyRound, color: 'text-amber-400' }
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
    dismissAllVisible,
  } = useNotifications(true)

  return (
    <Popover
      onOpenChange={open => {
        if (open) refetch()
      }}
    >
      <PopoverTrigger asChild>
        <Button
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
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-[min(100vw-2rem,24rem)] max-h-[min(70vh,28rem)] overflow-hidden',
          'border border-white/10 bg-[#141414] p-0 text-white shadow-2xl ring-white/10'
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {visibleCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-white/60 hover:bg-white/10 hover:text-white"
              onClick={dismissAllVisible}
            >
              Clear all
            </Button>
          )}
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
            <p className="px-3 py-10 text-center text-sm text-white/50">You&apos;re all caught up.</p>
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

              return (
                <li
                  key={item.id}
                  className="group rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex gap-2">
                    <div className={cn('mt-0.5 shrink-0', iconColor)}>
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.post_id ? (
                        <Link
                          to={`/app/compose/${item.post_id}`}
                          className="block outline-none focus-visible:ring-2 focus-visible:ring-purple/50 rounded"
                        >
                          {body}
                        </Link>
                      ) : item.kind === 'linkedin_token_expiring' ? (
                        <a
                          href="https://www.linkedin.com/developers/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block outline-none focus-visible:ring-2 focus-visible:ring-purple/50 rounded"
                        >
                          {body}
                        </a>
                      ) : (
                        <div>{body}</div>
                      )}
                    </div>
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
