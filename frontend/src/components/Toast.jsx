import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastContext = createContext(null)

const toastStyles = {
  success: {
    container: 'border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-400',
    iconWrap: 'bg-emerald-50 dark:bg-emerald-950/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
    action: 'bg-emerald-500 text-white hover:bg-emerald-400 focus-visible:ring-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400',
  },
  info: {
    container: 'border-blue-200/60 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-950/50 dark:text-blue-400',
    iconWrap: 'bg-blue-50 dark:bg-blue-950/50',
    icon: 'text-blue-500 dark:text-blue-400',
    action: 'bg-blue-500 text-white hover:bg-blue-400 focus-visible:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-400',
  },
  warning: {
    container: 'border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/50 dark:text-amber-300',
    iconWrap: 'bg-amber-50 dark:bg-amber-950/50',
    icon: 'text-amber-500 dark:text-amber-400',
    action: 'bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400',
  },
  error: {
    container: 'border-red-200/60 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-950/50 dark:text-red-400',
    iconWrap: 'bg-red-50 dark:bg-red-950/50',
    icon: 'text-red-500 dark:text-red-400',
    action: 'bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-300 dark:bg-rose-500 dark:hover:bg-rose-400',
  },
}

const toastIcons = {
  success: CheckCircle2,
  info: Info,
  warning: Info,
  error: XCircle,
}

const DEFAULT_DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, removing: true } : t))
    )
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  const addToast = useCallback((message, type = 'success', options = {}) => {
    const id = Date.now() + Math.random()
    const { duration = DEFAULT_DURATION, action } = options || {}

    let normalizedAction = null
    if (action && action.label) {
      if (action.onClick && action.to && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[Toast] action provided both `onClick` and `to`; `onClick` takes precedence.')
      }
      normalizedAction = {
        label: action.label,
        onClick: action.onClick || null,
        to: action.onClick ? null : (action.to || null),
      }
    }

    setToasts(prev => [
      ...prev,
      { id, message, type, action: normalizedAction, removing: false },
    ])

    const isSticky = duration === 0 || duration === Infinity
    if (!isSticky) {
      setTimeout(() => {
        setToasts(prev =>
          prev.map(t => (t.id === id ? { ...t, removing: true } : t))
        )
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, 300)
      }, duration)
    }

    return id
  }, [])

  // Backwards-compat alias.
  const removeToast = dismiss

  return (
    <ToastContext.Provider value={{ addToast, dismiss, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const style = toastStyles[toast.type] || toastStyles.info
          const Icon = toastIcons[toast.type] || Info

          const actionClass = cn(
            'inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
            style.action,
          )

          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-lg shadow-black/[0.08] border text-sm font-medium backdrop-blur-sm transition-all duration-300',
                style.container,
                toast.removing
                  ? 'translate-x-[calc(100%+1.5rem)] opacity-0'
                  : 'animate-in slide-in-from-right-full fade-in-0 duration-300'
              )}
            >
              <div className={cn('p-1 rounded-lg', style.iconWrap)}>
                <Icon size={15} className={cn('shrink-0', style.icon)} />
              </div>
              <span className="text-foreground">{toast.message}</span>
              {toast.action && toast.action.onClick && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      toast.action.onClick()
                    } finally {
                      dismiss(toast.id)
                    }
                  }}
                  className={actionClass}
                >
                  {toast.action.label}
                </button>
              )}
              {toast.action && toast.action.to && !toast.action.onClick && (
                <Link
                  to={toast.action.to}
                  onClick={() => dismiss(toast.id)}
                  className={actionClass}
                >
                  {toast.action.label}
                </Link>
              )}
              <button
                onClick={() => dismiss(toast.id)}
                className="p-1 rounded-lg hover:bg-accent shrink-0 ml-1 transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
