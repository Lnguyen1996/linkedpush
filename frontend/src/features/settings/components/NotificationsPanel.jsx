import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Mail } from 'lucide-react'
import IntegrationCard from './IntegrationCard'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/utils'

const DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

function Toggle({ checked, onChange, disabled, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-white/80">{label}</p>
        {description && (
          <p className="mt-0.5 text-[12px] text-white/40">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50',
          checked ? 'bg-purple' : 'bg-white/15'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

export default function NotificationsPanel({ panelId, labelledBy }) {
  const toastCtx = useToast()
  const showToast = toastCtx?.addToast

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    emailEnabled: false,
    postPublishedEmail: false,
    postFailedEmail: true,
    weeklyDigestEmail: true,
    weeklyDigestDay: 'monday',
    digestTimeOfDay: '09:00',
  })

  const loadPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const data = await res.json()
      setForm({
        emailEnabled: data.email_enabled ?? false,
        postPublishedEmail: data.post_published_email ?? false,
        postFailedEmail: data.post_failed_email ?? true,
        weeklyDigestEmail: data.weekly_digest_email ?? true,
        weeklyDigestDay: data.weekly_digest_day ?? 'monday',
        digestTimeOfDay: data.digest_time_of_day ?? '09:00',
      })
    } catch (err) {
      showToast?.('Failed to load notification preferences.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      showToast?.('Notification preferences saved.', 'success')
    } catch {
      showToast?.('Failed to save preferences.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={labelledBy}
        className="flex flex-col gap-6"
      >
        <div>
          <h2 className="text-[15px] font-semibold text-white">Notification preferences</h2>
          <p className="mt-1 text-sm text-white/55">
            Configure how you receive notifications from LinkedPush.
          </p>
        </div>
        <IntegrationCard
          logo={<Bell size={22} className="text-purple" />}
          name="Notifications"
          description="Loading…"
          accentColor="#a855f7"
          actions={<Loader2 className="h-4 w-4 animate-spin text-white/50" />}
        />
      </section>
    )
  }

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-[15px] font-semibold text-white">Notification preferences</h2>
        <p className="mt-1 text-sm text-white/55">
          Configure how you receive notifications from LinkedPush.
        </p>
      </div>

      <IntegrationCard
        logo={<Mail size={22} className="text-purple" />}
        name="Email notifications"
        description={form.emailEnabled ? 'Email notifications are enabled.' : 'Email notifications are disabled.'}
        accentColor="#a855f7"
      >
        <div className="flex flex-col gap-5">
          <Toggle
            label="Email notifications"
            description="Receive notifications via email."
            checked={form.emailEnabled}
            onChange={v => setField('emailEnabled', v)}
          />

          {form.emailEnabled && (
            <div className="flex flex-col gap-4 pl-2 border-l-2 border-purple/20">
              <Toggle
                label="Post published"
                description="Notify me when a post is successfully published."
                checked={form.postPublishedEmail}
                onChange={v => setField('postPublishedEmail', v)}
                disabled={!form.emailEnabled}
              />

              <Toggle
                label="Post failed"
                description="Alert me when a post fails to publish (urgent)."
                checked={form.postFailedEmail}
                onChange={v => setField('postFailedEmail', v)}
                disabled={!form.emailEnabled}
              />

              <Toggle
                label="Weekly digest"
                description="Send me a weekly summary of my posts."
                checked={form.weeklyDigestEmail}
                onChange={v => setField('weeklyDigestEmail', v)}
                disabled={!form.emailEnabled}
              />

              {form.weeklyDigestEmail && (
                <div className="flex flex-col sm:flex-row gap-3 pl-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="digest-day"
                      className="text-[12px] text-white/50 font-medium"
                    >
                      Day
                    </label>
                    <select
                      id="digest-day"
                      value={form.weeklyDigestDay}
                      onChange={e => setField('weeklyDigestDay', e.target.value)}
                      disabled={!form.emailEnabled || !form.weeklyDigestEmail}
                      className="h-9 rounded-lg border border-white/10 bg-white/4 px-3 text-[13px] text-white/80 outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 disabled:opacity-50 cursor-pointer"
                    >
                      {DAYS.map(d => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="digest-time"
                      className="text-[12px] text-white/50 font-medium"
                    >
                      Time (UTC)
                    </label>
                    <input
                      id="digest-time"
                      type="time"
                      value={form.digestTimeOfDay}
                      onChange={e => setField('digestTimeOfDay', e.target.value)}
                      disabled={!form.emailEnabled || !form.weeklyDigestEmail}
                      className="h-9 rounded-lg border border-white/10 bg-white/4 px-3 text-[13px] text-white/80 outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </IntegrationCard>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 rounded-lg bg-purple text-white hover:bg-purple-dark disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save
        </Button>
      </div>
    </section>
  )
}