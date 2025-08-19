import { fcmTokenService } from '../services/fcmTokenService';
import { fcmTokenAutoRefreshService } from '../services/fcmTokenAutoRefreshService';

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
      const webToken = await fcmTokenService.getFCMToken();
      if (webToken) {
        console.log('[FCM Utils] ✅ 웹 FCM 토큰 획득 성공:', webToken.substring(0, 50) + '...');
        return webToken;
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
    const result = await (fcmTokenService as any).updateFCMTokenAfterLogin(userId, loginType);
    
    if (result.success) {
      console.log(`[FCM Utils] ✅ ${loginType} 로그인 후 FCM 토큰 업데이트 완료:`, result.message);
      
      // 자동 갱신 서비스 시작
      fcmTokenAutoRefreshService.startPeriodicRefresh(userId);
    } else {
      console.warn(`[FCM Utils] ⚠️ ${loginType} 로그인 후 FCM 토큰 업데이트 실패:`, result.error);
    }
    
    return result;
    
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
    
    const result = await (fcmTokenService as any).forceRefreshToken(userId);
    
    if (result.success) {
      console.log('[FCM Utils] ✅ FCM 토큰 강제 갱신 완료:', result.message);
    } else {
      console.warn('[FCM Utils] ⚠️ FCM 토큰 강제 갱신 실패:', result.error);
    }
    
    return result;
    
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
export const startFCMAutoRefresh = (userId: number, interval?: number): void => {
  try {
    console.log(`[FCM Utils] 🔄 FCM 자동 갱신 서비스 시작 (사용자 ID: ${userId})`);
    fcmTokenAutoRefreshService.startPeriodicRefresh(userId, interval);
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 자동 갱신 서비스 시작 실패:', error);
  }
};

/**
 * FCM 자동 갱신 서비스 중지
 */
export const stopFCMAutoRefresh = (): void => {
  try {
    console.log('[FCM Utils] ⏹️ FCM 자동 갱신 서비스 중지');
    fcmTokenAutoRefreshService.stopPeriodicRefresh();
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 자동 갱신 서비스 중지 실패:', error);
  }
};

/**
 * FCM 토큰 상태 확인
 */
export const getFCMTokenStatus = () => {
  try {
    const currentToken = fcmTokenService.getCurrentToken();
    const autoRefreshStatus = fcmTokenAutoRefreshService.getStatus();
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
    
    const status = getFCMTokenStatus();
    console.log('[FCM Utils] 📋 현재 상태:', status);
    
    // FCM 토큰 생성 시도
    const token = await getUnifiedFCMToken();
    console.log('[FCM Utils] 🔑 생성된 토큰:', token ? `${token.substring(0, 50)}...` : '없음');
    
    // 강제 업데이트 실행
    const updateResult = await forceRefreshFCMToken(userId);
    console.log('[FCM Utils] 📋 업데이트 결과:', updateResult);
    
    // 업데이트 후 상태 확인
    const statusAfter = getFCMTokenStatus();
    console.log('[FCM Utils] 📋 업데이트 후 상태:', statusAfter);
    
    return {
      before: status,
      token,
      updateResult,
      after: statusAfter
    };
    
  } catch (error) {
    console.error('[FCM Utils] ❌ FCM 토큰 디버깅 실패:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * 전역 함수로 등록 (개발자 도구에서 사용)
 */
if (typeof window !== 'undefined') {
  // 전역 유틸리티 함수들 등록
  (window as any).FCMUtils = {
    detectEnvironment,
    isFCMSupported,
    getNativeFCMToken,
    getUnifiedFCMToken,
    updateFCMTokenAfterLogin,
    forceRefreshFCMToken,
    startFCMAutoRefresh,
    stopFCMAutoRefresh,
    getFCMTokenStatus,
    debugFCMToken
  };
  
  // 편의 함수들도 별도로 등록
  (window as any).updateFCMAfterLogin = updateFCMTokenAfterLogin;
  (window as any).forceRefreshFCM = forceRefreshFCMToken;
  (window as any).getFCMStatus = getFCMTokenStatus;
  (window as any).debugFCM = debugFCMToken;
  
  console.log('[FCM Utils] 🌐 전역 FCM 유틸리티 함수 등록 완료:');
  console.log('- FCMUtils.detectEnvironment(): 환경 감지');
  console.log('- FCMUtils.isFCMSupported(): FCM 지원 여부');
  console.log('- FCMUtils.getUnifiedFCMToken(): 통합 FCM 토큰 획득');
  console.log('- updateFCMAfterLogin(userId, loginType): 로그인 후 FCM 업데이트');
  console.log('- forceRefreshFCM(userId): FCM 토큰 강제 갱신');
  console.log('- getFCMStatus(): FCM 토큰 상태 확인');
  console.log('- debugFCM(userId): FCM 토큰 디버깅');
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
  debugFCMToken
};
