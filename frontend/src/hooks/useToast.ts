import { useState, useCallback } from 'react'
import { useHapticFeedback } from './useHapticFeedback'

interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  haptic?: boolean
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const { haptic } = useHapticFeedback()

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    const { type = 'info', duration = 3000, haptic: useHaptic = true } = options
    
    // 햅틱 피드백 실행
    if (useHaptic) {
      switch (type) {
        case 'success':
          haptic.success()
          break
        case 'error':
          haptic.error()
          break
        case 'warning':
          haptic.warning()
          break
        default:
          haptic.light()
          break
      }
    }

    const id = Date.now().toString()
    const newToast: Toast = {
      id,
      message,
      type,
      duration
    }

    setToasts(prev => [...prev, newToast])

    // duration 후에 토스트 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, duration)
  }, [haptic])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return {
    toasts,
    showToast,
    removeToast,
    success: (message: string, options?: Omit<ToastOptions, 'type'>) => 
      showToast(message, { ...options, type: 'success' }),
    error: (message: string, options?: Omit<ToastOptions, 'type'>) => 
      showToast(message, { ...options, type: 'error' }),
    warning: (message: string, options?: Omit<ToastOptions, 'type'>) => 
      showToast(message, { ...options, type: 'warning' }),
    info: (message: string, options?: Omit<ToastOptions, 'type'>) => 
      showToast(message, { ...options, type: 'info' })
  }
} 