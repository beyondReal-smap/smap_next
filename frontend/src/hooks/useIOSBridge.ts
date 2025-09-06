import { useEffect, useState } from 'react'

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
  haptic: {
    light: () => void
    medium: () => void
    heavy: () => void
    success: () => void
    warning: () => void
    error: () => void
    selection: () => void
  }
  requestNotificationPermission: () => void
  sendNotification: (title: string, body: string) => void
  googleSignIn?: {
    signIn: () => void
    signOut: () => void
    checkStatus: () => void
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
    iosBridge?: IOSBridge
    webkit?: {
      messageHandlers?: {
        smapIos?: {
          postMessage: (message: any) => void
        }
      }
    }
  }
}

interface IOSBridgeState {
  isIOSApp: boolean
  deviceInfo: any | null
  fcmToken: string | null
  notificationPermission: boolean | null
}

export function useIOSBridge() {
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       !!(window.webkit?.messageHandlers?.smapIos)
    setIsIOS(isIOSDevice)
  }, [])

  // 햅틱 피드백 함수들 (통합된 시스템 사용)
  const haptic = {
    // 가벼운 햅틱 (버튼 탭, 가벼운 상호작용)
    light: () => {
      if (isIOS && window.iosBridge?.haptic?.light) {
        window.iosBridge.haptic.light()
      }
    },

    // 중간 햅틱 (중간 정도의 상호작용)
    medium: () => {
      if (isIOS && window.iosBridge?.haptic?.medium) {
        window.iosBridge.haptic.medium()
      }
    },

    // 강한 햅틱 (중요한 액션, 경고)
    heavy: () => {
      if (isIOS && window.iosBridge?.haptic?.heavy) {
        window.iosBridge.haptic.heavy()
      }
    },

    // 성공 햅틱
    success: () => {
      if (isIOS && window.iosBridge?.haptic?.success) {
        window.iosBridge.haptic.success()
      }
    },

    // 경고 햅틱
    warning: () => {
      if (isIOS && window.iosBridge?.haptic?.warning) {
        window.iosBridge.haptic.warning()
      }
    },

    // 에러 햅틱
    error: () => {
      if (isIOS && window.iosBridge?.haptic?.error) {
        window.iosBridge.haptic.error()
      }
    },

    // 선택 변경 햅틱 (탭 전환, 선택 변경)
    selection: () => {
      if (isIOS && window.iosBridge?.haptic?.selection) {
        window.iosBridge.haptic.selection()
      }
    }
  }

  // 알림 관련
  const requestNotificationPermission = () => {
    if (isIOS && window.iosBridge?.requestNotificationPermission) {
      window.iosBridge.requestNotificationPermission()
    }
  }

  const sendNotification = (title: string, body: string) => {
    if (isIOS && window.iosBridge?.sendNotification) {
      window.iosBridge.sendNotification(title, body)
    }
  }

  // 공유하기
  const share = (content: string) => {
    if (isIOS && window.iosBridge?.share?.content) {
      window.iosBridge.share.content(content)
    } else {
      // iOS가 아닌 경우 Web Share API 사용
      if (navigator.share) {
        navigator.share({
          text: content
        }).catch(console.error)
      } else {
        // Web Share API가 지원되지 않는 경우 클립보드에 복사
        navigator.clipboard?.writeText(content).then(() => {
          alert('클립보드에 복사되었습니다.')
        }).catch(() => {
          alert('공유 기능을 지원하지 않습니다.')
        })
      }
    }
  }

  // 디바이스 정보
  const getDeviceInfo = () => {
    if (isIOS && window.iosBridge?.device?.getInfo) {
      window.iosBridge.device.getInfo()
    }
  }

  return {
    isIOS,
    haptic,
    requestNotificationPermission,
    sendNotification,
    share,
    getDeviceInfo
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

// FCM 토큰 등록 성공 이벤트 훅
export const useFCMTokenRegistrationSuccess = (callback: (data: any) => void) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFCMTokenRegistrationSuccess = (event: CustomEvent) => {
      console.log('✅ [FCM] 토큰 등록 성공 이벤트 수신:', event.detail)
      callback(event.detail)
    }

    window.addEventListener('fcmTokenRegistrationSuccess', handleFCMTokenRegistrationSuccess as EventListener)

    return () => {
      window.removeEventListener('fcmTokenRegistrationSuccess', handleFCMTokenRegistrationSuccess as EventListener)
    }
  }, [callback])
}

// FCM 토큰 등록 실패 이벤트 훅
export const useFCMTokenRegistrationFailed = (callback: (data: any) => void) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFCMTokenRegistrationFailed = (event: CustomEvent) => {
      console.log('❌ [FCM] 토큰 등록 실패 이벤트 수신:', event.detail)

      // 타임아웃 상황 구분하여 메시지 조정
      const detail = event.detail
      if (detail.reason === 'timeout_active') {
        detail.message = '푸시 알림 설정이 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.'
        detail.action = 'wait'
      } else if (detail.reason === 'user_not_found') {
        detail.message = '푸시 알림 설정에 실패했습니다. 앱을 재시작해주세요.'
        detail.action = 'restart'
      }

      callback(detail)
    }

    window.addEventListener('fcmTokenRegistrationFailed', handleFCMTokenRegistrationFailed as EventListener)

    return () => {
      window.removeEventListener('fcmTokenRegistrationFailed', handleFCMTokenRegistrationFailed as EventListener)
    }
  }, [callback])
} 