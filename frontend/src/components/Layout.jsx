import { useState, useEffect } from 'react'
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PenSquare,
  Image,
  Menu,
  LogOut,
  Plus,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AppLogo from '@/components/AppLogo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import NotificationBell from '@/components/NotificationBell'

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/compose', icon: PenSquare, label: 'Compose', end: false },
  { to: '/app/media', icon: Image, label: 'Media', end: false },
]

function SidebarNav({ scheduledCount, onNavClick, currentPath }) {
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      <div className="px-3 pb-2 pt-1">
        <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
          Menu
        </span>
      </div>
      {navItems.map(({ to, icon: Icon, label, end }) => {
        const isActive = end ? currentPath === to : currentPath.startsWith(to)
        return (
        <Tooltip key={to} delayDuration={400}>
          <TooltipTrigger asChild>
            <NavLink
              to={to}
              end={end}
              onClick={onNavClick}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[14px] font-semibold tracking-[0.01em] transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-purple/25 to-purple/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-purple/35'
                  : 'text-white/65 hover:bg-white/[0.06] hover:text-white hover:ring-1 hover:ring-white/10'
              )}
            >
              {isActive && (
                <span className="absolute left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-purple shadow-[0_0_12px_rgba(124,58,237,0.65)]" />
              )}
              <div
                className={cn(
                  'rounded-xl p-2 transition-colors',
                  isActive
                    ? 'bg-purple/25 text-purple-light'
                    : 'bg-transparent group-hover:bg-white/[0.08] text-white/75 group-hover:text-white'
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.3 : 2} />
              </div>
              <span className="truncate">{label}</span>
              {label === 'Calendar' && scheduledCount > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-auto text-[10px] font-semibold px-1.5 py-0.5',
                    isActive
                      ? 'text-purple-light bg-purple/35 border-purple/30'
                      : 'text-purple bg-purple/20 border-purple/30'
                  )}
                >
                  {scheduledCount}
                </Badge>
              )}
              {isActive && (
                <ChevronRight size={16} className="ml-auto opacity-70" />
              )}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      )})}
    </nav>
  )
}

