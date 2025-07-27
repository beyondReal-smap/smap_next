'use client'

import { Suspense, lazy, ComponentType, ReactNode } from 'react'

// 개선된 로딩 스켈레톤 컴포넌트들 - CLS 방지
export function CardSkeleton() {
  return (
    <div className="skeleton prevent-layout-shift">
      <div className="bg-gray-200 rounded-lg h-48 mb-4 card-component"></div>
      <div className="space-y-2">
        <div className="bg-gray-200 rounded h-4 w-3/4"></div>
        <div className="bg-gray-200 rounded h-4 w-1/2"></div>
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 prevent-layout-shift">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton flex items-center space-x-4 list-item">
          <div className="bg-gray-200 rounded-full h-12 w-12 avatar-container flex-shrink-0"></div>
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
    <div className="skeleton prevent-layout-shift">
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
    <div className="skeleton space-y-4 prevent-layout-shift">
      <div className="bg-gray-200 rounded h-10 button-fixed"></div>
      <div className="bg-gray-200 rounded h-10 button-fixed"></div>
      <div className="bg-gray-200 rounded h-32"></div>
      <div className="bg-gray-200 rounded h-10 button-fixed"></div>
    </div>
  )
}

// 개선된 지연 로딩 고차 컴포넌트
export function withLazyLoading<T extends ComponentType<any>>(
  ComponentToLoad: () => Promise<{ default: T }>,
  LoadingSkeleton: ComponentType = () => <div className="skeleton h-32 bg-gray-200 rounded prevent-layout-shift"></div>
) {
  const LazyComponent = lazy(ComponentToLoad)
  
  return function WrappedComponent(props: any) {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// 이미지 지연 로딩 최적화
export function ImagePlaceholder({ 
  width, 
  height, 
  aspectRatio = 1,
  className = "" 
}: { 
  width?: number; 
  height?: number; 
  aspectRatio?: number;
  className?: string;
}) {
  return (
    <div 
      className={`skeleton image-container ${className}`}
      style={{
        width: width || 'auto',
        height: height || 'auto',
        aspectRatio: `${aspectRatio}`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          className="w-8 h-8 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    </div>
  )
}

// 성능 모니터링 컴포넌트
export function PerformanceOptimizer({ children }: { children: ReactNode }) {
  return (
    <div className="prevent-layout-shift">
      {children}
    </div>
  )
} 