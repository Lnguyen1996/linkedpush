import { Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONES = [
  { value: 'professional', label: 'Professional', emoji: '\uD83D\uDCBC' },
  { value: 'casual', label: 'Casual', emoji: '\uD83D\uDE42' },
  { value: 'storytelling', label: 'Story', emoji: '\uD83D\uDCD6' },
]

export default function AiComposeModal({
  open,
  onOpenChange,
  topic,
  setTopic,
  tone,
  setTone,
  onGenerate,
  generating,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader className="border-b border-white/10 -m-4 mb-0 p-4 rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <DialogTitle>AI Caption Assistant</DialogTitle>
              <DialogDescription>Powered by Claude</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Topic / Idea
            </Label>
            <Textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Describe what you want to post about..."
              rows={3}
              className="resize-none focus-visible:border-purple/60 focus-visible:ring-[3px] focus-visible:ring-purple/20"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Tone
            </Label>
            <div className="flex gap-2">
              {TONES.map(t => (
                <Button
                  key={t.value}
                  variant={tone === t.value ? 'secondary' : 'ghost'}
                  onClick={() => setTone(t.value)}
                  className={cn(
                    'flex-1',
                    tone === t.value && 'bg-purple/20 text-purple-200 border border-purple/30'
                  )}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <Button
            onClick={onGenerate}
            disabled={!topic.trim() || generating}
            variant="purple"
            className="w-full"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Generating...' : 'Generate Caption'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
