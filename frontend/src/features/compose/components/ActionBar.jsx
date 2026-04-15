import { Save, Calendar, Send, Zap, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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
}) {
  return (
    <>
      <Separator />
      <div className="flex items-center justify-between gap-3 pt-1">
        <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : 'Save Draft'}
        </Button>

        <div className="flex items-center gap-2">
          {!showSchedule ? (
            <Button onClick={onShowSchedule}>
              <Calendar size={15} />
              Schedule
            </Button>
          ) : (
            <Button onClick={onSchedule} disabled={saving || !scheduledDate || !scheduledTime}>
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

      <p className="text-[11px] text-muted-foreground text-center">
        Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Cmd+Enter</kbd> to quick-save as draft
      </p>
    </>
  )
}