function SidebarContent({ user, initials, scheduledCount, logout, onNavClick, currentPath }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-5 sm:px-6 h-[70px] min-h-[70px] border-b border-white/10 shrink-0">
        <AppLogo variant="shellDark" homePath="/app" />
      </div>

      {/* Quick action */}
      <div className="px-4 pt-5 pb-2">
        <Button
          asChild
          className="w-full gap-2 rounded-xl bg-gradient-to-r from-purple to-[#A855F7] text-white hover:from-purple-dark hover:to-purple hover:shadow-md hover:shadow-purple/25 active:scale-[0.98] transition-all duration-200"
        >
          <NavLink to="/app/compose" onClick={onNavClick}>
            <Plus size={18} strokeWidth={2.6} />
            New Post
          </NavLink>
        </Button>
      </div>

      <Separator className="mx-4 mt-2 mb-0 w-auto bg-white/10" />

      {/* Navigation */}
      <SidebarNav scheduledCount={scheduledCount} onNavClick={onNavClick} currentPath={currentPath} />

      <Separator className="mx-4 w-auto bg-white/10" />

      {/* User section */}
      <div className="p-4 shrink-0">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.04]">
          <Avatar className="h-10 w-10 ring-1 ring-white/20">
            {user.avatar_url ? (
              <AvatarImage src={user.avatar_url} alt={user.name} />
            ) : null}
            <AvatarFallback className="gradient-purple text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-white truncate tracking-[0.01em]">
              {user.name}
            </div>
            <div className="text-[11px] font-medium text-white/50 truncate">
              {user.email || 'LinkedIn User'}
            </div>
          </div>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="h-8 w-8 rounded-lg text-white/55 hover:text-red-300 hover:bg-red-500/15"
              >
                <LogOut size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconRailNav({ scheduledCount, currentPath }) {
  return (
    <nav className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto">
      {navItems.map(({ to, icon: Icon, label, end }) => {
        const isActive = end ? currentPath === to : currentPath.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={cn(
              'relative flex flex-col items-center justify-center w-14 py-2 rounded-xl transition-all duration-200 gap-1',
              isActive
                ? 'bg-white text-black'
                : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function IconRailContent({ user, initials, scheduledCount, logout, currentPath, onExpand }) {
  return (
    <div className="flex flex-col items-center h-full py-3">
      {/* Logo icon */}
      <div className="flex items-center justify-center h-12 mb-2">
        <NavLink to="/app" className="flex items-center justify-center w-9 h-9">
          <AppLogo variant="iconOnly" />
        </NavLink>
      </div>

      <Separator className="w-6 bg-white/10 my-1" />

      {/* Navigation */}
      <IconRailNav scheduledCount={scheduledCount} currentPath={currentPath} />

      <Separator className="w-6 bg-white/10 my-1" />

      {/* Expand toggle */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExpand}
            className="w-10 h-10 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] mb-1"
          >
            <PanelLeft size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Expand sidebar</TooltipContent>
      </Tooltip>

      {/* User avatar */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">
            <Avatar className="h-9 w-9 ring-1 ring-white/20">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user.name} />
              ) : null}
              <AvatarFallback className="gradient-purple text-white text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </TooltipContent>
      </Tooltip>

      {/* Logout */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="w-10 h-10 rounded-xl text-white/40 hover:text-red-300 hover:bg-red-500/15 mt-1"
          >
            <LogOut size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Logout</TooltipContent>
      </Tooltip>
    </div>
  )
}

export default function Layout() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [scheduledCount, setScheduledCount] = useState(0)
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!user) return
    fetch('/api/posts?status=scheduled', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const posts = Array.isArray(data) ? data : data.posts || []
        setScheduledCount(posts.length)
      })
      .catch(() => setScheduledCount(0))
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  const currentPage = navItems.find(item => {
    if (item.end) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  })

  const closeMobileNav = () => setSheetOpen(false)

  return (
    <TooltipProvider>
      <div className="lp-shell flex h-screen">
        {/* Desktop sidebar — collapsed icon rail or expanded */}
        <aside
          className={cn(
            'hidden lg:flex flex-col bg-[#111111] border-r border-white/10 transition-all duration-300',
            sidebarCollapsed ? 'w-[76px]' : 'w-[272px]'
          )}
        >
          {sidebarCollapsed ? (
            <IconRailContent
              user={user}
              initials={initials}
              scheduledCount={scheduledCount}
              logout={logout}
              currentPath={location.pathname}
              onExpand={() => setSidebarCollapsed(false)}
            />
          ) : (
            <>
              <SidebarContent
                user={user}
                initials={initials}
                scheduledCount={scheduledCount}
                logout={logout}
                onNavClick={undefined}
                currentPath={location.pathname}
              />
              <div className="px-4 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(true)}
                  className="w-full gap-2 text-white/40 hover:text-white hover:bg-white/[0.06] text-xs"
                >
                  <PanelLeftClose size={14} />
                  Collapse
                </Button>
              </div>
            </>
          )}
        </aside>

        {/* Mobile sidebar via Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="left"
            className="w-[272px] p-0 sm:max-w-[272px] [&>button]:hidden bg-[#111111] border-r border-white/10"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              user={user}
              initials={initials}
              scheduledCount={scheduledCount}
              logout={logout}
              onNavClick={closeMobileNav}
              currentPath={location.pathname}
            />
          </SheetContent>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <header className="h-16 bg-[#111111]/90 backdrop-blur-md border-b border-white/10 flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-10">
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden -ml-1 text-white/70 hover:text-white hover:bg-white/[0.06]"
                >
                  <Menu size={22} />
                </Button>
              </SheetTrigger>

              {/* Page title */}
              <div className="hidden lg:flex items-center gap-2 ml-0">
                {currentPage && (
                  <>
                    <currentPage.icon size={20} className="text-purple" />
                    <h1 className="lp-heading-strong text-[17px] text-white">
                      {currentPage.label}
                    </h1>
                  </>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                {/* Mobile user avatar */}
                <div className="lg:hidden ml-1">
                  <Avatar>
                    {user.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="gradient-purple text-white text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#0a0a0a]">
              <div
                className={cn(
                  'animate-fade-in-up flex min-h-0 w-full min-w-0 flex-1 flex-col',
                  'p-4 lg:p-5'
                )}
              >
                <Outlet />
              </div>
            </main>
          </div>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
