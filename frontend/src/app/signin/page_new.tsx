'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    google: any;
  }
}

export default function SimpleSignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const { login, user } = useAuth()
  const router = useRouter()

  // 이미 로그인된 경우 홈으로 리다이렉트
  useEffect(() => {
    if (user) {
      router.push('/home')
    }
  }, [user, router])

  // Google 로그인 처리
  const handleGoogleLogin = async () => {
    console.log('🔐 Google 로그인 시작')
    setIsLoading(true)
    setError('')

    try {
      // 1. iOS 앱에서 시도
      if (window.iosBridge?.googleSignIn?.signIn) {
        console.log('📱 iOS 앱에서 Google 로그인 시도')
        window.iosBridge.googleSignIn.signIn()
        return
      }

      // 2. WebKit 메시지 핸들러 시도
      if (window.webkit?.messageHandlers?.smapIos) {
        console.log('📱 WebKit 메시지 핸들러로 Google 로그인 시도')
        window.webkit.messageHandlers.smapIos.postMessage({
          type: 'googleSignIn',
          param: ''
        })
        return
      }

      // 3. 웹 브라우저에서 Google SDK 사용
      console.log('🌐 웹 브라우저에서 Google SDK 로그인 시도')
      
      // Google SDK 로드 확인
      if (!window.google) {
        console.log('Google SDK 로딩 중...')
        await loadGoogleSDK()
      }

      // Google 로그인 실행
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        callback: handleGoogleCallback
      })

      window.google.accounts.id.prompt()

    } catch (error) {
      console.error('Google 로그인 실패:', error)
      setError('Google 로그인에 실패했습니다. 전화번호 로그인을 사용해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  // Google SDK 로드
  const loadGoogleSDK = () => {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve(window.google)
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      
      script.onload = () => {
        console.log('Google SDK 로드 완료')
        resolve(window.google)
      }
      
      script.onerror = () => {
        console.error('Google SDK 로드 실패')
        reject(new Error('Google SDK 로드 실패'))
      }
      
      document.head.appendChild(script)
    })
  }

  // Google 로그인 콜백
  const handleGoogleCallback = async (response: any) => {
    console.log('Google 로그인 응답:', response)
    
    try {
      // 백엔드로 토큰 전송
      const res = await fetch('/api/google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential
        })
      })

      const data = await res.json()
      
      if (data.success && data.user) {
        console.log('Google 로그인 성공:', data.user)
        await login({
          mt_id: data.user.mt_id || data.user.mt_email || '',
          mt_pwd: '' // Google 로그인의 경우 비밀번호는 필요 없음
        })
        router.push('/home')
      } else {
        throw new Error(data.error || 'Google 로그인 실패')
      }
    } catch (error) {
      console.error('Google 로그인 처리 실패:', error)
      setError('Google 로그인 처리 중 오류가 발생했습니다.')
    }
  }

  // 전화번호 로그인
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/phone-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber.replace(/\D/g, '')
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // SMS 인증 페이지로 이동
        router.push(`/verify?phone=${encodeURIComponent(phoneNumber)}`)
      } else {
        setError(data.error || '전화번호 인증 요청에 실패했습니다.')
      }
    } catch (error) {
      console.error('전화번호 로그인 실패:', error)
      setError('전화번호 로그인에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SMAP</h1>
          <p className="text-gray-600">로그인하여 시작하세요</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Google 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center gap-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed mb-4 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? '로그인 중...' : 'Google로 로그인'}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        {/* 전화번호 로그인 */}
        <form onSubmit={handlePhoneLogin}>
          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              전화번호
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !phoneNumber}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '전송 중...' : '인증번호 받기'}
          </button>
        </form>

        {/* 환경 정보 (개발용) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 text-xs text-gray-500 space-y-1">
            <p>🔍 환경 정보:</p>
            <p>iOS WebView: {!!(window as any).webkit ? '✅' : '❌'}</p>
            <p>iOS Bridge: {!!(window as any).iosBridge ? '✅' : '❌'}</p>
            <p>Google SDK: {!!(window as any).google ? '✅' : '❌'}</p>
          </div>
        )}
      </div>
    </div>
  )
} 