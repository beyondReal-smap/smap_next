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
 * iOS 네이티브 로그 전송 함수
 */
const sendLogToiOS = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
  const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
  if (isIOSWebView && (window as any).webkit?.messageHandlers?.smapIos) {
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
 * 햅틱 피드백 실행 함수
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
    const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    
    // 상세 로그 정보 구성
    const logInfo = {
      hapticType: type,
      description: description || '',
      page: pageInfo.pageName,
      fullPath: pageInfo.pathname,
      timestamp: pageInfo.timestamp,
      context: context || {},
      environment: isIOSWebView ? 'iOS WebView' : 'Web Browser'
    };
    
    // 로그 메시지 포맷팅
    const logMessage = [
      `[HAPTIC FEEDBACK]`,
      `Type: ${type.toUpperCase()}`,
      `Page: ${pageInfo.pageName} (${pageInfo.pathname})`,
      description ? `Action: ${description}` : '',
      context?.action ? `Context: ${context.action}` : '',
      context?.component ? `Component: ${context.component}` : '',
      `Time: ${new Date().toLocaleTimeString()}`
    ].filter(Boolean).join(' | ');
    
    if (isIOSWebView && (window as any).webkit?.messageHandlers?.smapIos) {
      // iOS 네이티브 햅틱 피드백
      const hapticData = {
        type: 'hapticFeedback',
        param: JSON.stringify({
          feedbackType: type,
          description: description || '',
          pageInfo,
          context: context || {}
        })
      };
      
      (window as any).webkit.messageHandlers.smapIos.postMessage(hapticData);
      
      // iOS 네이티브 로그 전송
      sendLogToiOS('info', `햅틱 피드백 실행: ${type}`, logInfo);
      
      console.log(`🔥 ${logMessage}`);
    } else {
      // 웹 브라우저 바이브레이션 API 사용
      if ('vibrate' in navigator) {
        const vibrationPattern = getVibrationPattern(type);
        navigator.vibrate(vibrationPattern);
        console.log(`🔥 ${logMessage} | Vibration: ${vibrationPattern}ms`);
      } else {
        console.log(`🔥 ${logMessage} | 햅틱 미지원 환경`);
      }
    }
    
    // 추가 디버그 정보 (개발환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.table({
        '햅틱 타입': type,
        '페이지': pageInfo.pageName,
        '경로': pageInfo.pathname,
        '설명': description || '없음',
        '환경': isIOSWebView ? 'iOS WebView' : 'Web Browser',
        '시간': new Date().toLocaleString('ko-KR')
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('🔥 [HAPTIC] 햅틱 피드백 실행 실패:', error);
    sendLogToiOS('error', '햅틱 피드백 실행 실패', { error: errorMessage });
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