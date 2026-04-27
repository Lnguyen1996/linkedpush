import { cn } from '@/lib/utils'

/**
 * Shared card shell for any integration surface.
 * Wraps logo + heading + subtitle on the left, actions on the right,
 * and renders children below (body / status row).
 */
export default function IntegrationCard({
  logo,
  name,
  description,
  statusBadge,
  actions,
  children,
  accentColor,
  className,
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className
      )}
    >
      {accentColor && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`,
          }}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          {logo && (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
              style={accentColor ? { boxShadow: `inset 0 0 0 1px ${accentColor}33` } : undefined}
            >
              {logo}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-white">
                {name}
              </h3>
              {statusBadge}
            </div>
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-white/55">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">{actions}</div>
        )}
      </div>
      {children && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">{children}</div>
      )}
    </div>
  )
}
