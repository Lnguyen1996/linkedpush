import { Clock, Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function ScheduleSection({
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  timezone,
  setTimezone,
}) {
  return (
    <Card className="border-white/10 animate-fade-in-up">
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={15} className="text-purple-300" />
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Schedule</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-white/55">Date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-white/55">Time</Label>
            <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-white/55">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full">
              <Globe size={14} className="text-white/55 mr-1.5" />
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {Intl.supportedValuesOf('timeZone').map(tz => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
