import { useState } from 'react'
import { Save, Calendar, Send, Zap, Loader2, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function ActionBar({
  saving,
  publishing,
  showSchedule,
  scheduledDate,
  scheduledTime,
  onSaveDraft,
  onShowSchedule,
  onSchedule,
  onPublish,
  canDelete = false,
  deleting = false,
  postStatus,
  onDelete,
  onPreview,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isPublishing = postStatus === 'publishing'
  const deleteDisabled = deleting || isPublishing

  async function handleConfirmDelete() {
    if (!onDelete) return
    await onDelete()
    setConfirmOpen(false)
  }

  return (
    <>
      <Separator />
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteDisabled}
              title={isPublishing ? "Can't delete while publishing." : undefined}
              className="text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200"
            >
              {deleting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          {onPreview && (
            <Button
              variant="ghost"
              onClick={onPreview}
              className="text-white/70 hover:bg-white/[0.06] hover:text-white"
            >
              <Eye size={15} />
              Preview
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!showSchedule ? (
            <Button variant="purple" onClick={onShowSchedule}>
              <Calendar size={15} />
              Schedule
            </Button>
          ) : (
            <Button variant="purple" onClick={onSchedule} disabled={saving || !scheduledDate || !scheduledTime}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {saving ? 'Scheduling...' : 'Schedule Post'}
            </Button>
          )}
          <Separator orientation="vertical" className="h-5" />
          <Button
            onClick={onPublish}
            disabled={publishing || saving}
            className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md hover:shadow-emerald-500/15"
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {publishing ? 'Publishing...' : 'Publish Now'}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-white/55 text-center">
        Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/70 font-mono text-[10px]">Cmd+Enter</kbd> to quick-save as draft
      </p>

      {canDelete && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="border-white/10 bg-[#141414] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this post?</DialogTitle>
              <DialogDescription className="text-white/60">
                This will permanently delete the post. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="gap-2 bg-rose-500 text-white hover:bg-rose-600"
              >
                {deleting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} strokeWidth={2.2} />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
