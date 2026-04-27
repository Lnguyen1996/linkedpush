import { ChevronDown, ChevronUp, MessageSquare, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export default function FirstCommentSection({ firstComment, setFirstComment, open, setOpen }) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-white/55 hover:bg-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={15} />
          <span>First Comment</span>
          {firstComment && <Check size={14} className="text-emerald-500" />}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 animate-fade-in">
          <Textarea
            placeholder="Write a comment to be auto-posted after your main post..."
            value={firstComment}
            onChange={(e) => setFirstComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </CardContent>
      )}
    </Card>
  )
}
