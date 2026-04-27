import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import IntegrationCard from './IntegrationCard'
import { useToast } from '@/components/Toast'

const LINKEDIN_BRAND = '#0A66C2'

const SCOPE_LABELS = {
  'w_member_social': 'Post on your behalf',
  'openid': 'Sign-in (identity)',
  'profile': 'Access your profile info',
  'email': 'Access your email address',
}

function LinkedInGlyph({ size = 20, color = LINKEDIN_BRAND, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      className={className}
    >
      <path d="M20.45 20.45h-3.555v-5.57c0-1.328-.027-3.037-1.852-3.037-1.852 0-2.135 1.447-2.135 2.94v5.667H9.354V9h3.414v1.561h.05c.476-.9 1.637-1.852 3.37-1.852 3.602 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 110-4.126 2.063 2.063 0 010 4.126zM7.119 20.45H3.554V9h3.565v11.45zM22.227 0H1.77C.792 0 0 .775 0 1.732v20.536C0 23.225.792 24 1.77 24h20.454C23.2 24 24 23.225 24 22.268V1.732C24 .775 23.2 0 22.226 0h.001z" />
    </svg>
  )
}

/**
 * Normalize an arbitrary user payload to the LinkedIn connection shape.
 * Falls back to legacy `has_linkedin_token` if the backend hasn't shipped
 * `linkedin_connection` yet.
 */
function normalizeConnection(me) {
  if (!me) return null
  if (me.linkedin_connection !== undefined) {
    return me.linkedin_connection // may be null explicitly
  }
  return me.has_linkedin_token ? { status: 'active', expires_at: null, scopes: '' } : null
}

function daysUntil(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000))
}

function formatExpiry(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

function StatusBadge({ tone, label, icon: Icon }) {
  const toneClass = {
    success:
      'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    error: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    muted: 'border-white/10 bg-white/[0.04] text-white/60',
  }[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        toneClass
      )}
    >
      {Icon && <Icon size={11} strokeWidth={2.5} />}
      {label}
    </span>
  )
}

