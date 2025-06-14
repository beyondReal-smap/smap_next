'use client'

import { useEffect, useState } from 'react'

interface PerformanceMetrics {
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  fid: number // First Input Delay
  cls: number // Cumulative Layout Shift
  ttfb: number // Time to First Byte
}

interface NetworkInfo {
  effectiveType: string
  downlink: number
  rtt: number
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // 개발 환경에서만 표시
    if (process.env.NODE_ENV !== 'development') return

    // 성능 메트릭 수집
    const collectMetrics = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      // Web Vitals 수집
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        
        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                setMetrics(prev => ({ ...prev!, fcp: entry.startTime }))
              }
              break
            case 'largest-contentful-paint':
              setMetrics(prev => ({ ...prev!, lcp: entry.startTime }))
              break
            case 'first-input':
              setMetrics(prev => ({ ...prev!, fid: (entry as any).processingStart - entry.startTime }))
              break
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                setMetrics(prev => ({ ...prev!, cls: (prev?.cls || 0) + (entry as any).value }))
              }
              break
          }
        })
      })

      // 관찰할 성능 메트릭 등록
      try {
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] })
      } catch (e) {
        console.warn('Performance Observer not supported')
      }

      // TTFB 계산
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.requestStart
        setMetrics(prev => ({ ...prev!, ttfb }))
      }

      return () => observer.disconnect()
    }

    // 네트워크 정보 수집
    const collectNetworkInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        })

        connection.addEventListener('change', () => {
          setNetworkInfo({
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
          })
        })
      }
    }

    // 초기 메트릭 설정
    setMetrics({
      fcp: 0,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0
    })

    const cleanup = collectMetrics()
    collectNetworkInfo()

    // 키보드 단축키로 토글 (Ctrl + Shift + P)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cleanup?.()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // 성능 점수 계산
  const getPerformanceScore = (metric: keyof PerformanceMetrics, value: number): string => {
    const thresholds = {
      fcp: { good: 1800, poor: 3000 },
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      ttfb: { good: 800, poor: 1800 }
    }

    const threshold = thresholds[metric]
    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  const getScoreColor = (score: string): string => {
    switch (score) {
      case 'good': return 'text-green-600 bg-green-100'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // 서비스 워커 성능 리포트 요청
  const getServiceWorkerReport = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel()
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'PERFORMANCE_REPORT') {
            resolve(event.data.data)
          }
        }

        navigator.serviceWorker.controller!.postMessage(
          { type: 'GET_PERFORMANCE_REPORT' },
          [messageChannel.port2]
        )
      })
    }
  }

  if (process.env.NODE_ENV !== 'development' || !isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-colors"
          title="성능 모니터 열기 (Ctrl+Shift+P)"
        >
          📊
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">성능 모니터</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Web Vitals */}
      <div className="space-y-2 mb-4">
        <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Web Vitals</h4>
        {metrics && Object.entries(metrics).map(([key, value]) => {
          const score = getPerformanceScore(key as keyof PerformanceMetrics, value)
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-gray-700 uppercase">{key}</span>
              <span className={`px-2 py-1 rounded-full font-medium ${getScoreColor(score)}`}>
                {key === 'cls' ? value.toFixed(3) : Math.round(value)}
                {key !== 'cls' && 'ms'}
              </span>
            </div>
          )
        })}
      </div>

      {/* 네트워크 정보 */}
      {networkInfo && (
        <div className="space-y-2 mb-4">
          <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">네트워크</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>연결 타입</span>
              <span className="font-medium">{networkInfo.effectiveType}</span>
            </div>
            <div className="flex justify-between">
              <span>다운링크</span>
              <span className="font-medium">{networkInfo.downlink} Mbps</span>
            </div>
            <div className="flex justify-between">
              <span>RTT</span>
              <span className="font-medium">{networkInfo.rtt}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* 메모리 사용량 */}
      {(performance as any).memory && (
        <div className="space-y-2 mb-4">
          <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">메모리</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>사용량</span>
              <span className="font-medium">
                {Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB
              </span>
            </div>
            <div className="flex justify-between">
              <span>한계</span>
              <span className="font-medium">
                {Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex space-x-2">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded transition-colors"
        >
          새로고침
        </button>
        <button
          onClick={getServiceWorkerReport}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-2 px-3 rounded transition-colors"
        >
          SW 리포트
        </button>
      </div>

      {/* 개발 환경 전용 서비스 워커 제어 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-3 space-y-2">
          <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">서비스 워커 제어</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={async () => {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  const registration = await navigator.serviceWorker.getRegistration();
                  if (registration) {
                    await registration.update();
                    console.log('서비스 워커 강제 업데이트 완료');
                  }
                }
              }}
              className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              SW 업데이트
            </button>
            <button
              onClick={async () => {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  const registration = await navigator.serviceWorker.getRegistration();
                  if (registration) {
                    await registration.unregister();
                    console.log('서비스 워커 해제 완료');
                    window.location.reload();
                  }
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              SW 해제
            </button>
            <button
              onClick={async () => {
                if (typeof window !== 'undefined' && 'caches' in window) {
                  const cacheNames = await caches.keys();
                  await Promise.all(cacheNames.map(name => caches.delete(name)));
                  console.log('모든 캐시 삭제 완료');
                  window.location.reload();
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              캐시 삭제
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.clear();
                  sessionStorage.clear();
                  console.log('스토리지 삭제 완료');
                  window.location.reload();
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              스토리지 삭제
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500 text-center">
        Ctrl+Shift+P로 토글
      </div>
    </div>
  )
} 