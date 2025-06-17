/**
 * 햅틱 피드백 유틸리티
 * iOS WebView와 웹 브라우저에서 햅틱 피드백을 제공합니다.
 */

export enum HapticFeedbackType {
  // iOS 햅틱 피드백 타입
  LIGHT = 'light',           // 가벼운 터치 (네비게이션, 메뉴 선택)
  MEDIUM = 'medium',         // 중간 터치 (버튼 클릭, 토글)
  HEAVY = 'heavy',           // 강한 터치 (중요한 액션)
  SUCCESS = 'success',       // 성공 (데이터 로딩 완료, 작업 완료)
  WARNING = 'warning',       // 경고
  ERROR = 'error',           // 에러
  SELECTION = 'selection'    // 선택 변경 (슬라이더, 피커)
}

/**
 * 현재 페이지 정보를 가져오는 함수
 */
const getCurrentPageInfo = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const pageName = pathname.split('/').pop() || 'root';
  return {
    pathname,
    pageName,
    url: typeof window !== 'undefined' ? window.location.href : '',
    timestamp: new Date().toISOString()
  };
};

/**
 * 웹뷰 메시지 핸들러 디버깅 함수
 */
const debugWebViewHandlers = () => {
  if (typeof window === 'undefined') return { 
    availableHandlers: [] as string[], 
    webkitExists: false,
    messageHandlersExists: false,
    totalHandlers: 0
  };
  
  const webkit = (window as any).webkit;
  const webkitExists = !!webkit;
  const availableHandlers: string[] = [];
  
  if (webkit?.messageHandlers) {
    // 알려진 핸들러 이름들 확인
    const knownHandlers = ['smapIos', 'iosHandler', 'jsToNative', 'webViewHandler', 'nativeHandler'];
    knownHandlers.forEach(handlerName => {
      if (webkit.messageHandlers[handlerName]) {
        availableHandlers.push(handlerName);
      }
    });
    
    // 전체 핸들러 목록 확인 (가능한 경우)
    try {
      const allHandlers = Object.keys(webkit.messageHandlers);
      allHandlers.forEach(handler => {
        if (!availableHandlers.includes(handler)) {
          availableHandlers.push(handler);
        }
      });
    } catch (e) {
      // Object.keys가 작동하지 않는 경우 무시
    }
  }
  
  return {
    webkitExists,
    messageHandlersExists: !!webkit?.messageHandlers,
    availableHandlers,
    totalHandlers: availableHandlers.length
  };
};

/**
 * 다중 핸들러로 햅틱 메시지 전송 시도
 */
const sendHapticToWebView = (type: HapticFeedbackType): boolean => {
  const debugInfo = debugWebViewHandlers();
  
  console.log(`🔍 [WEBVIEW DEBUG] 핸들러 상태:`, debugInfo);
  
  if (debugInfo.availableHandlers.length === 0) {
    console.log(`❌ [WEBVIEW] 사용 가능한 메시지 핸들러가 없음`);
    return false;
  }
  
  // 우선순위에 따라 핸들러 시도
  const handlerPriority = ['smapIos', 'iosHandler', 'jsToNative', 'webViewHandler', 'nativeHandler'];
  
  for (const handlerName of handlerPriority) {
    if (debugInfo.availableHandlers.includes(handlerName)) {
      try {
        const webkit = (window as any).webkit;
        const message = {
          type: 'haptic',
          param: type
        };
        
        webkit.messageHandlers[handlerName].postMessage(message);
        
        console.log(`✅ [WEBVIEW] 햅틱 메시지 전송 성공: ${handlerName} | ${type}`);
        return true;
        
      } catch (error) {
        console.error(`❌ [WEBVIEW] ${handlerName} 핸들러 전송 실패:`, error);
        continue;
      }
    }
  }
  
  // 모든 핸들러 시도 실패
  console.error(`❌ [WEBVIEW] 모든 햅틱 메시지 핸들러 전송 실패`);
  return false;
};

/**
 * iOS 환경 감지 (강화 버전)
 */
