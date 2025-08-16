import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UseTermsPageStateOptions {
  pageName: string;
  isEmbed?: boolean;
}

export const useTermsPageState = ({ pageName, isEmbed = false }: UseTermsPageStateOptions) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 인증 상태 추적을 위한 ref
  const authCheckRef = useRef<boolean>(false);
  const lastAuthCheckRef = useRef<number>(0);

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

  // 인증 상태 확인 및 복원 함수
  const checkAndRestoreAuth = useCallback(async () => {
    const now = Date.now();
    
    // 마지막 인증 확인 후 5초 이내면 스킵 (중복 체크 방지)
    if (now - lastAuthCheckRef.current < 5000) {
      console.log(`[${pageName}] 인증 확인 스킵 (최근 확인됨)`);
      return true;
    }
    
    try {
      console.log(`[${pageName}] 인증 상태 확인 중...`);
      
      // 로컬 스토리지에서 인증 상태 확인
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        // 토큰 유효성 추가 검증
        try {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const isExpired = tokenData.exp * 1000 < now;
          
          if (isExpired) {
            console.log(`[${pageName}] 토큰 만료됨`);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            return false;
          }
        } catch (parseError) {
          console.warn(`[${pageName}] 토큰 파싱 실패, 기본 검증만 수행`);
        }
        
        console.log(`[${pageName}] 인증 상태 확인 성공`);
        lastAuthCheckRef.current = now;
        authCheckRef.current = true;
        return true;
      } else {
        console.log(`[${pageName}] 인증 데이터 없음`);
        authCheckRef.current = false;
        return false;
      }
    } catch (error) {
      console.error(`[${pageName}] 인증 상태 확인 실패:`, error);
      authCheckRef.current = false;
      return false;
    }
  }, [pageName]);

  // 앱 상태 감지 및 복원
  const handleAppStateChange = useCallback(async (isActive: boolean) => {
    console.log(`[${pageName}] 앱 상태 변경:`, isActive ? '포그라운드' : '백그라운드');
    
    if (isActive) {
      // 앱이 포그라운드로 돌아올 때
      setIsVisible(true);
      setIsLoading(true);
      
      // 인증 상태 확인 및 복원
      const authValid = await checkAndRestoreAuth();
      
      if (authValid) {
        console.log(`[${pageName}] 인증 상태 복원 성공 - 스타일 재적용`);
        // 스타일 재적용
        applyStyles();
        
        // 초기화 완료 표시
        setTimeout(() => {
          setIsInitialized(true);
          setIsLoading(false);
        }, 300);
      } else {
        console.log(`[${pageName}] 인증 상태 없음 - 로그인 페이지로 이동`);
        router.push('/signin');
        return;
      }
    } else {
      // 앱이 백그라운드로 갈 때
      setIsVisible(false);
      setIsInitialized(false);
      restoreStyles();
    }
  }, [pageName, router, applyStyles, restoreStyles, checkAndRestoreAuth]);

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
    const initializePage = async () => {
      console.log(`[${pageName}] 페이지 초기화 시작`);
      
      // 초기 스타일 적용
      applyStyles();
      
      // 초기 인증 상태 확인
      const authValid = await checkAndRestoreAuth();
      
      if (authValid) {
        console.log(`[${pageName}] 초기 인증 상태 확인 성공`);
        setIsInitialized(true);
        setIsLoading(false);
      } else {
        console.log(`[${pageName}] 초기 인증 상태 확인 실패 - 로그인 페이지로 이동`);
        router.push('/signin');
        return;
      }
    };

    initializePage();

    return () => {
      // cleanup 시 스타일 복원
      restoreStyles();
    };
  }, [applyStyles, restoreStyles, checkAndRestoreAuth, router, pageName]);

  return {
    isVisible,
    isLoading,
    isInitialized,
    applyStyles,
    restoreStyles
  };
};

export default useTermsPageState;
