'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', hapticType, onClick, children, ...props }, ref) => {
    const { haptic } = useHapticFeedback()

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // 햅틱 피드백 실행
      if (hapticType) {
        haptic[hapticType]()
      } else {
        // 기본 햅틱은 variant에 따라 결정
        switch (variant) {
          case 'success':
            haptic.success()
            break
          case 'warning':
            haptic.warning()
            break
          case 'error':
            haptic.error()
            break
          case 'primary':
            haptic.medium()
            break
          default:
            haptic.light()
            break
        }
      }

      // 원래 onClick 핸들러 실행
      onClick?.(event)
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
          {
            // variant styles
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'bg-green-600 text-white hover:bg-green-700': variant === 'success',
            'bg-yellow-600 text-white hover:bg-yellow-700': variant === 'warning',
            'bg-red-600 text-white hover:bg-red-700': variant === 'error',
            
            // size styles
            'h-9 px-3': size === 'sm',
            'h-10 py-2 px-4': size === 'md',
            'h-11 px-8': size === 'lg',
          },
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button } 