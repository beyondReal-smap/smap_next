import { useEffect, useState } from 'react';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

// 햅틱 피드백 전용 훅 (통합 버전)
export function useHapticFeedback() {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
  }, []);

  // 햅틱 피드백 함수들 (통합된 triggerHapticFeedback 사용)
  const haptic = {
    // 가벼운 햅틱 (버튼 탭, 가벼운 상호작용)
    light: () => triggerHapticFeedback(HapticFeedbackType.LIGHT),
    
    // 중간 햅틱 (중간 정도의 상호작용)
    medium: () => triggerHapticFeedback(HapticFeedbackType.MEDIUM),
    
    // 강한 햅틱 (중요한 액션, 경고)
    heavy: () => triggerHapticFeedback(HapticFeedbackType.HEAVY),
    
    // 성공 햅틱
    success: () => triggerHapticFeedback(HapticFeedbackType.SUCCESS),
    
    // 경고 햅틱
    warning: () => triggerHapticFeedback(HapticFeedbackType.WARNING),
    
    // 에러 햅틱
    error: () => triggerHapticFeedback(HapticFeedbackType.ERROR),
    
    // 선택 변경 햅틱 (탭 전환, 선택 변경)
    selection: () => triggerHapticFeedback(HapticFeedbackType.SELECTION),
  };

  return {
    isIOS,
    haptic
  };
} 