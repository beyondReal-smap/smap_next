import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseTermsPageStateOptions {
  pageName: string;
  isEmbed?: boolean;
}

export const useTermsPageState = ({ pageName, isEmbed = false }: UseTermsPageStateOptions) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 스타일 적용 함수
  const applyStyles = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isEmbed) {
      // embed 모드일 때는 내부 웹뷰처럼 작동
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.background = 'white';
      document.documentElement.style.position = 'relative';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      
      // iOS에서 추가 최적화
      if (isIOS) {
        document.body.style.setProperty('-webkit-overflow-scrolling', 'touch');
        document.body.style.setProperty('-webkit-transform', 'translateZ(0)');
        document.body.style.setProperty('-webkit-backface-visibility', 'hidden');
      }
    } else {
      document.body.style.overflowY = 'auto';
      document.documentElement.style.overflowY = 'auto';
    }
  }, [isEmbed]);

  // 스타일 복원 함수
  const restoreStyles = useCallback(() => {
    document.body.style.position = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.body.style.minHeight = '';
    document.body.style.background = '';
    document.body.style.removeProperty('-webkit-overflow-scrolling');
    document.body.style.removeProperty('-webkit-transform');
    document.body.style.removeProperty('-webkit-backface-visibility');
    document.documentElement.style.position = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.documentElement.style.overflowY = '';
  }, []);

  // 앱 상태 감지 및 복원
  const handleAppStateChange = useCallback((isActive: boolean) => {
    console.log(`[${pageName}] 앱 상태 변경:`, isActive ? '포그라운드' : '백그라운드');
    
    if (isActive) {
      // 앱이 포그라운드로 돌아올 때
      setIsVisible(true);
      setIsLoading(true);
      
      // 인증 상태 확인 및 복원
      setTimeout(() => {
        try {
          // 로컬 스토리지에서 인증 상태 확인
          const token = localStorage.getItem('auth_token');
          const userData = localStorage.getItem('user_data');
          
          if (token && userData) {
            console.log(`[${pageName}] 인증 상태 복원 성공`);
            // 스타일 재적용
            applyStyles();
          } else {
            console.log(`[${pageName}] 인증 상태 없음 - 로그인 페이지로 이동`);
            router.push('/signin');
            return;
          }
        } catch (error) {
          console.error(`[${pageName}] 인증 상태 복원 실패:`, error);
          router.push('/signin');
          return;
        } finally {
          setIsLoading(false);
        }
      }, 100);
    } else {
      // 앱이 백그라운드로 갈 때
      setIsVisible(false);
      restoreStyles();
    }
  }, [pageName, router, applyStyles, restoreStyles]);

  // 앱 상태 감지 이벤트 리스너
  useEffect(() => {
    const handleVisibilityChange = () => {
      handleAppStateChange(document.visibilityState === 'visible');
    };

    const handleFocus = () => {
      handleAppStateChange(true);
    };

    const handleBlur = () => {
      handleAppStateChange(false);
    };

    // iOS WebView 전용 이벤트
    const handlePageShow = () => {
      handleAppStateChange(true);
    };

    const handlePageHide = () => {
      handleAppStateChange(false);
    };

    // 이벤트 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [handleAppStateChange]);

  // 초기화
  useEffect(() => {
    // 초기 스타일 적용
    applyStyles();

    return () => {
      // cleanup 시 스타일 복원
      restoreStyles();
    };
  }, [applyStyles, restoreStyles]);

  return {
    isVisible,
    isLoading,
    applyStyles,
    restoreStyles
  };
};

export default useTermsPageState;