const detectIOSEnvironment = () => {
  if (typeof window === 'undefined') return { 
    isIOS: false, 
    hasWebKit: false, 
    hasHandler: false, 
    isIOSApp: false, 
    isIOSBrowser: false,
    isWebView: false,
    supportsTouchAPI: false,
    supportsVibration: false,
    webViewDebug: null
  };
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hasWebKit = !!(window as any).webkit;
  const hasHandler = !!(window as any).webkit?.messageHandlers?.smapIos;
  const webViewDebug = debugWebViewHandlers();
  const isWebView = hasWebKit && (webViewDebug?.totalHandlers || 0) > 0;
  const isIOSApp = isIOS && hasHandler;
  const isIOSBrowser = isIOS && !isWebView;
  const supportsTouchAPI = 'ontouchstart' in window;
  const supportsVibration = 'vibrate' in navigator;
  
  return { 
    isIOS, 
    hasWebKit, 
    hasHandler, 
    isIOSApp, 
    isIOSBrowser,
    isWebView,
    supportsTouchAPI,
    supportsVibration,
    webViewDebug
  };
};

/**
 * iOS 네이티브 로그 전송 함수
 */
const sendLogToiOS = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
  const { hasHandler } = detectIOSEnvironment();
  if (hasHandler) {
    try {
      const logData = {
        type: 'jsLog',
        param: JSON.stringify({
          level,
          message,
          data: data ? JSON.stringify(data) : null,
          timestamp: new Date().toISOString()
        })
      };
      (window as any).webkit.messageHandlers.smapIos.postMessage(logData);
    } catch (e) {
      console.error('[HAPTIC] iOS 로그 전송 실패:', e);
    }
  }
};

/**
 * iOS Safari용 햅틱 시뮬레이션 (시각적 + 사운드 피드백)
 */
const triggerIOSSafariHaptic = (type: HapticFeedbackType) => {
  // 1. 버튼 시각적 피드백
  const activeElement = document.activeElement as HTMLElement;
  if (activeElement) {
    activeElement.style.transform = 'scale(0.95)';
    activeElement.style.transition = 'transform 0.1s ease';
    
    setTimeout(() => {
      activeElement.style.transform = '';
      activeElement.style.transition = '';
    }, 100);
  }

  // 2. 웹 바이브레이션 API (iOS에서 제한적이지만 시도)
  const vibrationPattern = getVibrationPattern(type);
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(vibrationPattern);
    } catch (e) {
      // iOS에서 바이브레이션이 차단되어도 무시
    }
  }

  // 3. 터치 이벤트 시뮬레이션 (매우 짧은 터치)
  try {
    if ('ontouchstart' in window && activeElement) {
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: []
      });
      activeElement.dispatchEvent(touchEvent);
      
      setTimeout(() => {
        const touchEndEvent = new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: []
        });
        activeElement.dispatchEvent(touchEndEvent);
      }, 50);
    }
  } catch (e) {
    // 터치 이벤트 생성 실패 시 무시
  }

  console.log(`📱 [HAPTIC] iOS Safari 햅틱 시뮬레이션: ${type} (시각적 피드백)`);
};

/**
 * 햅틱 피드백 실행 함수 (통합 및 간소화)
 * @param type 햅틱 피드백 타입
 * @param description 로그용 설명
 * @param context 추가 컨텍스트 정보 (선택사항)
 */
