import { NavLink } from 'react-router-dom'

/** SVG brand mark — purple gradient tile with abstract forward symbol */
export function BrandMark({ className = 'w-9 h-9' }) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="lp-bg" x1="44" y1="40" x2="468" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#11001F" />
          <stop offset="52%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#D20FA9" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#lp-bg)" />
      <g fill="white">
        <path d="M 132 271 L 252 175 L 252 388 Z" />
        <path d="M 272 189 L 380 137 L 380 312 L 272 364 Z" />
        <path d="M 398 176 L 398 324 L 319 364 L 319 390 L 438 330 L 438 145 Z" />
      </g>
    </svg>
  )
}

/** Fallback: stroke-only logo mark for tests or monochrome contexts */
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
      <path d="M11.25 13.25 16 16l-4.75 2.75v-5.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

const wordmarkTitle = 'LinkedPush'
const wordmarkSubtitle = 'Content Scheduler'

export default function AppLogo({ variant = 'sidebar', className = '', homePath = '/' }) {
  if (variant === 'hero') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm">
          <BrandMark className="h-full w-full" />
        </div>
        <span className="text-xl font-semibold tracking-tight text-white/90">{wordmarkTitle}</span>
      </div>
    )
  }

  if (variant === 'iconOnly') {
    return (
      <div className={`flex h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm ${className}`}>
        <BrandMark className="h-full w-full" />
      </div>
    )
  }

  if (variant === 'loginDark') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="mb-3 flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-purple/20 sm:h-[72px] sm:w-[72px] sm:rounded-[20px]">
          <BrandMark className="h-full w-full" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-discord-text-primary">{wordmarkTitle}</span>
        <span className="mt-1 text-sm text-discord-text-secondary">{wordmarkSubtitle}</span>
      </div>
    )
  }

  if (variant === 'navMinimal') {
    return (
      <NavLink
        to={homePath}
        end
        aria-label="LinkedPush home"
        className={`inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-purple/50 rounded-md ${className}`}
      >
        <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-md">
          <BrandMark className="h-full w-full" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">{wordmarkTitle}</span>
      </NavLink>
    )
  }

  if (variant === 'shellDark') {
    return (
      <NavLink
        to={homePath}
        end
        aria-label="LinkedPush home"
        className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl -mx-1 px-1 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] hover:bg-white/[0.04] ${className}`}
      >
        <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]">
          <BrandMark className="h-full w-full" />
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
      to={homePath}
      end
      aria-label="LinkedPush home"
      className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl -mx-1 px-1 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-accent ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]">
        <BrandMark className="h-full w-full" />
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
