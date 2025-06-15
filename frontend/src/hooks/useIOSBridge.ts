import { useEffect, useState, useCallback } from 'react'

// iOS 브릿지 타입 정의
interface IOSBridge {
  sendMessage: (action: string, data?: any) => void
  isIOSApp: () => boolean
  notification: {
    requestPermission: () => void
  }
  share: {
    content: (text: string, url?: string) => void
  }
  browser: {
    openURL: (url: string) => void
  }
  feedback: {
    impact: (style?: 'light' | 'medium' | 'heavy') => void
  }
  device: {
    getInfo: () => void
  }
  ui: {
    showToast: (message: string) => void
  }
}

declare global {
  interface Window {
    SmapApp?: IOSBridge
    onPushNotification?: (notification: any) => void
    onDeepLink?: (deeplink: any) => void
    onAppStateChange?: (state: any) => void
    onNotificationPermissionResult?: (granted: boolean) => void
    onFCMTokenUpdate?: (token: string) => void
    onDeviceInfo?: (deviceInfo: any) => void
    onPageLoaded?: () => void
  }
}

interface IOSBridgeState {
  isIOSApp: boolean
  deviceInfo: any | null
  fcmToken: string | null
  notificationPermission: boolean | null
}

export const useIOSBridge = () => {
  const [state, setState] = useState<IOSBridgeState>({
    isIOSApp: false,
    deviceInfo: null,
    fcmToken: null,
    notificationPermission: null,
  })

  // iOS 브릿지 사용 가능 여부 확인
  const checkIOSBridge = useCallback(() => {
    if (typeof window !== 'undefined' && window.SmapApp) {
      const isIOS = window.SmapApp.isIOSApp()
      setState(prev => ({ ...prev, isIOSApp: isIOS }))
      return isIOS
    }
    return false
  }, [])

  // 이벤트 리스너 설정
  useEffect(() => {
    if (typeof window === 'undefined') return

    let mounted = true

    // 브릿지 초기화 대기
    const initBridge = () => {
      if (!mounted) return
      
      if (window.SmapApp) {
        checkIOSBridge()
        
        // 디바이스 정보 요청
        if (state.isIOSApp) {
          window.SmapApp.device.getInfo()
        }
      } else {
        // 브릿지가 아직 로드되지 않았으면 다시 시도
        setTimeout(initBridge, 100)
      }
    }

    initBridge()

    // 글로벌 콜백 함수 설정
    window.onDeviceInfo = (deviceInfo: any) => {
      if (!mounted) return
      setState(prev => ({ ...prev, deviceInfo }))
    }

    window.onFCMTokenUpdate = (token: string) => {
      if (!mounted) return
      setState(prev => ({ ...prev, fcmToken: token }))
    }

    window.onNotificationPermissionResult = (granted: boolean) => {
      if (!mounted) return
      setState(prev => ({ ...prev, notificationPermission: granted }))
    }

    // 커스텀 이벤트 리스너
    const handleDeviceInfo = (event: CustomEvent) => {
      if (!mounted) return
      setState(prev => ({ ...prev, deviceInfo: event.detail }))
    }

    const handleFCMTokenUpdate = (event: CustomEvent) => {
      if (!mounted) return
      setState(prev => ({ ...prev, fcmToken: event.detail.token }))
    }

    const handleNotificationPermission = (event: CustomEvent) => {
      if (!mounted) return
      setState(prev => ({ ...prev, notificationPermission: event.detail.granted }))
    }

    window.addEventListener('ios:deviceInfo', handleDeviceInfo as EventListener)
    window.addEventListener('ios:fcmTokenUpdate', handleFCMTokenUpdate as EventListener)
    window.addEventListener('ios:notificationPermission', handleNotificationPermission as EventListener)

    return () => {
      mounted = false
      window.removeEventListener('ios:deviceInfo', handleDeviceInfo as EventListener)
      window.removeEventListener('ios:fcmTokenUpdate', handleFCMTokenUpdate as EventListener)
      window.removeEventListener('ios:notificationPermission', handleNotificationPermission as EventListener)
      
      // 글로벌 콜백 정리
      delete window.onDeviceInfo
      delete window.onFCMTokenUpdate
      delete window.onNotificationPermissionResult
    }
  }, [checkIOSBridge, state.isIOSApp])

  // iOS 브릿지 메서드들
  const requestNotificationPermission = useCallback(() => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.notification.requestPermission()
    }
  }, [state.isIOSApp])

  const shareContent = useCallback((text: string, url?: string) => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.share.content(text, url)
    } else {
      // 웹 브라우저에서는 Web Share API 또는 클립보드 복사
      if (navigator.share) {
        navigator.share({ text, url })
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url ? `${text} ${url}` : text)
      }
    }
  }, [state.isIOSApp])

  const openExternalURL = useCallback((url: string) => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.browser.openURL(url)
    } else {
      window.open(url, '_blank')
    }
  }, [state.isIOSApp])

  const hapticFeedback = useCallback((style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.feedback.impact(style)
    }
  }, [state.isIOSApp])

  const showToast = useCallback((message: string) => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.ui.showToast(message)
    } else {
      // 웹에서는 일반적인 토스트 또는 alert 사용
      console.log('[Toast]', message)
      // 필요시 웹용 토스트 라이브러리 사용
    }
  }, [state.isIOSApp])

  const getDeviceInfo = useCallback(() => {
    if (window.SmapApp && state.isIOSApp) {
      window.SmapApp.device.getInfo()
    }
  }, [state.isIOSApp])

  return {
    // 상태
    isIOSApp: state.isIOSApp,
    deviceInfo: state.deviceInfo,
    fcmToken: state.fcmToken,
    notificationPermission: state.notificationPermission,
    
    // 메서드
    requestNotificationPermission,
    shareContent,
    openExternalURL,
    hapticFeedback,
    showToast,
    getDeviceInfo,
    
    // 유틸리티
    checkIOSBridge,
  }
}

// 푸시 알림 이벤트 훅
export const usePushNotification = (callback: (notification: any) => void) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePushNotification = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('ios:pushNotification', handlePushNotification as EventListener)

    // 글로벌 콜백도 설정
    const globalCallback = (notification: any) => {
      callback(notification)
    }
    window.onPushNotification = globalCallback

    return () => {
      window.removeEventListener('ios:pushNotification', handlePushNotification as EventListener)
      delete window.onPushNotification
    }
  }, [callback])
}

// 딥링크 이벤트 훅
export const useDeepLink = (callback: (deeplink: any) => void) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleDeepLink = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('ios:deepLink', handleDeepLink as EventListener)

    // 글로벌 콜백도 설정
    const globalCallback = (deeplink: any) => {
      callback(deeplink)
    }
    window.onDeepLink = globalCallback

    return () => {
      window.removeEventListener('ios:deepLink', handleDeepLink as EventListener)
      delete window.onDeepLink
    }
  }, [callback])
}

// 앱 상태 변경 이벤트 훅
export const useAppStateChange = (callback: (state: any) => void) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleAppStateChange = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('ios:appStateChange', handleAppStateChange as EventListener)

    // 글로벌 콜백도 설정
    const globalCallback = (state: any) => {
      callback(state)
    }
    window.onAppStateChange = globalCallback

    return () => {
      window.removeEventListener('ios:appStateChange', handleAppStateChange as EventListener)
      delete window.onAppStateChange
    }
  }, [callback])
} 