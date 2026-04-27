import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/utils'
import { getProfileAvatarSrc } from '@/lib/avatar'
import DeleteAccountDialog from './DeleteAccountDialog'

function getInitials(name) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Account tab: profile (read-only), danger zone
 * (account deletion behind an email + DELETE-word confirmation).
 *
 * Relies on AuthContext — `user` for profile data and `deleteAccount` which
 * clears local state and SPA-navigates to /login?deleted=1 where Login.jsx
 * renders the durable success banner. We do NOT rely on a toast surviving the
 * navigation; the banner is the signal.
 */
export default function AccountPanel({ panelId, labelledBy } = {}) {
  const { user, deleteAccount } = useAuth()
  const toastCtx = useToast()
  const showToast = toastCtx?.addToast

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const abortRef = useRef(null)

  // Silence React 19 "fetch was not cancelled" warnings by aborting any
  // in-flight delete request when AccountPanel unmounts.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  if (!user) {
    // Layout guards this route, but be defensive.
    return null
  }

  const initials = getInitials(user.name)
  const avatarSrc = getProfileAvatarSrc(user)

  async function handleDelete() {
    setDeleting(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        credentials: 'include',
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data.detail ||
          data.message ||
          `Failed to delete account (status ${res.status}).`
        showToast?.(msg, 'error')
        setDeleting(false)
        return
      }
      // Success path: this component will unmount after navigation, so do NOT
      // reset `deleting` here. Hand off to AuthContext, which clears user and
      // SPA-navigates to /login?deleted=1 (the Login banner is the durable
      // "Account deleted" signal).
      setDeleteOpen(false)
      deleteAccount()
    } catch (err) {
      if (err?.name === 'AbortError') return
      showToast?.('Network error while deleting account.', 'error')
      setDeleting(false)
    }
  }

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-label={labelledBy ? undefined : 'Account'}
      aria-labelledby={labelledBy}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-[15px] font-semibold text-white">Account</h2>
        <p className="mt-1 text-sm text-white/55">
          Your profile and account lifecycle actions.
        </p>
      </div>

      {/* Profile card */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple/45 to-transparent"
        />
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 ring-1 ring-white/15">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={user.name || 'Profile'} />
            ) : null}
            <AvatarFallback className="gradient-purple text-white text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex flex-col">
            <div className="text-[14px] font-semibold text-white truncate">
              {user.name || 'LinkedPush User'}
            </div>
            <div className="text-[12px] text-white/55 truncate">
              {user.email || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-rose-300/80">
          Danger zone
        </h3>
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-rose-500/25 bg-rose-500/[0.03] p-5 sm:p-6',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10">
                <AlertTriangle size={20} className="text-rose-300" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-rose-100">
                  Delete account
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  Permanently delete your account and all your data (posts,
                  drafts, scheduled content, media, connections). This cannot
                  be undone.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
              <Button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={deleting}
                className="gap-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
              >
                <AlertTriangle size={14} strokeWidth={2.2} />
                Delete account
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        email={user.email || ''}
        deleting={deleting}
        onConfirm={handleDelete}
      />
    </section>
  )
}