export const triggerHapticFeedback = (
  type: HapticFeedbackType, 
  description?: string, 
  context?: { action?: string; component?: string; [key: string]: any }
) => {
  try {
    const pageInfo = getCurrentPageInfo();
    const env = detectIOSEnvironment();
    
    // 로그 메시지 구성
    const logContext = {
      hapticType: type,
      description: description || '',
      page: pageInfo.pageName,
      fullPath: pageInfo.pathname,
      context: context || {},
      environment: env.isIOSApp ? 'iOS App' : env.isIOSBrowser ? 'iOS Safari' : 'Web Browser'
    };
    
    // 콘솔 로그 (항상 표시)
    console.log(`🎮 [HAPTIC] ${type.toUpperCase()} | ${pageInfo.pageName} | ${description || '액션'}`);
    
    if (env.hasHandler) {
      // 🔥 iOS 네이티브 햅틱 피드백 (앱 내 WebView)
      try {
        const hapticMessage = {
          type: 'haptic',
          param: type
        };
        
        (window as any).webkit.messageHandlers.smapIos.postMessage(hapticMessage);
        
        console.log(`✅ [HAPTIC] iOS 네이티브 햅틱 전송: ${type}`);
        sendLogToiOS('info', `햅틱 피드백 실행: ${type}`, logContext);
        
      } catch (iosError) {
        console.error('❌ [HAPTIC] iOS 메시지 전송 실패:', iosError);
        fallbackToWebVibration(type, env);
      }
    } else if (env.isWebView) {
      // 🌐 웹뷰 환경 - 다중 핸들러 시도
      console.log(`🌐 [HAPTIC] WebView 환경 감지 - 다중 핸들러 시도: ${type}`);
      const success = sendHapticToWebView(type);
      if (!success) {
        console.log(`⚠️ [HAPTIC] WebView 햅틱 전송 실패, 백업 방식 사용`);
        fallbackToWebVibration(type, env);
      }
    } else if (env.isIOSBrowser) {
      // 📱 iOS Safari 브라우저 - 특별한 햅틱 시뮬레이션
      console.log(`📱 [HAPTIC] iOS Safari 감지 - 향상된 햅틱 시뮬레이션 실행: ${type}`);
      triggerIOSSafariHaptic(type);
    } else if (env.isIOS) {
      // 기타 iOS 환경
      console.log(`⚠️ [HAPTIC] iOS 환경이지만 핸들러 없음 | WebKit: ${env.hasWebKit}`);
      fallbackToWebVibration(type, env);
    } else {
      // 웹 브라우저 바이브레이션 API 사용
      fallbackToWebVibration(type, env);
    }
    
    // 개발 환경에서 추가 디버그 정보
    if (process.env.NODE_ENV === 'development') {
      console.table({
        '햅틱 타입': type,
        '페이지': pageInfo.pageName,
        '설명': description || '없음',
        '환경': logContext.environment,
        'iOS': env.isIOS,
        'iOS App': env.isIOSApp,
        'iOS Safari': env.isIOSBrowser,
        'WebKit': env.hasWebKit,
        'Handler': env.hasHandler,
        '터치 지원': env.supportsTouchAPI,
        '바이브레이션': env.supportsVibration
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('🔥 [HAPTIC] 햅틱 피드백 실행 실패:', error);
    sendLogToiOS('error', '햅틱 피드백 실행 실패', { error: errorMessage });
  }
};

/**
 * 웹 바이브레이션 백업 함수 (강화 버전)
 */
const fallbackToWebVibration = (type: HapticFeedbackType, env: any) => {
  if (env.supportsVibration) {
    const vibrationPattern = getVibrationPattern(type);
    
    // 안드로이드에서는 일반 바이브레이션
    if (!env.isIOS) {
      navigator.vibrate(vibrationPattern);
      console.log(`📳 [HAPTIC] 웹 바이브레이션: ${vibrationPattern}ms`);
    } else {
      // iOS에서는 바이브레이션이 제한적이므로 시각적 피드백도 추가
      try {
        navigator.vibrate(vibrationPattern);
        console.log(`📳 [HAPTIC] iOS 웹 바이브레이션 시도: ${vibrationPattern}ms`);
      } catch (e) {
        console.log(`⚠️ [HAPTIC] iOS 바이브레이션 차단됨, 시각적 피드백만 사용`);
      }
      
      // iOS Safari에서 시각적 피드백도 함께 제공
      triggerIOSSafariHaptic(type);
    }
  } else {
    if (env.isIOS) {
      // iOS에서 바이브레이션이 지원되지 않으면 시각적 피드백만
      console.log(`📱 [HAPTIC] iOS 시각적 햅틱 시뮬레이션: ${type}`);
      triggerIOSSafariHaptic(type);
    } else {
      console.log(`⚠️ [HAPTIC] 햅틱 미지원 환경`);
    }
  }
};

/**
 * 햅틱 타입에 따른 바이브레이션 패턴 반환 (웹용)
 * @param type 햅틱 피드백 타입
 * @returns 바이브레이션 지속시간 (ms)
 */
const getVibrationPattern = (type: HapticFeedbackType): number => {
  switch (type) {
    case HapticFeedbackType.LIGHT:
    case HapticFeedbackType.SELECTION:
      return 10; // 10ms - 가벼운 진동
    case HapticFeedbackType.MEDIUM:
      return 20; // 20ms - 중간 진동
    case HapticFeedbackType.HEAVY:
    case HapticFeedbackType.ERROR:
      return 50; // 50ms - 강한 진동
    case HapticFeedbackType.SUCCESS:
      return 30; // 30ms - 성공 진동
    case HapticFeedbackType.WARNING:
      return 40; // 40ms - 경고 진동
    default:
      return 20;
  }
};

/**
 * 특정 상황에 맞는 햅틱 피드백 단축 함수들
 */
export const hapticFeedback = {
  // 로그인/인증 관련
  loginSuccess: (context?: any) => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '로그인 성공', { action: 'login_success', ...context }),
  loginError: (context?: any) => triggerHapticFeedback(HapticFeedbackType.ERROR, '로그인 실패', { action: 'login_error', ...context }),
  logoutSuccess: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '로그아웃 성공', { action: 'logout_success', ...context }),
  
  // 네비게이션 관련
  navigation: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '네비게이션', { action: 'navigation', ...context }),
  backButton: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '뒤로가기', { action: 'back_button', ...context }),
  menuSelect: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '메뉴 선택', { action: 'menu_select', ...context }),
  
  // 데이터 로딩 관련
  dataLoadStart: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '데이터 로딩 시작', { action: 'data_load_start', ...context }),
  dataLoadComplete: (context?: any) => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '데이터 로딩 완료', { action: 'data_load_complete', ...context }),
  dataLoadError: (context?: any) => triggerHapticFeedback(HapticFeedbackType.ERROR, '데이터 로딩 실패', { action: 'data_load_error', ...context }),
  
  // UI 상호작용
  buttonClick: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '버튼 클릭', { action: 'button_click', ...context }),
  toggle: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '토글', { action: 'toggle', ...context }),
  sliderMove: (context?: any) => triggerHapticFeedback(HapticFeedbackType.SELECTION, '슬라이더 이동', { action: 'slider_move', ...context }),
  
  // 폼 관련
  formSubmit: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '폼 제출', { action: 'form_submit', ...context }),
  formError: (context?: any) => triggerHapticFeedback(HapticFeedbackType.ERROR, '폼 에러', { action: 'form_error', ...context }),
  fieldFocus: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '필드 포커스', { action: 'field_focus', ...context }),
  
  // 상태 변경
  success: (context?: any) => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '성공', { action: 'success', ...context }),
  error: (context?: any) => triggerHapticFeedback(HapticFeedbackType.ERROR, '에러', { action: 'error', ...context }),
  warning: (context?: any) => triggerHapticFeedback(HapticFeedbackType.WARNING, '경고', { action: 'warning', ...context }),
  
  // 소셜 로그인 관련
  googleLogin: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, 'Google 로그인', { action: 'google_login', ...context }),
  kakaoLogin: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '카카오 로그인', { action: 'kakao_login', ...context }),
  appleLogin: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, 'Apple 로그인', { action: 'apple_login', ...context }),
  
  // 그룹/지도 관련
  groupSelect: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '그룹 선택', { action: 'group_select', ...context }),
  locationUpdate: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '위치 업데이트', { action: 'location_update', ...context }),
  markerTap: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '마커 탭', { action: 'marker_tap', ...context }),
}; 