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
 * 햅틱 피드백 실행 함수
 * @param type 햅틱 피드백 타입
 * @param description 로그용 설명
 */
export const triggerHapticFeedback = (type: HapticFeedbackType, description?: string) => {
  try {
    const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    
    if (isIOSWebView && (window as any).webkit?.messageHandlers?.smapIos) {
      // iOS 네이티브 햅틱 피드백
      const hapticData = {
        type: 'hapticFeedback',
        param: JSON.stringify({
          feedbackType: type,
          description: description || ''
        })
      };
      
      (window as any).webkit.messageHandlers.smapIos.postMessage(hapticData);
      console.log(`[HAPTIC] iOS 햅틱 피드백 전송: ${type}${description ? ` - ${description}` : ''}`);
    } else {
      // 웹 브라우저 바이브레이션 API 사용
      if ('vibrate' in navigator) {
        const vibrationPattern = getVibrationPattern(type);
        navigator.vibrate(vibrationPattern);
        console.log(`[HAPTIC] 웹 바이브레이션 실행: ${type} (${vibrationPattern}ms)${description ? ` - ${description}` : ''}`);
      } else {
        console.log(`[HAPTIC] 햅틱 피드백 미지원 환경: ${type}${description ? ` - ${description}` : ''}`);
      }
    }
  } catch (error) {
    console.error('[HAPTIC] 햅틱 피드백 실행 실패:', error);
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
  // 네비게이션 관련
  navigation: () => triggerHapticFeedback(HapticFeedbackType.LIGHT, '네비게이션'),
  backButton: () => triggerHapticFeedback(HapticFeedbackType.LIGHT, '뒤로가기'),
  menuSelect: () => triggerHapticFeedback(HapticFeedbackType.LIGHT, '메뉴 선택'),
  
  // 데이터 로딩 관련
  dataLoadStart: () => triggerHapticFeedback(HapticFeedbackType.LIGHT, '데이터 로딩 시작'),
  dataLoadComplete: () => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '데이터 로딩 완료'),
  dataLoadError: () => triggerHapticFeedback(HapticFeedbackType.ERROR, '데이터 로딩 실패'),
  
  // UI 상호작용
  buttonClick: () => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '버튼 클릭'),
  toggle: () => triggerHapticFeedback(HapticFeedbackType.MEDIUM, '토글'),
  sliderMove: () => triggerHapticFeedback(HapticFeedbackType.SELECTION, '슬라이더 이동'),
  
  // 상태 변경
  success: () => triggerHapticFeedback(HapticFeedbackType.SUCCESS, '성공'),
  error: () => triggerHapticFeedback(HapticFeedbackType.ERROR, '에러'),
  warning: () => triggerHapticFeedback(HapticFeedbackType.WARNING, '경고'),
}; 