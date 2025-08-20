import { useEffect, useState, useRef } from 'react';

interface UseAppStateOptions {
  onFocus?: () => void;
  onBlur?: () => void;
  onVisible?: () => void;
  onHidden?: () => void;
  delay?: number;
}

export const useAppState = (options: UseAppStateOptions = {}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { onFocus, onBlur, onVisible, onHidden, delay = 100 } = options;
  
  // 백그라운드 전환 시 안전한 상태 관리
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // App State 변경 감지 (iOS/Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 앱이 포그라운드로 돌아올 때
        setIsTransitioning(false);
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
        setIsTransitioning(true);
        // 백그라운드 전환 시 즉시 isVisible을 false로 설정하지 않고 지연
        // 기존 타이머가 있다면 제거
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        
        transitionTimeoutRef.current = setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            setIsVisible(false);
            onHidden?.();
          }
        }, 200); // 더 긴 지연 시간으로 안정성 향상
      }
    };

    // 페이지 포커스/블러 감지
    const handleFocus = () => {
      setIsTransitioning(false);
      setIsVisible(true);
      onVisible?.();
      if (onFocus) {
        setTimeout(() => {
          onFocus();
        }, delay);
      }
    };

    const handleBlur = () => {
      setIsTransitioning(true);
      // 백그라운드 전환 시 즉시 isVisible을 false로 설정하지 않고 지연
      // 기존 타이머가 있다면 제거
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      transitionTimeoutRef.current = setTimeout(() => {
        if (document.visibilityState === 'hidden') {
          setIsVisible(false);
          onBlur?.();
        }
      }, 200); // 더 긴 지연 시간으로 안정성 향상
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
      
      // 타이머 정리
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [onFocus, onBlur, onVisible, onHidden, delay]);

  return { isVisible, isTransitioning };
};

export default useAppState;
