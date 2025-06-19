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
 * 강제 햅틱 메시지 전송 (핸들러가 인식되지 않아도 시도)
 */
const forceHapticToWebView = (type: HapticFeedbackType): boolean => {
  const webkit = (window as any).webkit;
  if (!webkit) {
    console.log(`❌ [FORCE-HAPTIC] WebKit 없음`);
    return false;
  }

  // 알려진 모든 핸들러 이름으로 시도
  const possibleHandlers = [
    'smapIos', 'iosHandler', 'jsToNative', 'webViewHandler', 
    'nativeHandler', 'hapticHandler', 'messageHandler'
  ];

  for (const handlerName of possibleHandlers) {
    try {
      // 핸들러 존재 여부와 관계없이 시도
      if (webkit.messageHandlers && webkit.messageHandlers[handlerName]) {
        const messageFormats = [
          { type: 'haptic', param: type },
          { type: 'hapticFeedback', param: JSON.stringify({ feedbackType: type }) },
          type
        ];

        for (const message of messageFormats) {
          try {
            webkit.messageHandlers[handlerName].postMessage(message);
            console.log(`✅ [FORCE-HAPTIC] 강제 전송 성공: ${handlerName} | ${type}`);
            return true;
          } catch (e) {
            console.warn(`⚠️ [FORCE-HAPTIC] ${handlerName} 형식 실패:`, e);
          }
        }
      } else {
        // 핸들러가 인식되지 않아도 직접 시도
        try {
          webkit.messageHandlers = webkit.messageHandlers || {};
          webkit.messageHandlers[handlerName] = webkit.messageHandlers[handlerName] || {
            postMessage: (msg: any) => {
              console.log(`🔧 [FORCE-HAPTIC] 직접 메시지 시도: ${handlerName}`, msg);
              // iOS에서 처리할 수 있도록 window 이벤트 발생
              window.dispatchEvent(new CustomEvent('smap-ios-haptic', { 
                detail: { handler: handlerName, message: msg } 
              }));
            }
          };
          webkit.messageHandlers[handlerName].postMessage({ type: 'haptic', param: type });
          console.log(`✅ [FORCE-HAPTIC] 직접 생성 성공: ${handlerName} | ${type}`);
          return true;
        } catch (e) {
          console.warn(`⚠️ [FORCE-HAPTIC] 직접 생성 실패: ${handlerName}`, e);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [FORCE-HAPTIC] ${handlerName} 전체 실패:`, error);
      continue;
    }
  }

  console.log(`❌ [FORCE-HAPTIC] 모든 강제 시도 실패`);
  return false;
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
 * 다중 햅틱 메시지 전송 시도 (강화된 버전)
 */
const sendHapticToWebView = (type: HapticFeedbackType): boolean => {
  const debugInfo = debugWebViewHandlers();
  
  console.log(`🔍 [WEBVIEW DEBUG] 핸들러 상태:`, debugInfo);
  
  // 네이티브 강제 함수 우선 시도
  if (typeof (window as any).SMAP_FORCE_HAPTIC === 'function') {
    console.log(`🧪 [NATIVE-FORCE] 네이티브 강제 햅틱 함수 사용`);
    try {
      const result = (window as any).SMAP_FORCE_HAPTIC(type);
      if (result) {
        console.log(`✅ [NATIVE-FORCE] 네이티브 강제 햅틱 성공: ${type}`);
        return true;
      } else {
        console.warn(`⚠️ [NATIVE-FORCE] 네이티브 강제 햅틱 실패: ${type}`);
      }
    } catch (e) {
      console.error(`❌ [NATIVE-FORCE] 네이티브 강제 햅틱 에러:`, e);
    }
  }
  
  // 강제 핸들러 시도 (핸들러가 없어도 시도)
  if (debugInfo.webkitExists) {
    console.log(`🔧 [WEBVIEW] WebKit 존재, 강제 햅틱 전송 시도`);
    return forceHapticToWebView(type);
  }
  
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
        
        // 여러 형식으로 메시지 전송 시도
        const messageFormats = [
          // 기본 형식
          {
            type: 'haptic',
            param: type
          },
          // 구형 호환성 형식
          {
            type: 'hapticFeedback',
            param: JSON.stringify({ feedbackType: type })
          },
          // 직접 전송 형식
          type
        ];
        
        for (const message of messageFormats) {
          try {
            webkit.messageHandlers[handlerName].postMessage(message);
            console.log(`✅ [WEBVIEW] 햅틱 메시지 전송 성공: ${handlerName} | ${type} | 형식: ${typeof message === 'string' ? '직접' : message.type}`);
            
            // iOS 네이티브 로그 확인용 추가 메시지
            try {
              webkit.messageHandlers[handlerName].postMessage({
                type: 'jsLog',
                param: JSON.stringify({
                  level: 'info',
                  message: `웹에서 햅틱 전송: ${type}`,
                  data: { hapticType: type, handler: handlerName, timestamp: Date.now() }
                })
              });
            } catch (logError) {
              // 로그 전송 실패는 무시
            }
            
            return true;
            
          } catch (formatError) {
            console.warn(`⚠️ [WEBVIEW] ${handlerName} 형식 ${typeof message === 'string' ? '직접' : message.type} 실패:`, formatError);
            continue;
          }
        }
        
        console.error(`❌ [WEBVIEW] ${handlerName} 모든 형식 전송 실패`);
        
      } catch (error) {
        console.error(`❌ [WEBVIEW] ${handlerName} 핸들러 접근 실패:`, error);
        continue;
      }
    }
  }
  
  // 모든 핸들러 시도 실패
  console.error(`❌ [WEBVIEW] 모든 햅틱 메시지 핸들러 전송 실패`);
  return false;
};

/**
 * iOS 환경 감지 (강화 버전) - WebView vs Safari 정확한 구분
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
  
  // 네이티브 디버깅 함수로 정확한 핸들러 상태 확인
  let nativeCheck = null;
  if (typeof (window as any).SMAP_CHECK_HANDLERS === 'function') {
    try {
      nativeCheck = (window as any).SMAP_CHECK_HANDLERS();
      console.log(`🔍 [NATIVE-CHECK] 네이티브 핸들러 확인:`, nativeCheck);
    } catch (e) {
      console.warn(`⚠️ [NATIVE-CHECK] 네이티브 핸들러 확인 실패:`, e);
    }
  }
  
  // WebView vs Safari 정확한 구분 (네이티브 체크 결과 활용)
  const actualHasHandler = nativeCheck?.hasSmapIos || hasHandler;
  const isWebView = hasWebKit && actualHasHandler; // 핸들러가 있으면 WebView
  const isIOSApp = isIOS && actualHasHandler; // 핸들러가 있으면 앱 내 WebView
  const isIOSBrowser = isIOS && hasWebKit && !actualHasHandler; // WebKit 있지만 핸들러 없으면 Safari
  
  const supportsTouchAPI = 'ontouchstart' in window;
  const supportsVibration = 'vibrate' in navigator;
  
  // 디버그 로깅
  console.log(`🔍 [HAPTIC-ENV] 환경 감지:`, {
    isIOS,
    hasWebKit,
    hasHandler: actualHasHandler,
    isIOSApp,
    isIOSBrowser,
    isWebView,
    totalHandlers: webViewDebug?.totalHandlers || 0,
    availableHandlers: webViewDebug?.availableHandlers || [],
    nativeCheck
  });
  
  return { 
    isIOS, 
    hasWebKit, 
    hasHandler: actualHasHandler, 
    isIOSApp, 
    isIOSBrowser,
    isWebView,
    supportsTouchAPI,
    supportsVibration,
    webViewDebug,
    nativeCheck
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
 * iOS Safari용 햅틱 시뮬레이션 (바이브레이션만)
 */
const triggerIOSSafariHaptic = (type: HapticFeedbackType) => {
  // 웹 바이브레이션 API (iOS에서 제한적이지만 시도)
  const vibrationPattern = getVibrationPattern(type);
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(vibrationPattern);
    } catch (e) {
      // iOS에서 바이브레이션이 차단되어도 무시
    }
  }

  console.log(`📱 [HAPTIC] iOS Safari 햅틱 시뮬레이션: ${type} (바이브레이션만)`);
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
    
    // 핸들러 존재 여부를 다시 한번 확인 (실시간)
    const realtimeHasHandler = !!(window as any).webkit?.messageHandlers?.smapIos;
    
    if (realtimeHasHandler || env.hasHandler) {
      // 🔥 iOS 네이티브 햅틱 피드백 (앱 내 WebView)
      try {
        // 여러 형식으로 햅틱 메시지 전송 시도
        const webkit = (window as any).webkit;
        let success = false;
        
        const messageFormats = [
          // 표준 형식
          {
            type: 'haptic',
            param: type
          },
          // 호환성 형식
          {
            type: 'hapticFeedback',
            param: JSON.stringify({ feedbackType: type })
          },
          // 단순 형식 (직접 문자열)
          type
        ];
        
        for (const message of messageFormats) {
          try {
            webkit.messageHandlers.smapIos.postMessage(message);
            console.log(`✅ [HAPTIC] iOS 네이티브 햅틱 전송 성공: ${type} | 형식: ${typeof message === 'string' ? '직접' : message.type}`);
            success = true;
            break;
          } catch (formatError) {
            console.warn(`⚠️ [HAPTIC] 형식 ${typeof message === 'string' ? '직접' : message.type} 실패:`, formatError);
            continue;
          }
        }
        
        if (success) {
          // 성공 시 iOS 로그 전송
          sendLogToiOS('info', `햅틱 피드백 실행: ${type}`, logContext);
          
          // 추가 확인용 로그 전송
          try {
            webkit.messageHandlers.smapIos.postMessage({
              type: 'jsLog',
              param: JSON.stringify({
                level: 'info',
                message: `[HAPTIC CONFIRM] 웹에서 ${type} 햅틱 요청 완료`,
                data: { 
                  hapticType: type, 
                  timestamp: Date.now(),
                  page: pageInfo.pageName,
                  description: description || 'N/A'
                }
              })
            });
          } catch (logError) {
            // 로그 실패는 무시
          }
        } else {
          throw new Error('모든 햅틱 메시지 형식 전송 실패');
        }
        
      } catch (iosError) {
        console.error('❌ [HAPTIC] iOS 네이티브 햅틱 전송 실패:', iosError);
        console.error('❌ [HAPTIC] 전송 시도한 형식들:', ['haptic + param', 'hapticFeedback + JSON', '직접 문자열']);
        
        // 핸들러 실패 시 다중 핸들러 시도
        console.log(`🔄 [HAPTIC] 메인 핸들러 실패, 다중 핸들러 시도: ${type}`);
        const fallbackSuccess = sendHapticToWebView(type);
        if (!fallbackSuccess) {
          fallbackToWebVibration(type, env);
        }
      }
    } else if (env.hasWebKit && !env.hasHandler) {
      // 🌐 WebKit은 있지만 핸들러가 없는 경우 (웹뷰일 가능성)
      console.log(`🌐 [HAPTIC] WebKit 감지, 다중 핸들러 시도: ${type}`);
      const success = sendHapticToWebView(type);
      if (!success) {
        console.log(`⚠️ [HAPTIC] WebKit 햅틱 전송 실패, 백업 방식 사용`);
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
        console.log(`⚠️ [HAPTIC] iOS 바이브레이션 차단됨`);
      }
    }
      } else {
      console.log(`⚠️ [HAPTIC] 햅틱 미지원 환경`);
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
/**
 * iOS 네이티브에서 햅틱 실행 확인 메시지를 받기 위한 글로벌 함수 설정
 */
if (typeof window !== 'undefined') {
  // iOS 네이티브 햅틱 확인 콜백 함수
  (window as any).SMAP_HAPTIC_CONFIRMATION = (hapticType: string) => {
    console.log(`🎉 [iOS-NATIVE] 햅틱 실행 확인 수신: ${hapticType}`);
    
    // 확인 메시지가 수신되면 추가 로깅
    const env = detectIOSEnvironment();
    console.table({
      '햅틱 타입': hapticType,
      '확인 시각': new Date().toLocaleTimeString(),
      '환경': env.isIOSApp ? 'iOS App' : 'Unknown',
      '핸들러 존재': env.hasHandler,
      '페이지': getCurrentPageInfo().pageName
    });
  };
  
  console.log('🎮 [HAPTIC] iOS 네이티브 확인 콜백 함수 등록 완료');
}

export const hapticFeedback = {
  // 로그인/인증 관련
  loginSuccess: (context?: any) => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '로그인 성공', { action: 'login_success', ...context }),
  loginError: (context?: any) => triggerHapticFeedback(HapticFeedbackType.ERROR, '로그인 실패', { action: 'login_error', ...context }),
  logoutSuccess: (context?: any) => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '로그아웃 성공', { action: 'logout_success', ...context }),
  
  // 네비게이션 관련
  navigation: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '네비게이션', { action: 'navigation', ...context }),
  backButton: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '뒤로가기', { action: 'back_button', ...context }),
  menuSelect: (context?: any) => triggerHapticFeedback(HapticFeedbackType.LIGHT, '메뉴 선택', { action: 'menu_select', ...context }),
  
  // 홈 사이드바 전용 햅틱 (강화된 버전)
  homeSidebarOpen: (context?: any) => {
    console.log('🏠🔷 [HAPTIC-HOME] 사이드바 열기 - Medium 햅틱 피드백');
    return triggerHapticFeedback(HapticFeedbackType.MEDIUM, '홈 사이드바 열기', { 
      action: 'home_sidebar_open', 
      component: 'home-sidebar',
      state: 'opening',
      ...context 
    });
  },
  homeSidebarClose: (context?: any) => {
    console.log('🏠💡 [HAPTIC-HOME] 사이드바 닫기 - Light 햅틱 피드백');
    return triggerHapticFeedback(HapticFeedbackType.LIGHT, '홈 사이드바 닫기', { 
      action: 'home_sidebar_close', 
      component: 'home-sidebar',
      state: 'closing',
      ...context 
    });
  },
  
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

/**
 * 전역 테스트용 햅틱 함수들 (웹 콘솔에서 직접 사용 가능)
 */
if (typeof window !== 'undefined') {
  // 🚨 강제 햅틱 테스트 함수 (로그 제한 적용)
  (window as any).SMAP_FORCE_HAPTIC = (type: string = 'success') => {
    // 🚨 중복 실행 방지 (1초 내 동일한 타입 호출 차단)
    const now = Date.now();
    const lastCall = (window as any).__LAST_HAPTIC_CALL__ || {};
    if (lastCall[type] && (now - lastCall[type]) < 1000) {
      return `⏳ 햅틱 중복 실행 방지: ${type} (1초 대기)`;
    }
    
    (window as any).__LAST_HAPTIC_CALL__ = lastCall;
    lastCall[type] = now;
    
    // 🚨 로그 출력 최소화
    console.log(`🎮 [FORCE-HAPTIC] ${type} 테스트`);
    
    const hapticType = type as HapticFeedbackType;
    
    // 🚨 환경 감지 로그 제거 (디버깅 시에만 출력)
    const debugMode = (window as any).__HAPTIC_DEBUG_MODE__ === true;
    if (debugMode) {
      const env = detectIOSEnvironment();
      console.log(`🔍 [HAPTIC-ENV] 환경 감지:`, {
        isIOS: env.isIOS,
        isIOSApp: env.isIOSApp, 
        isIOSBrowser: env.isIOSBrowser,
        isWebView: env.isWebView,
        hasWebKit: env.hasWebKit,
        hasHandler: env.hasHandler
      });
    }
    
         // 강제 햅틱 실행 (로그 최소화)
     triggerHapticFeedback(hapticType, debugMode ? `강제 햅틱 테스트: ${type}` : undefined, { 
       source: 'console_test',
       forcedType: type,
       silent: !debugMode // 🚨 조용한 모드
     });
    
    return `✅ ${type} 햅틱 완료`;
  };
  
  // 모든 햅틱 타입 순차 테스트 함수
  (window as any).SMAP_TEST_ALL_HAPTICS = () => {
    console.log(`🎯 [ALL-HAPTICS-TEST] 모든 햅틱 타입 순차 테스트 시작`);
    
    const hapticTypes = ['light', 'medium', 'heavy', 'success', 'warning', 'error', 'selection'];
    let currentIndex = 0;
    
    const testNextHaptic = () => {
      if (currentIndex < hapticTypes.length) {
        const type = hapticTypes[currentIndex];
        console.log(`🔄 [HAPTIC-TEST] ${currentIndex + 1}/${hapticTypes.length} - ${type} 햅틱 테스트`);
        
        (window as any).SMAP_FORCE_HAPTIC(type);
        currentIndex++;
        
        // 1.5초 후 다음 햅틱 테스트
        setTimeout(testNextHaptic, 1500);
      } else {
        console.log(`🎉 [ALL-HAPTICS-TEST] 모든 햅틱 테스트 완료!`);
      }
    };
    
    testNextHaptic();
    return `🚀 모든 햅틱 타입 순차 테스트 시작됨 (총 ${hapticTypes.length}개)`;
  };
  
  // 간편 햅틱 함수들
  (window as any).smapHaptic = (type: string = 'success') => {
    const result = triggerHapticFeedback(
      type as HapticFeedbackType, 
      `간편 햅틱: ${type}`, 
      { source: 'smapHaptic' }
    );
    console.log(`✅ [SMAP-HAPTIC] ${type} 햅틱 실행 완료`);
    return result;
  };
  
  (window as any).lightHaptic = () => (window as any).smapHaptic('light');
  (window as any).mediumHaptic = () => (window as any).smapHaptic('medium');
  (window as any).heavyHaptic = () => (window as any).smapHaptic('heavy');
  (window as any).successHaptic = () => (window as any).smapHaptic('success');
  (window as any).errorHaptic = () => (window as any).smapHaptic('error');
  (window as any).warningHaptic = () => (window as any).smapHaptic('warning');
  
  console.log('🎮 [HAPTIC-GLOBALS] 전역 햅틱 테스트 함수들 등록 완료');
  console.log('📋 사용 가능한 함수들: SMAP_FORCE_HAPTIC(type), SMAP_TEST_ALL_HAPTICS(), smapHaptic(type), lightHaptic(), mediumHaptic(), heavyHaptic(), successHaptic(), errorHaptic(), warningHaptic()');
} 