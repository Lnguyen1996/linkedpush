import { NavLink } from 'react-router-dom'

/** Nano Banana /icon output — also used as favicon source */
export const BRAND_LOGO_SRC = '/brand/logo-512.png'

/**
 * App mark: calendar outline + play cue (schedule / publish). Stroke frame reads at 16px.
 * Fallback when raster logo is not desired (e.g. tests).
 */
export function LogoMark({ className = 'w-9 h-9', title }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="4" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M11.25 13.25 16 16l-4.75 2.75v-5.5Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

const wordmarkTitle = 'LinkedPush'
const wordmarkSubtitle = 'Content Scheduler'

export default function AppLogo({ variant = 'sidebar', className = '' }) {
  if (variant === 'hero') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-white/20 shadow-sm backdrop-blur-sm">
          <img src={BRAND_LOGO_SRC} alt="" className="h-full w-full object-cover" width={40} height={40} />
        </div>
        <span className="text-xl font-semibold tracking-tight text-white/90">{wordmarkTitle}</span>
      </div>
    )
  }

  if (variant === 'iconOnly') {
    return (
      <div className={`flex h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-white/15 ${className}`}>
        <img src={BRAND_LOGO_SRC} alt="LinkedPush" className="h-full w-full object-cover" width={36} height={36} />
      </div>
    )
  }

  if (variant === 'loginDark') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="mb-3 flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl shadow-inner ring-2 ring-purple/35 sm:h-16 sm:w-16 sm:rounded-[20px]">
          <img
            src={BRAND_LOGO_SRC}
            alt=""
            className="h-full w-full object-cover"
            width={64}
            height={64}
          />
        </div>
        <span className="text-2xl font-bold tracking-tight text-discord-text-primary">{wordmarkTitle}</span>
        <span className="mt-1 text-sm text-discord-text-secondary">{wordmarkSubtitle}</span>
      </div>
    )
  }

  if (variant === 'shellDark') {
    return (
      <NavLink
        to="/"
        end
        aria-label="LinkedPush home"
        className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl -mx-1 px-1 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] hover:bg-white/[0.04] ${className}`}
      >
        <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]">
          <img src={BRAND_LOGO_SRC} alt="" className="h-full w-full object-cover" width={40} height={40} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex flex-col">
            <span className="truncate text-[16px] font-bold leading-tight tracking-tight text-white">
              {wordmarkTitle}
            </span>
            <span className="truncate text-xs font-medium leading-tight tracking-wide text-white/60">
              {wordmarkSubtitle}
            </span>
          </div>
        </div>
      </NavLink>
    )
  }

  // sidebar (default): brand tile + wordmark, link to home
  return (
    <NavLink
      to="/"
      end
      aria-label="LinkedPush home"
      className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl -mx-1 px-1 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-accent ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-border transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]">
        <img src={BRAND_LOGO_SRC} alt="" className="h-full w-full object-cover" width={36} height={36} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-col">
          <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            {wordmarkTitle}
          </span>
          <span className="truncate text-[11px] leading-tight tracking-wide text-muted-foreground">
            {wordmarkSubtitle}
          </span>
        </div>
      </div>
    </NavLink>
  )
}
