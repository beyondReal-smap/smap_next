import { useEffect, useState } from 'react';

// 햅틱 피드백 전용 훅
export function useHapticFeedback() {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
  }, []);

  // 직접 webkit 메시지 핸들러를 통해 햅틱 요청
  const sendHapticMessage = (type: string) => {
    if (isIOS && (window as any).webkit?.messageHandlers?.smapIos) {
      (window as any).webkit.messageHandlers.smapIos.postMessage({
        type: 'haptic',
        param: type
      });
    }
  };

  // 햅틱 피드백 함수들
  const haptic = {
    // 가벼운 햅틱 (버튼 탭, 가벼운 상호작용)
    light: () => sendHapticMessage('light'),
    
    // 중간 햅틱 (중간 정도의 상호작용)
    medium: () => sendHapticMessage('medium'),
    
    // 강한 햅틱 (중요한 액션, 경고)
    heavy: () => sendHapticMessage('heavy'),
    
    // 성공 햅틱
    success: () => sendHapticMessage('success'),
    
    // 경고 햅틱
    warning: () => sendHapticMessage('warning'),
    
    // 에러 햅틱
    error: () => sendHapticMessage('error'),
    
    // 선택 변경 햅틱 (탭 전환, 선택 변경)
    selection: () => sendHapticMessage('selection'),
  };

  return {
    isIOS,
    haptic
  };
} 