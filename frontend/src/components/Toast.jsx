import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle2, XCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastContext = createContext(null)

const toastStyles = {
  success: {
    container: 'border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-400',
    iconWrap: 'bg-emerald-50 dark:bg-emerald-950/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
  },
  info: {
    container: 'border-blue-200/60 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-950/50 dark:text-blue-400',
    iconWrap: 'bg-blue-50 dark:bg-blue-950/50',
    icon: 'text-blue-500 dark:text-blue-400',
  },
  error: {
    container: 'border-red-200/60 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-950/50 dark:text-red-400',
    iconWrap: 'bg-red-50 dark:bg-red-950/50',
    icon: 'text-red-500 dark:text-red-400',
  },
}

const toastIcons = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type, removing: false }])
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === id ? { ...t, removing: true } : t))
      )
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 300)
    }, 4000)
  }, [])

  const removeToast = useCallback(id => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, removing: true } : t))
    )
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const style = toastStyles[toast.type] || toastStyles.info
          const Icon = toastIcons[toast.type] || Info

          return (
            <div
              key={toast.id}
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
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg hover:bg-accent shrink-0 ml-1 transition-colors"
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
