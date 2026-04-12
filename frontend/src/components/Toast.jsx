import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium animate-slide-in ${
              toast.type === 'success'
                ? 'bg-white border-green-200 text-green-700'
                : 'bg-white border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-500 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="p-0.5 rounded hover:bg-gray-100 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
