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
  const [isInitialized, setIsInitialized] = useState(true);
  
  // 인증 상태 추적을 위한 ref
  const authCheckRef = useRef<boolean>(false);
  const lastAuthCheckRef = useRef<number>(0);
  
  // 앱 상태 변경 추적을 위한 ref
  const appStateRef = useRef<'foreground' | 'background'>('foreground');
  const lastAppStateChangeRef = useRef<number>(0);

  // 스타일 적용 함수
  const applyStyles = useCallback(() => {
    // 약관 페이지에서는 전역 스타일 조작을 최소화
    // Next.js 레이아웃 시스템과의 충돌 방지
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isEmbed) {
        // 임베드 모드에서는 최소한의 스타일만 적용
        if (document.body) {
          document.body.style.setProperty('overflow', 'hidden', 'important');
        }
        if (document.documentElement) {
          document.documentElement.style.setProperty('overflow', 'hidden', 'important');
        }
      } else {
        // 일반 모드에서는 스타일 조작을 하지 않음
        // Next.js가 기본 스타일을 관리하도록 함
      }
      
      console.log(`[${pageName}] 스타일 적용 완료 - 모드: ${isEmbed ? 'embed' : 'normal'}`);
    } catch (error) {
      console.warn(`[${pageName}] 스타일 적용 중 오류 (무시됨):`, error);
    }
  }, [isEmbed, pageName]);

  // 스타일 복원 함수
  const restoreStyles = useCallback(() => {
    // 약관 페이지에서는 전역 스타일 복원을 최소화
    try {
      if (document.body) {
        document.body.style.removeProperty('overflow');
      }
      if (document.documentElement) {
        document.documentElement.style.removeProperty('overflow');
      }
      
      console.log(`[${pageName}] 스타일 복원 완료`);
    } catch (error) {
      console.warn(`[${pageName}] 스타일 복원 중 오류 (무시됨):`, error);
    }
  }, [pageName]);

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
    const now = Date.now();
    const newState = isActive ? 'foreground' : 'background';
    
    // 상태가 실제로 변경되었는지 확인
    if (appStateRef.current === newState) {
      console.log(`[${pageName}] 앱 상태 변경 스킵 (동일한 상태)`);
      return;
    }
    
    // 너무 빠른 상태 변경 방지 (100ms 이내)
    if (now - lastAppStateChangeRef.current < 100) {
      console.log(`[${pageName}] 앱 상태 변경 스킵 (너무 빠름)`);
      return;
    }
    
    console.log(`[${pageName}] 앱 상태 변경: ${appStateRef.current} → ${newState}`);
    
    appStateRef.current = newState;
    lastAppStateChangeRef.current = now;
    
    if (isActive) {
      // 앱이 포그라운드로 돌아올 때
      setIsVisible(true);
      
      // 약간의 지연 후 스타일 재적용 (DOM 업데이트 대기)
      setTimeout(() => {
        console.log(`[${pageName}] 포그라운드 복귀 - 스타일 재적용`);
        applyStyles();
        
        // 페이지 가시성 강제 업데이트
        if (document.hidden === false) {
          console.log(`[${pageName}] 페이지 가시성 확인됨 - 정상 상태`);
        }
      }, 100);
      
    } else {
      // 앱이 백그라운드로 갈 때
      setIsVisible(false);
      console.log(`[${pageName}] 백그라운드 전환 - 스타일 유지`);
      // 백그라운드에서는 스타일을 복원하지 않음 (약관 페이지 유지)
    }
  }, [pageName, applyStyles]);

  // 앱 상태 감지 이벤트 리스너
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      console.log(`[${pageName}] visibilitychange: ${isVisible ? 'visible' : 'hidden'}`);
      handleAppStateChange(isVisible);
    };

    const handleFocus = () => {
      console.log(`[${pageName}] window focus`);
      handleAppStateChange(true);
    };

    const handleBlur = () => {
      console.log(`[${pageName}] window blur`);
      handleAppStateChange(false);
    };

    // iOS WebView 전용 이벤트
    const handlePageShow = () => {
      console.log(`[${pageName}] pageshow`);
      handleAppStateChange(true);
    };

    const handlePageHide = () => {
      console.log(`[${pageName}] pagehide`);
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
    let isMounted = true;
    
    const initializePage = async () => {
      console.log(`[${pageName}] 약관 페이지 초기화 시작`);
      
      // 초기 스타일 적용
      applyStyles();
      
      // 약관 페이지는 즉시 초기화 완료 (인증 상태와 관계없이)
      if (isMounted) {
        console.log(`[${pageName}] 약관 페이지 초기화 완료`);
        setIsInitialized(true);
        setIsLoading(false);
        
        // 초기 앱 상태 설정
        appStateRef.current = document.hidden ? 'background' : 'foreground';
        console.log(`[${pageName}] 초기 앱 상태: ${appStateRef.current}`);
      }
    };

    // 약관 페이지는 즉시 초기화
    initializePage();

    return () => {
      isMounted = false;
      // cleanup 시 스타일 복원
      restoreStyles();
    };
  }, [applyStyles, restoreStyles, pageName]);

  return {
    isVisible,
    isLoading,
    isInitialized,
    applyStyles,
    restoreStyles
  };
};

export default useTermsPageState;