export default function LinkedInCard() {
  const toastCtx = useToast()
  const showToast = toastCtx?.addToast
  const [connection, setConnection] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showScopeDetails, setShowScopeDetails] = useState(false)

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const me = await res.json()
      setConnection(normalizeConnection(me))
      setFetchError(null)
    } catch (err) {
      // Graceful fallback: treat as "not connected" but surface the error state.
      setConnection(null)
      setFetchError(err?.message || 'Unable to load connection status')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadMe()
      if (!cancelled) setInitialLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadMe])

  // Re-fetch whenever the tab becomes visible so returning from the LinkedIn
  // OAuth redirect (or a long idle) reflects the freshest connection state.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        loadMe()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [loadMe])

  const view = useMemo(() => {
    if (!connection) {
      return { kind: 'disconnected' }
    }
    const { status, expires_at: expiresAt } = connection
    if (status === 'active') {
      const days = daysUntil(expiresAt)
      if (days != null && days <= 7) {
        return { kind: 'expiring', days, expiresAt }
      }
      return { kind: 'connected', days, expiresAt }
    }
    // revoked / expired / anything unknown but present
    return { kind: 'broken', status }
  }, [connection])

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/auth/linkedin/login', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      const msg = data.detail || 'Unable to start LinkedIn connection. Please try again.'
      showToast?.(msg, 'error')
      setConnecting(false)
    } catch {
      showToast?.('Network error starting LinkedIn connection.', 'error')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/linkedin/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast?.(data.detail || 'Failed to disconnect LinkedIn.', 'error')
      } else {
        showToast?.('LinkedIn disconnected.', 'success')
        await loadMe()
      }
    } catch {
      showToast?.('Network error while disconnecting.', 'error')
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  const logo = <LinkedInGlyph size={22} />


  // Shared loading state
  if (initialLoading) {
    return (
      <IntegrationCard
        logo={logo}
        name="LinkedIn"
        description="Checking connection…"
        accentColor={LINKEDIN_BRAND}
        actions={<Loader2 className="h-4 w-4 animate-spin text-white/50" />}
      />
    )
  }

  // Build the card by state.
  let statusBadge = null
  let description = null
  let actions = null
  let body = null

  const scopes = connection?.scopes

  if (view.kind === 'disconnected') {
    statusBadge = <StatusBadge tone="muted" label="Not connected" />
    description = 'Connect your LinkedIn account to publish posts.'
    actions = (
      <Button
        onClick={handleConnect}
        disabled={connecting}
        className="gap-2 rounded-lg text-white"
        style={{ backgroundColor: LINKEDIN_BRAND }}
      >
        {connecting ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <LinkedInGlyph size={15} color="#ffffff" />
        )}
        Connect LinkedIn
      </Button>
    )
    if (fetchError) {
      body = (
        <p className="text-xs text-amber-200/80">
          Couldn&apos;t load status from backend ({fetchError}). Showing not-connected as a safe fallback.
        </p>
      )
    }
  } else if (view.kind === 'connected') {
    statusBadge = <StatusBadge tone="success" icon={Check} label="Connected" />
    description = view.expiresAt
      ? `Token valid through ${formatExpiry(view.expiresAt)}.`
      : 'LinkedIn account is connected and healthy.'
    actions = (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleConnect}
          disabled={connecting}
          className="gap-1.5 rounded-lg border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw size={14} strokeWidth={2} />
          Reconnect
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="gap-1.5 rounded-lg text-rose-200/90 hover:bg-rose-500/10 hover:text-rose-100"
        >
          <Unplug size={14} strokeWidth={2} />
          Disconnect
        </Button>
      </>
    )
    if (scopes) {
      const scopeList = scopes.split(/[ ,]+/).filter(Boolean)
      const hasPublishingScope = scopeList.includes('w_member_social')
      const authScopes = scopeList.filter(s => s !== 'w_member_social')

      body = (
        <div className="flex flex-col gap-2">
          {hasPublishingScope && (
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-400/70" strokeWidth={2.5} />
              <span className="text-[12px] font-medium text-white/75">
                Can post and comment on your behalf
              </span>
            </div>
          )}
          {authScopes.length > 0 && (
            <p className="text-[11px] text-white/35">
              Identity: sign-in, profile, and email access
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowScopeDetails(v => !v)}
            className="flex items-center gap-1 cursor-pointer text-[11px] text-white/30 hover:text-white/50 transition-colors"
          >
            <ChevronDown
              size={10}
              strokeWidth={2}
              className={cn('transition-transform', showScopeDetails && 'rotate-180')}
            />
            {showScopeDetails ? 'Hide' : 'Show'} technical details
          </button>
          {showScopeDetails && (
            <div className="flex flex-wrap items-center gap-1.5">
              {scopeList.map(s => (
                <span
                  key={s}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-mono text-white/65"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )
    }
  } else if (view.kind === 'expiring') {
    statusBadge = (
      <StatusBadge
        tone="warn"
        icon={AlertCircle}
        label={view.days === 0 ? 'Expires today' : `Expires in ${view.days}d`}
      />
    )
    description = view.expiresAt
      ? `Reconnect before ${formatExpiry(view.expiresAt)} to keep publishing.`
      : 'Your LinkedIn token is about to expire.'
    actions = (
      <>
        <Button
          onClick={handleConnect}
          disabled={connecting}
          className="gap-2 rounded-lg text-white"
          style={{ backgroundColor: LINKEDIN_BRAND }}
        >
          {connecting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} strokeWidth={2.2} />
          )}
          Reconnect
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="gap-1.5 rounded-lg text-rose-200/90 hover:bg-rose-500/10 hover:text-rose-100"
        >
          <Unplug size={14} strokeWidth={2} />
          Disconnect
        </Button>
      </>
    )
  } else {
    // broken: revoked / expired / unknown
    const label = view.status === 'revoked' ? 'Revoked' : view.status === 'expired' ? 'Expired' : 'Error'
    statusBadge = <StatusBadge tone="error" icon={AlertCircle} label={label} />
    description = 'LinkedPush cannot publish until you reconnect your LinkedIn account.'
    actions = (
      <Button
        onClick={handleConnect}
        disabled={connecting}
        className="gap-2 rounded-lg text-white"
        style={{ backgroundColor: LINKEDIN_BRAND }}
      >
        {connecting ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <RefreshCw size={15} strokeWidth={2.2} />
        )}
        Reconnect LinkedIn
      </Button>
    )
  }

  return (
    <>
      <IntegrationCard
        logo={logo}
        name="LinkedIn"
        description={description}
        statusBadge={statusBadge}
        actions={actions}
        accentColor={LINKEDIN_BRAND}
      >
        {body}
      </IntegrationCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-[#141414] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect LinkedIn?</DialogTitle>
            <DialogDescription className="text-white/60">
              You&apos;ll stop being able to publish until you reconnect. Scheduled
              posts that haven&apos;t shipped yet will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={disconnecting}
              className="text-white/70 hover:bg-white/[0.06] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2 bg-rose-500 text-white hover:bg-rose-600"
            >
              {disconnecting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Unplug size={15} strokeWidth={2.2} />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
