'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 온라인 상태 확인
    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    // 초기 상태 설정
    checkOnlineStatus()

    // 온라인/오프라인 이벤트 리스너
    window.addEventListener('online', checkOnlineStatus)
    window.addEventListener('offline', checkOnlineStatus)

    return () => {
      window.removeEventListener('online', checkOnlineStatus)
      window.removeEventListener('offline', checkOnlineStatus)
    }
  }, [])

  useEffect(() => {
    // 온라인 상태가 되면 홈으로 리다이렉트
    if (isOnline) {
      router.push('/home')
    }
  }, [isOnline, router])

  const handleRetry = () => {
    if (navigator.onLine) {
      router.push('/home')
    } else {
      // 네트워크 연결 재시도
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* 오프라인 아이콘 */}
        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <svg 
            className="w-12 h-12 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M18.364 5.636l-12.728 12.728m0 0L12 12m-6.364 6.364L12 12m6.364-6.364L12 12" 
            />
          </svg>
        </div>

        {/* 상태 표시 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isOnline ? '연결 중...' : '오프라인 상태'}
          </h1>
          <p className="text-gray-600">
            {isOnline 
              ? '인터넷에 연결되었습니다. 잠시만 기다려주세요.'
              : '인터넷 연결을 확인해주세요. 일부 기능은 오프라인에서도 사용할 수 있습니다.'
            }
          </p>
        </div>

        {/* 연결 상태 표시 */}
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-6 ${
          isOnline 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`} />
          {isOnline ? '온라인' : '오프라인'}
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isOnline ? '홈으로 이동' : '다시 시도'}
          </button>

          {!isOnline && (
            <button
              onClick={() => router.back()}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              이전 페이지로
            </button>
          )}
        </div>

        {/* 오프라인 기능 안내 */}
        {!isOnline && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              오프라인에서 사용 가능한 기능
            </h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 캐시된 지도 보기</li>
              <li>• 저장된 일정 확인</li>
              <li>• 기본 설정 변경</li>
            </ul>
          </div>
        )}

        {/* 로딩 애니메이션 */}
        {isOnline && (
          <div className="mt-6">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 