'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import IOSCompatibleSpinner from './IOSCompatibleSpinner';

interface WhiteScreenGuardProps {
  children: React.ReactNode;
  fallbackToHome?: boolean;
  maxWaitTime?: number; // 최대 대기 시간 (ms)
  checkInterval?: number; // 체크 간격 (ms)
}

export default function WhiteScreenGuard({ 
  children, 
  fallbackToHome = true,
  maxWaitTime = 5000, // 5초
  checkInterval = 1000 // 1초마다 체크
}: WhiteScreenGuardProps) {
  const router = useRouter();
  const [isWhiteScreen, setIsWhiteScreen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [renderTime, setRenderTime] = useState<number>(Date.now());
  const checkRef = useRef<NodeJS.Timeout>();
  const recoveryRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // 흰 화면 감지 함수
  const detectWhiteScreen = (): boolean => {
    if (!containerRef.current) return false;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // 컨테이너가 보이지 않거나 크기가 0인 경우
    if (rect.width === 0 || rect.height === 0) {
      return true;
    }

    // HTML2Canvas를 사용하여 실제 화면 내용 분석 (선택적)
    try {
      // 간단한 DOM 기반 감지
      const hasContent = container.children.length > 0;
      const hasText = container.textContent && container.textContent.trim().length > 0;
      const hasVisibleElements = Array.from(container.querySelectorAll('*')).some(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      return !hasContent || (!hasText && !hasVisibleElements);
    } catch (error) {
      console.warn('[WhiteScreenGuard] 화면 감지 중 오류:', error);
      return false;
    }
  };

  // 복구 시도 함수
  const attemptRecovery = () => {
    console.warn('[WhiteScreenGuard] 흰 화면 감지됨 - 복구 시도 중...');
    setIsRecovering(true);
    
    // 3초 후에도 복구되지 않으면 홈으로 이동
    recoveryRef.current = setTimeout(() => {
      if (fallbackToHome) {
        console.error('[WhiteScreenGuard] 복구 실패 - 홈으로 이동');
        router.push('/home');
      } else {
        console.error('[WhiteScreenGuard] 복구 실패 - 페이지 새로고침');
        window.location.reload();
      }
    }, 3000);
  };

  // 정기적인 화면 상태 체크
  useEffect(() => {
    const startTime = Date.now();
    
    const checkScreen = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      // 최대 대기 시간 초과 시 체크 중단
      if (elapsed > maxWaitTime) {
        console.log('[WhiteScreenGuard] 최대 대기 시간 초과 - 체크 중단');
        return;
      }
      
      if (detectWhiteScreen()) {
        if (!isWhiteScreen) {
          setIsWhiteScreen(true);
          attemptRecovery();
        }
      } else {
        if (isWhiteScreen) {
          console.log('[WhiteScreenGuard] 화면 복구됨');
          setIsWhiteScreen(false);
          setIsRecovering(false);
          if (recoveryRef.current) {
            clearTimeout(recoveryRef.current);
          }
        }
      }
      
      // 다음 체크 예약
      checkRef.current = setTimeout(checkScreen, checkInterval);
    };

    // 첫 번째 체크 시작
    checkRef.current = setTimeout(checkScreen, checkInterval);

    return () => {
      if (checkRef.current) {
        clearTimeout(checkRef.current);
      }
      if (recoveryRef.current) {
        clearTimeout(recoveryRef.current);
      }
    };
  }, [isWhiteScreen, fallbackToHome, maxWaitTime, checkInterval, router]);

  // 렌더링 완료 감지
  useEffect(() => {
    const handleRenderComplete = () => {
      setRenderTime(Date.now());
      
      // 렌더링 완료 후 1초 뒤에 화면 상태 체크
      setTimeout(() => {
        if (detectWhiteScreen()) {
          console.warn('[WhiteScreenGuard] 렌더링 완료 후 흰 화면 감지');
          setIsWhiteScreen(true);
          attemptRecovery();
        }
      }, 1000);
    };

    // 여러 이벤트로 렌더링 완료 감지
    window.addEventListener('load', handleRenderComplete);
    document.addEventListener('DOMContentLoaded', handleRenderComplete);
    
    // React 렌더링 완료 감지를 위한 MutationObserver
    const observer = new MutationObserver(() => {
      handleRenderComplete();
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }

    return () => {
      window.removeEventListener('load', handleRenderComplete);
      document.removeEventListener('DOMContentLoaded', handleRenderComplete);
      observer.disconnect();
    };
  }, []);

  // 복구 중일 때 로딩 화면 표시
  if (isRecovering) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center z-50">
        <div className="text-center">
          <IOSCompatibleSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">화면 복구 중...</p>
          <p className="mt-2 text-sm text-gray-500">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="white-screen-guard-container">
      {children}
      
      {/* 디버깅용 정보 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded opacity-50">
          <div>Render: {new Date(renderTime).toLocaleTimeString()}</div>
          <div>White: {isWhiteScreen ? 'Yes' : 'No'}</div>
          <div>Recovering: {isRecovering ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}
