import { useEffect, useState } from 'react';

interface UseAppStateOptions {
  onFocus?: () => void;
  onBlur?: () => void;
  onVisible?: () => void;
  onHidden?: () => void;
  delay?: number;
}

export const useAppState = (options: UseAppStateOptions = {}) => {
  const [isVisible, setIsVisible] = useState(true);
  const { onFocus, onBlur, onVisible, onHidden, delay = 100 } = options;

  useEffect(() => {
    // App State 변경 감지 (iOS/Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 앱이 포그라운드로 돌아올 때
        setIsVisible(true);
        onVisible?.();
        // 약간의 지연 후 콜백 실행
        if (onFocus) {
          setTimeout(() => {
            onFocus();
          }, delay);
        }
      } else {
        // 앱이 백그라운드로 갈 때
        setIsVisible(false);
        onHidden?.();
      }
    };

    // 페이지 포커스/블러 감지
    const handleFocus = () => {
      setIsVisible(true);
      onVisible?.();
      if (onFocus) {
        setTimeout(() => {
          onFocus();
        }, delay);
      }
    };

    const handleBlur = () => {
      setIsVisible(false);
      onBlur?.();
    };

    // 이벤트 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // iOS에서 추가 이벤트 감지
    if (typeof window !== 'undefined') {
      // iOS Safari에서 페이지가 다시 활성화될 때
      window.addEventListener('pageshow', handleFocus);
      window.addEventListener('pagehide', handleBlur);
    }

    return () => {
      // 이벤트 리스너 제거
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      if (typeof window !== 'undefined') {
        window.removeEventListener('pageshow', handleFocus);
        window.removeEventListener('pagehide', handleBlur);
      }
    };
  }, [onFocus, onBlur, onVisible, onHidden, delay]);

  return { isVisible };
};

export default useAppState;
