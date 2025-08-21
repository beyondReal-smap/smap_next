// fcmTokenService와 fcmTokenAutoRefreshService는 동적으로 import하여 서버사이드 렌더링 문제 방지

/**
 * 환경 감지 함수
 */
export const detectEnvironment = (): 'web' | 'android' | 'android_webview' | 'ios' | 'ios_webview' | 'server' => {
  if (typeof window === 'undefined') return 'server';
  
  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent);
  const isWebView = /WebView|wv/i.test(userAgent);
  
  if (isAndroid) {
    return isWebView ? 'android_webview' : 'android';
  } else if (isIOS) {
    return isWebView ? 'ios_webview' : 'ios';
  } else {
    return 'web';
  }
};

/**
 * 디바이스 타입 감지 (iOS, Android, Desktop 등)
 */
export const detectDeviceType = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  if (/windows/.test(userAgent)) return 'desktop';
  if (/macintosh|mac os x/.test(userAgent)) return 'desktop';
  if (/linux/.test(userAgent)) return 'desktop';
  
  return 'mobile';
};

/**
 * iOS 환경에서 FCM 토큰 업데이트 안내
 */
export const getIOSFCMTokenUpdateInfo = (): { 
  isIOS: boolean; 
  message: string; 
  instructions: string[]; 
  availableFunctions: string[] 
} => {
  const isIOS = detectDeviceType() === 'ios';
  
  if (!isIOS) {
    return {
      isIOS: false,
      message: 'iOS 디바이스가 아닙니다.',
      instructions: [],
      availableFunctions: []
    };
  }
  
  return {
    isIOS: true,
    message: '🍎 iOS 환경에서는 Swift에서 FCM 토큰을 직접 관리합니다.',
    instructions: [
      '웹에서 FCM 토큰 업데이트를 시도하지 마세요.',
      'Swift에서 자동으로 FCM 토큰을 서버에 전송합니다.',
      '수동 업데이트가 필요한 경우 window.updateFCMToken() 함수를 사용하세요.',
      'FCM 토큰 상태 확인은 window.checkFCMTokenStatus() 함수를 사용하세요.'
    ],
    availableFunctions: [
      'window.updateFCMToken() - FCM 토큰 수동 업데이트',
      'window.checkFCMTokenStatus() - FCM 토큰 상태 확인',
      'window.getFCMTokenStatus() - FCM 토큰 상태 상세 정보'
    ]
  };
};

/**
 * FCM 지원 여부 확인
 */
export const isFCMSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

/**
 * 네이티브 FCM 토큰 확인
 */
export const getNativeFCMToken = (): string | null => {
  if (typeof window !== 'undefined' && (window as any).nativeFCMToken) {
    return (window as any).nativeFCMToken;
  }
  return null;
};

/**
 * 통합 FCM 토큰 획득 (웹, iOS, 안드로이드 구분 없이)
 */
export const getUnifiedFCMToken = async (): Promise<string | null> => {
  try {
    console.log('[FCM Utils] 🔑 통합 FCM 토큰 획득 시작');
    console.log('[FCM Utils] 🌐 환경:', detectEnvironment());
    
    // 1. 네이티브 토큰 우선 확인
    const nativeToken = getNativeFCMToken();
    if (nativeToken) {
      console.log('[FCM Utils] 📱 네이티브 FCM 토큰 사용:', nativeToken.substring(0, 50) + '...');
      return nativeToken;
    }
    
    // 2. 웹 FCM 토큰 획득 시도
    if (isFCMSupported()) {
      console.log('[FCM Utils] 🌐 웹 FCM 토큰 획득 시도');
      try {
        const { fcmTokenService } = await import('../services/fcmTokenService');
        if (fcmTokenService) {
          const webToken = await fcmTokenService.getFCMToken();
          if (webToken) {
            console.log('[FCM Utils] ✅ 웹 FCM 토큰 획득 성공:', webToken.substring(0, 50) + '...');
            return webToken;
          }
        }
      } catch (error) {
        console.warn('[FCM Utils] ⚠️ fcmTokenService import 실패:', error);
      }
    }
    
    console.log('[FCM Utils] ⚠️ FCM 토큰 획득 실패');
    return null;
    
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 토큰 획득 중 오류:', error);
    return null;
  }
};

