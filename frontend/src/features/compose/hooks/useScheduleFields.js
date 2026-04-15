import { useState } from 'react'

export default function useScheduleFields() {
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  function hydrateFromPost(post) {
    if (post.scheduled_at) {
      const dt = new Date(post.scheduled_at)
      setScheduledDate(dt.toISOString().split('T')[0])
      setScheduledTime(dt.toISOString().split('T')[1].slice(0, 5))
      setShowSchedule(true)
    }
    if (post.timezone) setTimezone(post.timezone)
  }

  function applyDateParam(dateParam) {
    setScheduledDate(dateParam)
    setScheduledTime(t => t || '09:00')
    setShowSchedule(true)
  }

  function toScheduledAtString() {
    if (!scheduledDate || !scheduledTime) return null
    return `${scheduledDate}T${scheduledTime}:00`
  }

  return {
    showSchedule,
    setShowSchedule,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    timezone,
    setTimezone,
    hydrateFromPost,
    applyDateParam,
    toScheduledAtString,
  }
}
