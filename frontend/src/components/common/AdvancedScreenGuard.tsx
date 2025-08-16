'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import IOSCompatibleSpinner from './IOSCompatibleSpinner';

interface AdvancedScreenGuardProps {
  children: React.ReactNode;
  fallbackToHome?: boolean;
  enableAutoRecovery?: boolean;
  recoveryAttempts?: number;
  checkInterval?: number;
  className?: string;
}

interface ScreenState {
  hasContent: boolean;
  hasVisibleElements: boolean;
  hasText: boolean;
  hasImages: boolean;
  hasInteractiveElements: boolean;
  containerSize: { width: number; height: number };
  lastUpdate: number;
}

export default function AdvancedScreenGuard({
  children,
  fallbackToHome = true,
  enableAutoRecovery = true,
  recoveryAttempts = 3,
  checkInterval = 2000,
  className = ''
}: AdvancedScreenGuardProps) {
  const router = useRouter();
  const [screenState, setScreenState] = useState<ScreenState>({
    hasContent: false,
    hasVisibleElements: false,
    hasText: false,
    hasImages: false,
    hasInteractiveElements: false,
    containerSize: { width: 0, height: 0 },
    lastUpdate: Date.now()
  });
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [lastRecoveryTime, setLastRecoveryTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>();

  // 화면 상태 분석 함수
  const analyzeScreenState = useCallback((): ScreenState => {
    if (!containerRef.current) {
      return {
        hasContent: false,
        hasVisibleElements: false,
        hasText: false,
        hasImages: false,
        hasInteractiveElements: false,
        containerSize: { width: 0, height: 0 },
        lastUpdate: Date.now()
      };
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // 컨테이너 크기 확인
    const containerSize = {
      width: rect.width,
      height: rect.height
    };

    // DOM 요소 분석
    const allElements = Array.from(container.querySelectorAll('*'));
    const visibleElements = allElements.filter(el => {
      const style = window.getComputedStyle(el);
      const htmlEl = el as HTMLElement;
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             parseFloat(style.opacity) > 0 &&
             htmlEl.offsetWidth > 0 && 
             htmlEl.offsetHeight > 0;
    });

    // 텍스트 내용 확인
    const hasText = !!(container.textContent && 
                   container.textContent.trim().length > 10); // 최소 10자 이상

    // 이미지 요소 확인
    const hasImages = container.querySelectorAll('img, svg, canvas').length > 0;

    // 인터랙티브 요소 확인
    const hasInteractiveElements = container.querySelectorAll('button, a, input, select, textarea').length > 0;

    // 실제 콘텐츠가 있는지 확인
    const hasContent = visibleElements.length > 0 && (hasText || hasImages || hasInteractiveElements);

    return {
      hasContent,
      hasVisibleElements: visibleElements.length > 0,
      hasText,
      hasImages,
      hasInteractiveElements,
      containerSize,
      lastUpdate: Date.now()
    };
  }, []);

           // 흰 화면 판단 함수 - 홈 페이지는 더 관대하게 처리
         const isWhiteScreen = useCallback((state: ScreenState): boolean => {
           // 컨테이너가 너무 작거나 없는 경우
           if (state.containerSize.width < 100 || state.containerSize.height < 100) {
             return true;
           }
       
           // 홈 페이지는 더 관대하게 처리
           const isHomePage = window.location.pathname === '/home';
           
           if (isHomePage) {
             // 홈 페이지는 기본적으로 콘텐츠가 있다고 가정 (로딩 중일 수 있음)
             if (state.containerSize.width > 200 && state.containerSize.height > 200) {
               console.log('[AdvancedScreenGuard] 홈 페이지 - 콘텐츠 로딩 중으로 간주');
               return false;
             }
           }
       
           // 콘텐츠가 전혀 없는 경우
           if (!state.hasContent) {
             return true;
           }
       
           // 텍스트, 이미지, 인터랙티브 요소가 모두 없는 경우
           if (!state.hasText && !state.hasImages && !state.hasInteractiveElements) {
             return true;
           }
       
           return false;
         }, []);

  // 복구 시도 함수
  const attemptRecovery = useCallback(async () => {
    if (recoveryCount >= recoveryAttempts) {
      console.error(`[AdvancedScreenGuard] 최대 복구 시도 횟수 초과 (${recoveryAttempts}회)`);
      
      if (fallbackToHome) {
        router.push('/home');
      } else {
        window.location.reload();
      }
      return;
    }

    const now = Date.now();
    const timeSinceLastRecovery = now - lastRecoveryTime;
    
    // 마지막 복구 시도 후 10초 이내면 스킵
    if (timeSinceLastRecovery < 10000) {
      console.log('[AdvancedScreenGuard] 복구 시도 간격이 너무 짧음, 스킵');
      return;
    }

    console.warn(`[AdvancedScreenGuard] 흰 화면 감지 - 복구 시도 ${recoveryCount + 1}/${recoveryAttempts}`);
    
    setIsRecovering(true);
    setRecoveryCount(prev => prev + 1);
    setLastRecoveryTime(now);

    // 복구 시도 (여러 방법)
    try {
      // 1. DOM 강제 업데이트
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
        containerRef.current.offsetHeight; // 강제 리플로우
        containerRef.current.style.display = '';
      }

      // 2. 이벤트 트리거
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));

      // 3. 3초 후 복구 상태 해제
      recoveryTimeoutRef.current = setTimeout(() => {
        setIsRecovering(false);
        
        // 복구 후 화면 상태 재확인
        setTimeout(() => {
          const newState = analyzeScreenState();
          if (isWhiteScreen(newState)) {
            console.warn('[AdvancedScreenGuard] 복구 후에도 흰 화면 상태');
            // 추가 복구 시도
            if (enableAutoRecovery) {
              attemptRecovery();
            }
          } else {
            console.log('[AdvancedScreenGuard] 화면 복구 성공');
            setRecoveryCount(0); // 복구 성공 시 카운트 리셋
          }
        }, 1000);
      }, 3000);

    } catch (error) {
      console.error('[AdvancedScreenGuard] 복구 시도 중 오류:', error);
      setIsRecovering(false);
    }
  }, [recoveryCount, recoveryAttempts, lastRecoveryTime, fallbackToHome, enableAutoRecovery, router, analyzeScreenState, isWhiteScreen]);

  // 정기적인 화면 상태 체크
  useEffect(() => {
    const checkScreen = () => {
      const currentState = analyzeScreenState();
      setScreenState(currentState);

      if (isWhiteScreen(currentState)) {
        console.warn('[AdvancedScreenGuard] 흰 화면 감지됨:', currentState);
        attemptRecovery();
      }
    };

    // 첫 번째 체크는 즉시 실행
    checkScreen();
    
    // 이후 정기적으로 체크
    checkIntervalRef.current = setInterval(checkScreen, checkInterval);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [analyzeScreenState, isWhiteScreen, attemptRecovery, checkInterval]);

  // 복구 중일 때 로딩 화면 표시
  if (isRecovering) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center z-50">
        <div className="text-center">
          <IOSCompatibleSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">
            화면 복구 중... ({recoveryCount}/{recoveryAttempts})
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {recoveryCount >= recoveryAttempts ? '최대 시도 횟수에 도달했습니다' : '잠시만 기다려주세요'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`advanced-screen-guard ${className}`}
      data-screen-state={JSON.stringify(screenState)}
    >
      {children}
      
      {/* 디버깅 정보 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded opacity-75 max-w-xs">
          <div className="font-bold mb-2">AdvancedScreenGuard</div>
          <div>Content: {screenState.hasContent ? '✅' : '❌'}</div>
          <div>Elements: {screenState.hasVisibleElements ? '✅' : '❌'}</div>
          <div>Text: {screenState.hasText ? '✅' : '❌'}</div>
          <div>Images: {screenState.hasImages ? '✅' : '❌'}</div>
          <div>Interactive: {screenState.hasInteractiveElements ? '✅' : '❌'}</div>
          <div>Size: {screenState.containerSize.width}x{screenState.containerSize.height}</div>
          <div>Recovery: {recoveryCount}/{recoveryAttempts}</div>
          <div className="text-xs opacity-75 mt-1">
            {new Date(screenState.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
