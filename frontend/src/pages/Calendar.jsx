import { CalendarDays } from 'lucide-react'

export default function Calendar() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays size={24} className="text-linkedin" />
        <h1 className="text-2xl font-semibold text-dark">Calendar</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        <p>Calendar view will be implemented here.</p>
      </div>
    </div>
  )
}
