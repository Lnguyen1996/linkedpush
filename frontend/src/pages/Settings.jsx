import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plug, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import LinkedInCard from '@/features/settings/components/LinkedInCard'
import NotificationsPanel from '@/features/settings/components/NotificationsPanel'
import AccountPanel from '@/features/settings/components/AccountPanel'

const TABS = [
  { id: 'integrations', label: 'Integrations', icon: Plug, available: true },
  { id: 'account', label: 'Account', icon: UserIcon, available: true },
  { id: 'notifications', label: 'Notifications', available: true },
]

// Build tab/panel id pairs so aria-controls and id actually match up.
function tabId(id) {
  return `settings-tab-${id}`
}
function panelId(id) {
  return `settings-panel-${id}`
}

export default function Settings() {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = TABS.find(t => t.id === tabParam && t.available)?.id ?? 'integrations'
  const [activeTab, setActiveTab] = useState(initialTab)
  const tabRefs = useRef({})

  // APG tablist keyboard model: Left/Right + Up/Down cycle through available
  // tabs, Home/End jump to first/last. Skips `!available` tabs so focus and
  // activation stay consistent. Activation-follows-focus matches the existing
  // click-to-activate behavior.
  function handleTabsKeyDown(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const enabled = TABS.filter(t => t.available)
    if (enabled.length === 0) return
    const currentIdx = enabled.findIndex(t => t.id === activeTab)
    let nextIdx = currentIdx
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (currentIdx - 1 + enabled.length) % enabled.length
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (currentIdx + 1) % enabled.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = enabled.length - 1
    }
    if (nextIdx === currentIdx) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    const nextId = enabled[nextIdx].id
    setActiveTab(nextId)
    // Move DOM focus to the newly selected tab so screen reader announces it.
    const nextEl = tabRefs.current[nextId]
    if (nextEl && typeof nextEl.focus === 'function') nextEl.focus()
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="lp-heading-strong text-2xl text-white tracking-[-0.02em]">
          Settings
        </h1>
        <p className="text-sm text-white/55">
          Manage integrations, preferences, and account details for your workspace.
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/[0.08]">
        <div
          className="flex gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={handleTabsKeyDown}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            const disabled = !tab.available
            return (
              <button
                key={tab.id}
                ref={el => {
                  if (el) tabRefs.current[tab.id] = el
                  else delete tabRefs.current[tab.id]
                }}
                id={tabId(tab.id)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId(tab.id)}
                aria-disabled={disabled}
                disabled={disabled}
                tabIndex={isActive ? 0 : -1}
                onClick={() => tab.available && setActiveTab(tab.id)}
                className={cn(
                  'relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-purple text-white'
                    : 'border-transparent text-white/50 hover:text-white/80',
                  disabled && 'cursor-not-allowed opacity-50 hover:text-white/50'
                )}
              >
                {tab.icon && <tab.icon size={14} strokeWidth={2} />}
                <span>{tab.label}</span>
                {disabled && (
                  <span className="ml-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/45">
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel */}
      {activeTab === 'integrations' && (
        <section
          id={panelId('integrations')}
          role="tabpanel"
          aria-labelledby={tabId('integrations')}
          className="flex flex-col gap-4"
        >
          <div>
            <h2 className="text-[15px] font-semibold text-white">Connected services</h2>
            <p className="mt-1 text-sm text-white/55">
              Services you've connected to LinkedPush. Sign-in is handled by Google — these
              integrations unlock publishing.
            </p>
          </div>
          <LinkedInCard />
        </section>
      )}

      {activeTab === 'account' && (
        <AccountPanel
          panelId={panelId('account')}
          labelledBy={tabId('account')}
        />
      )}

      {activeTab === 'notifications' && (
        <NotificationsPanel
          panelId={panelId('notifications')}
          labelledBy={tabId('notifications')}
        />
      )}
    </div>
  )
}
