import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

/**
 * Confirmation dialog for permanent account deletion.
 *
 * Guards the Delete button behind TWO checks in a single input:
 *   1. The user's email (case-insensitive, trimmed).
 *   2. The literal word "DELETE" (exact case, case-sensitive).
 * Both must appear in the typed string. Email comparison stays
 * case-insensitive — display copy shows the canonical lowercase form.
 */
export default function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
  onConfirm,
  deleting,
}) {
  const [typed, setTyped] = useState('')

  // Reset the input whenever the dialog opens/closes so a previous attempt
  // doesn't pre-fill the field on reopen.
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const target = (email || '').trim().toLowerCase()
  // Require exactly two whitespace-separated tokens: the literal word
  // DELETE (exact case) and the user's email (case-insensitive). This
  // rejects substring attacks like "foo@bar DELETEXYZ".
  const tokens = typed.trim().split(/\s+/).filter(Boolean)
  const matches =
    target.length > 0 &&
    tokens.length === 2 &&
    tokens.includes('DELETE') &&
    tokens.some(t => t !== 'DELETE' && t.toLowerCase() === target)

  return (
    <Dialog open={open} onOpenChange={deleting ? undefined : onOpenChange}>
      <DialogContent className="border-white/10 bg-[#141414] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-200">Delete account?</DialogTitle>
          <DialogDescription className="text-white/60">
            This permanently deletes your account and all associated data —
            posts, drafts, scheduled content, media, and LinkedIn connection.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-[12px] font-medium text-white/65">
            Type your email{' '}
            <span className="font-mono text-rose-200/90">{email}</span>{' '}
            and the word{' '}
            <span className="font-mono text-rose-200/90">DELETE</span>{' '}
            (separated by a space) to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            disabled={deleting}
            onChange={e => setTyped(e.target.value)}
            placeholder={`${email} DELETE`}
            className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-rose-400/50 focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!matches || deleting}
            className="gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} strokeWidth={2.2} />
            )}
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
