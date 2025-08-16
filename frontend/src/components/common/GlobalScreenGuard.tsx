'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import IOSCompatibleSpinner from './IOSCompatibleSpinner';

interface GlobalScreenGuardProps {
  children: React.ReactNode;
  enableGlobalProtection?: boolean;
  enableAutoRedirect?: boolean;
  redirectDelay?: number;
  checkInterval?: number;
}

interface GlobalScreenState {
  isWhiteScreen: boolean;
  lastContentCheck: number;
  recoveryAttempts: number;
  isRecovering: boolean;
  pagePath: string;
  errorCount: number;
}

export default function GlobalScreenGuard({
  children,
  enableGlobalProtection = true,
  enableAutoRedirect = true,
  redirectDelay = 8000, // 8초
  checkInterval = 3000 // 3초
}: GlobalScreenGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [screenState, setScreenState] = useState<GlobalScreenState>({
    isWhiteScreen: false,
    lastContentCheck: Date.now(),
    recoveryAttempts: 0,
    isRecovering: false,
    pagePath: pathname,
    errorCount: 0
  });
  
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const redirectTimeoutRef = useRef<NodeJS.Timeout>();
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCheckRef = useRef<number>(Date.now());

  // 전역 화면 상태 체크
  const checkGlobalScreenState = useCallback((): boolean => {
    const now = Date.now();
    lastCheckRef.current = now;

    try {
      // 1. body 요소 확인
      const body = document.body;
      if (!body || body.children.length === 0) {
        console.warn('[GlobalScreenGuard] body 요소가 비어있음');
        return true;
      }

      // 2. 메인 콘텐츠 영역 확인
      const mainContent = document.querySelector('main, [role="main"], .main-content, #__next');
      if (mainContent) {
        const rect = mainContent.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 100) {
          console.warn('[GlobalScreenGuard] 메인 콘텐츠 영역이 너무 작음:', rect);
          return true;
        }
      }

      // 3. 전체 페이지 콘텐츠 확인
      const hasVisibleContent = Array.from(document.querySelectorAll('*')).some(el => {
        const style = window.getComputedStyle(el);
        const htmlEl = el as HTMLElement;
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         parseFloat(style.opacity) > 0;
        const hasSize = htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0;
        const hasText = el.textContent && el.textContent.trim().length > 0;
        
        return isVisible && hasSize && hasText;
      });

      if (!hasVisibleContent) {
        console.warn('[GlobalScreenGuard] 보이는 콘텐츠가 없음');
        return true;
      }

      // 4. 특정 페이지별 추가 검증
      if (pathname === '/home') {
        // 홈 페이지는 더 관대하게 검증 (여러 가능한 콘텐츠 요소 확인)
        const homeContent = document.querySelector('.home-content, [data-page="home"], #home-page-container, .main-container, main');
        const bodyElement = document.querySelector('body');
        const hasAnyContent = bodyElement && bodyElement.children.length > 0;
        
        if (!homeContent && !hasAnyContent) {
          console.warn('[GlobalScreenGuard] 홈 페이지 콘텐츠를 찾을 수 없음');
          return true;
        }
        
        // 홈 페이지는 기본적으로 콘텐츠가 있다고 가정 (로딩 중일 수 있음)
        console.log('[GlobalScreenGuard] 홈 페이지 콘텐츠 확인됨:', {
          hasHomeContent: !!homeContent,
          hasAnyContent,
          bodyChildren: bodyElement ? bodyElement.children.length : 0
        });
        return false; // 홈 페이지는 흰 화면이 아님
      }

      if (pathname.startsWith('/setting')) {
        // 설정 페이지 및 약관 페이지들 검증
        const settingContent = document.querySelector('.setting-content, [data-page="setting"], [data-page="/setting"]');
        const termsContent = document.querySelector('.terms-content, .privacy-content, .service-content, .location-content, .marketing-content, .third-party-content');
        const pageContent = document.querySelector('main, [role="main"], .main-content, #__next');
        
        // 설정 페이지 콘텐츠가 없고, 약관 콘텐츠도 없고, 페이지 콘텐츠도 없는 경우에만 흰 화면으로 간주
        if (!settingContent && !termsContent && !pageContent) {
          console.warn('[GlobalScreenGuard] 설정 페이지 콘텐츠를 찾을 수 없음');
          return true;
        }
        
        // 약관 페이지의 경우 추가 검증
        if (pathname.includes('/terms/') || pathname.includes('/service/')) {
          const hasAnyContent = document.querySelector('h1, h2, h3, p, div') !== null;
          if (!hasAnyContent) {
            console.warn('[GlobalScreenGuard] 약관 페이지 콘텐츠가 비어있음');
            return true;
          }
        }
      }

      return false; // 흰 화면이 아님
    } catch (error) {
      console.error('[GlobalScreenGuard] 화면 상태 체크 중 오류:', error);
      return true; // 에러 발생 시 흰 화면으로 간주
    }
  }, [pathname]);

  // 복구 시도
  const attemptRecovery = useCallback(async () => {
    const now = Date.now();
    
    if (screenState.isRecovering) {
      console.log('[GlobalScreenGuard] 이미 복구 중입니다');
      return;
    }

    console.warn(`[GlobalScreenGuard] 흰 화면 감지 - 복구 시도 ${screenState.recoveryAttempts + 1}`);
    
    setScreenState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    try {
      // 1. DOM 강제 업데이트
      document.body.style.display = 'none';
      document.body.offsetHeight; // 강제 리플로우
      document.body.style.display = '';

      // 2. 이벤트 트리거
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('focus'));

      // 3. 3초 후 복구 상태 해제
      recoveryTimeoutRef.current = setTimeout(() => {
        setScreenState(prev => ({ ...prev, isRecovering: false }));
        
        // 복구 후 재확인
        setTimeout(() => {
          const stillWhiteScreen = checkGlobalScreenState();
          if (stillWhiteScreen) {
            console.warn('[GlobalScreenGuard] 복구 후에도 흰 화면 상태');
            setScreenState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
          } else {
            console.log('[GlobalScreenGuard] 화면 복구 성공');
            setScreenState(prev => ({ 
              ...prev, 
              isWhiteScreen: false, 
              recoveryAttempts: 0,
              errorCount: 0
            }));
          }
        }, 1000);
      }, 3000);

    } catch (error) {
      console.error('[GlobalScreenGuard] 복구 시도 중 오류:', error);
      setScreenState(prev => ({ ...prev, isRecovering: false }));
    }
  }, [screenState.isRecovering, screenState.recoveryAttempts, checkGlobalScreenState]);

  // 홈으로 리다이렉트
  const redirectToHome = useCallback(() => {
    if (!enableAutoRedirect) return;
    
    console.error('[GlobalScreenGuard] 최대 복구 시도 실패 - 홈으로 이동');
    
    // 현재 페이지가 홈이 아닌 경우에만 이동
    if (pathname !== '/home') {
      router.push('/home');
    } else {
      // 홈 페이지에서도 문제가 있으면 새로고침
      window.location.reload();
    }
  }, [enableAutoRedirect, pathname, router]);

  // 정기적인 화면 상태 체크
  useEffect(() => {
    if (!enableGlobalProtection) return;

    const checkScreen = () => {
      const now = Date.now();
      const isWhiteScreen = checkGlobalScreenState();
      
      setScreenState(prev => ({
        ...prev,
        isWhiteScreen,
        lastContentCheck: now,
        pagePath: pathname
      }));

      if (isWhiteScreen) {
        console.warn('[GlobalScreenGuard] 전역 흰 화면 감지됨');
        attemptRecovery();
      }
    };

    // 홈 페이지는 렌더링 완료를 기다린 후 첫 번째 체크 실행
    if (pathname === '/home') {
      // 3초 후 첫 번째 체크 실행 (홈 페이지 렌더링 완료 대기)
      const initialCheckTimeout = setTimeout(() => {
        checkScreen();
        
        // 이후 정기적으로 체크
        checkIntervalRef.current = setInterval(checkScreen, checkInterval);
      }, 3000);
      
      return () => {
        clearTimeout(initialCheckTimeout);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    } else {
      // 다른 페이지는 즉시 체크 시작
      checkScreen();
      checkIntervalRef.current = setInterval(checkScreen, checkInterval);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enableGlobalProtection, checkInterval, pathname, attemptRecovery, checkGlobalScreenState]);

  // 에러 카운트가 높거나 복구 시도가 많으면 리다이렉트
  useEffect(() => {
    if (screenState.errorCount >= 3 || screenState.recoveryAttempts >= 5) {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      
      redirectTimeoutRef.current = setTimeout(() => {
        redirectToHome();
      }, redirectDelay);
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [screenState.errorCount, screenState.recoveryAttempts, redirectDelay, redirectToHome]);

  // 경로 변경 시 상태 리셋
  useEffect(() => {
    setScreenState(prev => ({
      ...prev,
      pagePath: pathname,
      recoveryAttempts: 0,
      errorCount: 0,
      isWhiteScreen: false
    }));
  }, [pathname]);

  // cleanup
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  // 복구 중일 때 로딩 화면 표시
  if (screenState.isRecovering) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center z-[9999]">
        <div className="text-center">
          <IOSCompatibleSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">
            화면 복구 중... ({screenState.recoveryAttempts}/5)
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {screenState.recoveryAttempts >= 5 ? '최대 시도 횟수에 도달했습니다' : '잠시만 기다려주세요'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            현재 페이지: {pathname}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* 디버깅 정보 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && enableGlobalProtection && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-3 rounded opacity-75 max-w-xs">
          <div className="font-bold mb-2">GlobalScreenGuard</div>
          <div>White Screen: {screenState.isWhiteScreen ? '❌' : '✅'}</div>
          <div>Recovery: {screenState.recoveryAttempts}/5</div>
          <div>Errors: {screenState.errorCount}/3</div>
          <div>Page: {pathname}</div>
          <div className="text-xs opacity-75 mt-1">
            {new Date(screenState.lastContentCheck).toLocaleTimeString()}
          </div>
        </div>
      )}
    </>
  );
}