/**
 * 로그인 후 FCM 토큰 업데이트 (모든 로그인 방식에서 사용)
 */
export const updateFCMTokenAfterLogin = async (
  userId: number, 
  loginType: string = 'unknown'
): Promise<{ success: boolean; token?: string; error?: string; message?: string }> => {
  try {
    console.log(`[FCM Utils] 🔔 ${loginType} 로그인 후 FCM 토큰 업데이트 시작`);
    console.log(`[FCM Utils] 📋 사용자 ID: ${userId}, 로그인 타입: ${loginType}`);
    console.log(`[FCM Utils] 🌐 환경: ${detectEnvironment()}`);
    
    // FCM 토큰 획득 및 서버 업데이트
    try {
      const { fcmTokenService } = await import('../services/fcmTokenService');
      if (fcmTokenService) {
        const result = await fcmTokenService.initializeAndCheckUpdateToken(userId);
        
        if (result.success) {
          console.log(`[FCM Utils] ✅ ${loginType} 로그인 후 FCM 토큰 업데이트 완료:`, result.message);
          
          // 자동 갱신 서비스 시작
          try {
            const { fcmTokenAutoRefreshService } = await import('../services/fcmTokenAutoRefreshService');
            fcmTokenAutoRefreshService.startPeriodicRefresh(userId);
          } catch (error) {
            console.warn('[FCM Utils] ⚠️ 자동 갱신 서비스 시작 실패:', error);
          }
        }
        
        return result;
      } else {
        return {
          success: false,
          error: 'fcmTokenService 초기화 실패'
        };
      }
    } catch (error) {
      console.error('[FCM Utils] ❌ fcmTokenService import 실패:', error);
      return {
        success: false,
        error: 'fcmTokenService import 실패'
      };
    }
    
  } catch (error) {
    console.error(`[FCM Utils] ❌ ${loginType} 로그인 후 FCM 토큰 업데이트 중 오류:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

/**
 * FCM 토큰 강제 갱신
 */
export const forceRefreshFCMToken = async (userId: number): Promise<{ success: boolean; token?: string; error?: string; message?: string }> => {
  try {
    console.log(`[FCM Utils] 🔄 FCM 토큰 강제 갱신 시작 (사용자 ID: ${userId})`);
    
    // iOS 환경 감지
    const isIOS = detectDeviceType() === 'ios';
    if (isIOS) {
      console.log('[FCM Utils] 🍎 iOS 환경 감지 - FCM 토큰 강제 갱신 건너뛰기 (Swift에서 직접 처리)');
      console.log('[FCM Utils] 📱 iOS에서는 window.updateFCMToken() 함수를 사용하여 네이티브 FCM 토큰 업데이트를 수행하세요');
      return { 
        success: false, 
        error: 'iOS에서는 FCM 토큰 강제 갱신을 지원하지 않습니다. window.updateFCMToken() 함수를 사용하세요.',
        message: 'iOS에서는 Swift에서 FCM 토큰을 직접 관리합니다.'
      };
    }
    
    try {
      const { fcmTokenService } = await import('../services/fcmTokenService');
      if (fcmTokenService) {
        const result = await fcmTokenService.forceTokenRefresh(userId);
        
        if (result.success) {
          console.log('[FCM Utils] ✅ FCM 토큰 강제 갱신 완료:', result.token ? `토큰: ${result.token.substring(0, 20)}...` : '성공');
        } else {
          console.warn('[FCM Utils] ⚠️ FCM 토큰 강제 갱신 실패:', result.error);
        }
        
        return result;
      } else {
        return {
          success: false,
          error: 'fcmTokenService 초기화 실패'
        };
      }
    } catch (error) {
      console.error('[FCM Utils] ❌ fcmTokenService import 실패:', error);
      return {
        success: false,
        error: 'fcmTokenService import 실패'
      };
      }
    
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 토큰 강제 갱신 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
};

/**
 * FCM 자동 갱신 서비스 시작
 */
export const startFCMAutoRefresh = async (userId: number, interval?: number): Promise<void> => {
  try {
    console.log(`[FCM Utils] 🔄 FCM 자동 갱신 서비스 시작 (사용자 ID: ${userId})`);
    const { fcmTokenAutoRefreshService } = await import('../services/fcmTokenAutoRefreshService');
    fcmTokenAutoRefreshService.startPeriodicRefresh(userId, interval);
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 자동 갱신 서비스 시작 실패:', error);
  }
};

/**
 * FCM 자동 갱신 서비스 중지
 */
export const stopFCMAutoRefresh = async (): Promise<void> => {
  try {
    console.log('[FCM Utils] ⏹️ FCM 자동 갱신 서비스 중지');
    const { fcmTokenAutoRefreshService } = await import('../services/fcmTokenAutoRefreshService');
    fcmTokenAutoRefreshService.stopPeriodicRefresh();
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 자동 갱신 서비스 중지 실패:', error);
  }
};

/**
 * FCM 토큰 상태 확인
 */
export const getFCMTokenStatus = async () => {
  try {
    let currentToken: string | null = null;
    let autoRefreshStatus: any = null;
    
    try {
      const { fcmTokenService } = await import('../services/fcmTokenService');
      if (fcmTokenService) {
        currentToken = fcmTokenService.getCurrentToken();
      }
    } catch (error) {
      console.warn('[FCM Utils] ⚠️ fcmTokenService import 실패:', error);
    }
    
    try {
      const { fcmTokenAutoRefreshService } = await import('../services/fcmTokenAutoRefreshService');
      autoRefreshStatus = fcmTokenAutoRefreshService.getStatus();
    } catch (error) {
      console.warn('[FCM Utils] ⚠️ fcmTokenAutoRefreshService import 실패:', error);
    }
    
    const environment = detectEnvironment();
    const isSupported = isFCMSupported();
    const nativeToken = getNativeFCMToken();
    
    return {
      hasToken: !!currentToken,
      tokenPreview: currentToken ? `${currentToken.substring(0, 20)}...` : null,
      environment,
      isSupported,
      hasNativeToken: !!nativeToken,
      autoRefreshStatus,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 토큰 상태 확인 실패:', error);
    return {
      hasToken: false,
      tokenPreview: null,
      environment: 'unknown',
      isSupported: false,
      hasNativeToken: false,
      autoRefreshStatus: null,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * FCM 토큰 디버깅 정보
 */
export const debugFCMToken = async (userId: number) => {
  try {
    console.log(`[FCM Utils] 🔍 FCM 토큰 디버깅 시작 (사용자 ID: ${userId})`);
    
    const status = await getFCMTokenStatus();
    const unifiedToken = await getUnifiedFCMToken();
    
    const debugInfo = {
      환경: detectEnvironment(),
      FCM지원: isFCMSupported(),
      네이티브토큰: getNativeFCMToken() ? '있음' : '없음',
      통합토큰: unifiedToken ? `${unifiedToken.substring(0, 30)}...` : '없음',
      상태: status,
      타임스탬프: new Date().toISOString()
    };
    
    console.table(debugInfo);
    return debugInfo;
    
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 토큰 디버깅 실패:', error);
    return {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      타임스탬프: new Date().toISOString()
    };
  }
};

// 전역 함수로 등록 (개발자 도구에서 사용)
if (typeof window !== 'undefined') {
  (window as any).debugFCMToken = debugFCMToken;
  (window as any).getFCMTokenStatus = getFCMTokenStatus;
  (window as any).getUnifiedFCMToken = getUnifiedFCMToken;
  (window as any).forceRefreshFCMToken = forceRefreshFCMToken;
  (window as any).startFCMAutoRefresh = startFCMAutoRefresh;
  (window as any).stopFCMAutoRefresh = stopFCMAutoRefresh;
  
  console.log('[FCM Utils] 🌐 전역 함수 등록 완료:');
  console.log('- debugFCMToken(userId)');
  console.log('- getFCMTokenStatus()');
  console.log('- getUnifiedFCMToken()');
  console.log('- forceRefreshFCMToken(userId)');
  console.log('- startFCMAutoRefresh(userId, interval?)');
  console.log('- stopFCMAutoRefresh()');
}

export default {
  detectEnvironment,
  isFCMSupported,
  getNativeFCMToken,
  getUnifiedFCMToken,
  updateFCMTokenAfterLogin,
  forceRefreshFCMToken,
  startFCMAutoRefresh,
  stopFCMAutoRefresh,
  getFCMTokenStatus,
  debugFCMToken,
  getIOSFCMTokenUpdateInfo
};