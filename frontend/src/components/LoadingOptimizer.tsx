'use client'

import { Suspense, lazy, ComponentType, ReactNode } from 'react'

// 로딩 스켈레톤 컴포넌트들
export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-gray-200 rounded-lg h-48 mb-4"></div>
      <div className="space-y-2">
        <div className="bg-gray-200 rounded h-4 w-3/4"></div>
        <div className="bg-gray-200 rounded h-4 w-1/2"></div>
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center space-x-4">
          <div className="bg-gray-200 rounded-full h-12 w-12"></div>
          <div className="flex-1 space-y-2">
            <div className="bg-gray-200 rounded h-4 w-3/4"></div>
            <div className="bg-gray-200 rounded h-4 w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="bg-gray-200 rounded h-8"></div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-gray-200 rounded h-10"></div>
      <div className="bg-gray-200 rounded h-10"></div>
      <div className="bg-gray-200 rounded h-24"></div>
      <div className="bg-gray-200 rounded h-10 w-32"></div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center space-x-4 mb-6">
        <div className="bg-gray-200 rounded-full h-20 w-20"></div>
        <div className="space-y-2">
          <div className="bg-gray-200 rounded h-6 w-32"></div>
          <div className="bg-gray-200 rounded h-4 w-24"></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-gray-200 rounded h-4 w-full"></div>
        <div className="bg-gray-200 rounded h-4 w-3/4"></div>
        <div className="bg-gray-200 rounded h-4 w-1/2"></div>
      </div>
    </div>
  )
}

// 지연 로딩 래퍼
interface LazyWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  delay?: number
}

export function LazyWrapper({ children, fallback, delay = 0 }: LazyWrapperProps) {
  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
    </div>
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {delay > 0 ? (
        <DelayedComponent delay={delay}>
          {children}
        </DelayedComponent>
      ) : (
        children
      )}
    </Suspense>
  )
}

// 지연 렌더링 컴포넌트
function DelayedComponent({ children, delay }: { children: ReactNode; delay: number }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  if (!show) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return <>{children}</>
}

// 동적 import 헬퍼
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ReactNode
) {
  const LazyComponent = lazy(importFn)
  
  return function WrappedComponent(props: any) {
    return (
      <LazyWrapper fallback={fallback}>
        <LazyComponent {...props} />
      </LazyWrapper>
    )
  }
}

// 인터섹션 옵저버를 활용한 지연 로딩
interface IntersectionLoaderProps {
  children: ReactNode
  fallback?: ReactNode
  rootMargin?: string
  threshold?: number
  once?: boolean
}

export function IntersectionLoader({
  children,
  fallback,
  rootMargin = '50px',
  threshold = 0.1,
  once = true
}: IntersectionLoaderProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            setHasLoaded(true)
            observer.disconnect()
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { rootMargin, threshold }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [rootMargin, threshold, once])

  const shouldRender = isVisible || hasLoaded

  return (
    <div ref={ref}>
      {shouldRender ? children : (fallback || <div className="h-32" />)}
    </div>
  )
}

// 프리로딩 헬퍼
export function preloadComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  // 컴포넌트를 미리 로드
  importFn()
}

// 리소스 프리로딩
export function preloadResource(href: string, as: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    document.head.appendChild(link)
  }
}

// 이미지 프리로딩
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

// 배치 프리로딩
export async function preloadImages(srcs: string[]): Promise<void> {
  const promises = srcs.map(preloadImage)
  await Promise.allSettled(promises)
}

// 스마트 로딩 훅
export function useSmartLoading(threshold = 3) {
  const [loadingCount, setLoadingCount] = useState(0)
  const [isOverloaded, setIsOverloaded] = useState(false)

  const startLoading = useCallback(() => {
    setLoadingCount(prev => {
      const newCount = prev + 1
      setIsOverloaded(newCount > threshold)
      return newCount
    })
  }, [threshold])

  const stopLoading = useCallback(() => {
    setLoadingCount(prev => {
      const newCount = Math.max(0, prev - 1)
      setIsOverloaded(newCount > threshold)
      return newCount
    })
  }, [threshold])

  return {
    loadingCount,
    isOverloaded,
    startLoading,
    stopLoading
  }
}

// 필요한 import 추가
import { useState, useEffect, useRef, useCallback } from 'react' 