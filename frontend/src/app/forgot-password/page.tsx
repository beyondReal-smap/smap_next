'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiMail, FiSend, FiCheckCircle, FiAlertCircle, FiKey } from 'react-icons/fi';
import { HiOutlineChevronLeft } from 'react-icons/hi2';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';
import { hapticFeedback } from '@/utils/haptic';
import AnimatedHeader from '@/components/common/AnimatedHeader';

// window 객체 확장 (가비지 컬렉션용)
declare global {
  interface Window {
    gc?: () => void;
  }
}

// iOS 최적화를 위한 스타일
const pageStyles = `
/* iOS 스크롤 최적화 */
.forgot-password-container {
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
}

/* iOS WebView 안정성 */
.forgot-password-fixed {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 10 !important;
  background-color: white !important;
}

/* 헤더 padding 완전 제거 */
.forgot-password-header,
.forgot-password-header * {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}

/* AnimatedHeader 내부 요소 padding 제거 */
.forgot-password-header .flex {
  padding: 0px !important;
  margin: 0px !important;
}

/* 모든 헤더 관련 요소 강제 padding 제거 */
.forgot-password-header,
.forgot-password-header *,
.forgot-password-header header,
.forgot-password-header .motion-header,
.forgot-password-header [class*="header"] {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}

/* 전역 헤더 스타일 오버라이드 */
header[class*="forgot-password"],
header[class*="glass-effect"] {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}
`;

interface FormErrors {
  contact?: string;
  general?: string;
}

const ForgotPasswordPage = () => {
  const router = useRouter();
  const mountedRef = useRef(true);
  const componentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const stabilityTimersRef = useRef<NodeJS.Timeout[]>([]);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  
  // 상태 관리 - iOS 안정성을 위한 초기값 설정
  const [isPageReady, setIsPageReady] = useState(false);
  const [step, setStep] = useState<'input' | 'sent'>('input');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [contact, setContact] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // 에러 바운더리와 안정성 모니터링
  useEffect(() => {
    // 전역 에러 핸들러
    const handleGlobalError = (error: ErrorEvent) => {
      console.error('[FORGOT_PASSWORD] 전역 에러 감지:', error);
      
      // Next.js 관련 에러는 무시
      if (error.message && (
        error.message.includes('__next_') ||
        error.message.includes('Unexpected token') ||
        error.message.includes('SyntaxError') ||
        error.filename && error.filename.includes('_next/static')
      )) {
        console.warn('[FORGOT_PASSWORD] Next.js 스크립트 오류 무시:', error.message);
        return true;
      }
      
      // 페이지 크래시 방지
      if (mountedRef.current) {
        setCriticalError(`페이지 오류가 발생했습니다: ${error.message}`);
      }
      return true;
    };
    
    // Promise rejection 핸들러
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[FORGOT_PASSWORD] Promise rejection 감지:', event.reason);
      
      if (mountedRef.current && event.reason && event.reason.message) {
        // 네트워크 오류는 무시
        if (event.reason.message.includes('fetch') || event.reason.message.includes('network')) {
          console.warn('[FORGOT_PASSWORD] 네트워크 오류 무시');
          return;
        }
        
        setCriticalError(`요청 처리 중 오류: ${event.reason.message}`);
      }
      event.preventDefault();
    };
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // 페이지 안정성 모니터링 (4-5초 문제 해결)
  useEffect(() => {
    if (!isPageReady) return;
    
    console.log('[FORGOT_PASSWORD] 페이지 안정성 모니터링 시작');
    
    // 정기적으로 페이지 상태 확인 (1초마다 10번)
    let checkCount = 0;
    const stabilityCheck = setInterval(() => {
      checkCount++;
      
      if (!mountedRef.current) {
        clearInterval(stabilityCheck);
        return;
      }
      
      console.log(`[FORGOT_PASSWORD] 안정성 체크 ${checkCount}/10`, {
        mounted: mountedRef.current,
        pageReady: isPageReady,
        step: step,
        componentExists: !!componentRef.current
      });
      
      // 컴포넌트가 사라졌는지 확인
      if (componentRef.current && !document.contains(componentRef.current)) {
        console.error('[FORGOT_PASSWORD] 컴포넌트가 DOM에서 제거됨 - 복구 시도');
        if (mountedRef.current) {
          setCriticalError('페이지가 예상치 못하게 사라졌습니다. 새로고침합니다.');
        }
      }
      
      if (checkCount >= 10) {
        clearInterval(stabilityCheck);
        console.log('[FORGOT_PASSWORD] 안정성 모니터링 완료 - 페이지 안정됨');
      }
    }, 1000);
    
    stabilityTimersRef.current.push(stabilityCheck);
    
    return () => {
      clearInterval(stabilityCheck);
    };
  }, [isPageReady, step]);
  
  // iOS 감지 함수
  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);
  
  // 페이지 초기화 - iOS WebView 안정성 최적화
  useEffect(() => {
    let initTimer: NodeJS.Timeout;
    
    const initializePage = () => {
      console.log('[FORGOT_PASSWORD] 페이지 초기화 시작');
      
      if (!mountedRef.current) return;
      
      // iOS에서 추가 안정화 시간
      const delay = isIOS() ? 300 : 100;
      
      initTimer = setTimeout(() => {
        if (mountedRef.current && !isInitializedRef.current) {
          setIsPageReady(true);
          isInitializedRef.current = true;
          console.log('[FORGOT_PASSWORD] 페이지 준비 완료');
          
          // 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.navigation({ component: 'forgot-password', state: 'ready' });
          }
        }
      }, delay);
    };
    
    // DOM이 완전히 로드된 후 실행
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializePage);
    } else {
      initializePage();
    }
    
    return () => {
      mountedRef.current = false;
      if (initTimer) clearTimeout(initTimer);
      document.removeEventListener('DOMContentLoaded', initializePage);
      
      // 모든 타이머 정리
      stabilityTimersRef.current.forEach(timer => clearTimeout(timer));
      stabilityTimersRef.current = [];
    };
  }, [isIOS]);
  
  // iOS WebView 메모리 최적화 및 안정성 강화 (강화된 버전)
  useEffect(() => {
    if (!isPageReady || !isIOS()) return;
    
    console.log('[FORGOT_PASSWORD] iOS WebView 메모리 최적화 시작');
    
    // 🚨 페이지 완전 고정 (iOS WebView에서 사라지는 것 방지)
    const freezePageForIOS = () => {
      console.log('[FORGOT_PASSWORD] iOS 페이지 고정 시작');
      
      // body와 html 스타일 강제 고정
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.zIndex = '1';
      document.body.style.backgroundColor = 'white';
      
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.top = '0';
      document.documentElement.style.left = '0';
      document.documentElement.style.right = '0';
      document.documentElement.style.bottom = '0';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.zIndex = '1';
      
      // iOS WebView 전용 스타일
      document.body.style.webkitTransform = 'translateZ(0)';
      document.body.style.webkitBackfaceVisibility = 'hidden';
      document.body.style.webkitPerspective = '1000px';
      document.body.style.touchAction = 'none';
      document.body.style.webkitUserSelect = 'none';
      (document.body.style as any).webkitTouchCallout = 'none';
      (document.body.style as any).webkitTapHighlightColor = 'transparent';
      
      // 전역 플래그 설정
      (window as any).__FORGOT_PASSWORD_FROZEN__ = true;
    };
    
    // 페이지 고정 해제
    const unfreezePageForIOS = () => {
      console.log('[FORGOT_PASSWORD] iOS 페이지 고정 해제');
      
      // 스타일 복원
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.body.style.zIndex = '';
      document.body.style.backgroundColor = '';
      document.body.style.webkitTransform = '';
      document.body.style.webkitBackfaceVisibility = '';
      document.body.style.webkitPerspective = '';
      document.body.style.touchAction = '';
      document.body.style.webkitUserSelect = '';
      (document.body.style as any).webkitTouchCallout = '';
      (document.body.style as any).webkitTapHighlightColor = '';
      
      document.documentElement.style.position = '';
      document.documentElement.style.top = '';
      document.documentElement.style.left = '';
      document.documentElement.style.right = '';
      document.documentElement.style.bottom = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.zIndex = '';
      
      // 전역 플래그 해제
      delete (window as any).__FORGOT_PASSWORD_FROZEN__;
    };
    
    // 즉시 페이지 고정
    freezePageForIOS();
    
    // iOS WebView에서 메모리 경고 감지
    const handleMemoryWarning = () => {
      console.warn('[FORGOT_PASSWORD] iOS 메모리 경고 감지 - 가비지 컬렉션 실행');
      
      // 불필요한 변수 정리
      if (window.gc) {
        window.gc();
      }
      
      // DOM 정리
      const unusedElements = document.querySelectorAll('[data-cleanup="true"]');
      unusedElements.forEach(el => el.remove());
      
      // 페이지 재고정 (메모리 정리 후)
      setTimeout(freezePageForIOS, 100);
    };
    
    // visibilitychange 이벤트로 메모리 경고 간접 감지
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[FORGOT_PASSWORD] 페이지가 숨겨짐 - 메모리 정리 준비');
        setTimeout(handleMemoryWarning, 100);
      } else {
        console.log('[FORGOT_PASSWORD] 페이지가 다시 표시됨');
        
        // 페이지가 다시 표시될 때 상태 확인
        if (mountedRef.current && componentRef.current) {
          if (!document.contains(componentRef.current)) {
            console.error('[FORGOT_PASSWORD] 컴포넌트가 사라짐 - 복구 필요');
            setCriticalError('페이지가 사라졌습니다. 새로고침이 필요합니다.');
          }
        }
      }
    };
    
    // 자동 리로드/리디렉션 방지
    const preventAutoReload = (event: BeforeUnloadEvent) => {
      console.warn('[FORGOT_PASSWORD] 자동 리로드 시도 감지 - 차단');
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    
    const preventPopstate = (event: PopStateEvent) => {
      console.warn('[FORGOT_PASSWORD] popstate 이벤트 감지');
      if (!mountedRef.current) {
        event.preventDefault();
        return;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', preventAutoReload);
    window.addEventListener('popstate', preventPopstate);
    
    // iOS WebView 전용 이벤트 리스너
    const handlePageHide = () => {
      console.log('[FORGOT_PASSWORD] 페이지 숨김 이벤트');
      handleMemoryWarning();
    };
    
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', preventAutoReload);
      window.removeEventListener('popstate', preventPopstate);
      window.removeEventListener('pagehide', handlePageHide);
      
      // 컴포넌트 언마운트 시 페이지 고정 해제
      if ((window as any).__FORGOT_PASSWORD_FROZEN__) {
        unfreezePageForIOS();
      }
    };
  }, [isPageReady, isIOS]);
  
  // 자동 타이머나 외부 스크립트에 의한 페이지 변경 방지
  useEffect(() => {
    if (!isPageReady) return;
    
    // 페이지 안정성을 위한 기본 모니터링
    const checkPageStability = () => {
      if (mountedRef.current && componentRef.current) {
        if (!document.contains(componentRef.current)) {
          console.warn('[FORGOT_PASSWORD] 컴포넌트 안정성 문제 감지');
        }
      }
    };
    
    const stabilityCheck = setInterval(checkPageStability, 5000);
    
    return () => {
      clearInterval(stabilityCheck);
    };
  }, [isPageReady]);
  
  // 스타일 적용 및 iOS 최적화 (강화된 버전)
  useEffect(() => {
    if (!isPageReady) return;
    
    // CSS 스타일 추가
    const styleElement = document.createElement('style');
    styleElement.textContent = pageStyles;
    document.head.appendChild(styleElement);
    
    const forceStableStyles = () => {
      if (typeof document === 'undefined') return;
      
      const pageContainer = componentRef.current;
      if (pageContainer) {
        pageContainer.style.setProperty('position', 'relative', 'important');
        pageContainer.style.setProperty('z-index', '1', 'important');
        pageContainer.style.setProperty('background-color', 'white', 'important');
        pageContainer.classList.add('forgot-password-container');
      }
      
      // 헤더 padding 강제 제거
      const headers = document.querySelectorAll('.forgot-password-header, header, .glass-effect');
      headers.forEach(header => {
        if (header instanceof HTMLElement) {
          header.style.setProperty('padding-top', '0px', 'important');
          header.style.setProperty('padding', '0px', 'important');
          header.style.setProperty('margin-top', '0px', 'important');
          header.style.setProperty('margin', '0px', 'important');
          header.style.setProperty('height', '64px', 'important');
          header.style.setProperty('min-height', '64px', 'important');
          header.style.setProperty('max-height', '64px', 'important');
        }
      });
      
      // 🚨 iOS WebView 전용 강제 스타일 적용
      if (isIOS()) {
        // body와 html 완전 고정
        document.body.style.setProperty('position', 'fixed', 'important');
        document.body.style.setProperty('top', '0', 'important');
        document.body.style.setProperty('left', '0', 'important');
        document.body.style.setProperty('right', '0', 'important');
        document.body.style.setProperty('bottom', '0', 'important');
        document.body.style.setProperty('width', '100%', 'important');
        document.body.style.setProperty('height', '100%', 'important');
        document.body.style.setProperty('overflow', 'hidden', 'important');
        document.body.style.setProperty('z-index', '1', 'important');
        document.body.style.setProperty('background-color', 'white', 'important');
        document.body.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
        document.body.style.setProperty('-webkit-backface-visibility', 'hidden', 'important');
        document.body.style.setProperty('-webkit-perspective', '1000px', 'important');
        document.body.style.setProperty('touch-action', 'none', 'important');
        document.body.style.setProperty('-webkit-user-select', 'none', 'important');
        document.body.style.setProperty('-webkit-touch-callout', 'none', 'important');
        document.body.style.setProperty('-webkit-tap-highlight-color', 'transparent', 'important');
        
        document.documentElement.style.setProperty('position', 'fixed', 'important');
        document.documentElement.style.setProperty('top', '0', 'important');
        document.documentElement.style.setProperty('left', '0', 'important');
        document.documentElement.style.setProperty('right', '0', 'important');
        document.documentElement.style.setProperty('bottom', '0', 'important');
        document.documentElement.style.setProperty('width', '100%', 'important');
        document.documentElement.style.setProperty('height', '100%', 'important');
        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
        document.documentElement.style.setProperty('z-index', '1', 'important');
      } else {
        // 일반 브라우저에서는 기본 최적화만
        document.body.style.setProperty('overflow-x', 'hidden', 'important');
      }
    };
    
    forceStableStyles();
    
    // 추가 안정화를 위한 재적용 (iOS에서는 더 자주)
    const stabilizeInterval = isIOS() ? 200 : 500;
    const stabilizeTimer = setTimeout(forceStableStyles, stabilizeInterval);
    const stabilizeTimer2 = setTimeout(forceStableStyles, stabilizeInterval * 2);
    const stabilizeTimer3 = setTimeout(forceStableStyles, stabilizeInterval * 3);
    
    return () => {
      if (stabilizeTimer) clearTimeout(stabilizeTimer);
      if (stabilizeTimer2) clearTimeout(stabilizeTimer2);
      if (stabilizeTimer3) clearTimeout(stabilizeTimer3);
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [isPageReady, isIOS]);

  // 전화번호 포맷팅 - useCallback으로 최적화
  const formatPhoneNumber = useCallback((value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }, []);

  // 입력값 검증 - useCallback으로 최적화
  const validateInput = useCallback(() => {
    if (!mountedRef.current) return false;
    
    const newErrors: FormErrors = {};
    
    if (!contact.trim()) {
      newErrors.contact = contactType === 'phone' ? '전화번호를 입력해주세요.' : '이메일을 입력해주세요.';
    } else if (contactType === 'phone') {
      const phoneRegex = /^010-\d{4}-\d{4}$/;
      if (!phoneRegex.test(contact)) {
        newErrors.contact = '올바른 전화번호 형식이 아닙니다. (010-1234-5678)';
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact)) {
        newErrors.contact = '올바른 이메일 형식이 아닙니다.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [contact, contactType]);

  // 사용자 존재 여부 확인
  const checkUserExists = useCallback(async (type: 'phone' | 'email', value: string) => {
    try {
      if (type === 'phone') {
        // 전화번호인 경우 find-user-by-phone API 사용
        console.log('[FORGOT_PASSWORD] 전화번호 기반 사용자 확인 시작:', value.substring(0, 3) + '***');
        
        const response = await fetch('/api/auth/find-user-by-phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: value,
          }),
        });

        const data = await response.json();
        console.log('[FORGOT_PASSWORD] 전화번호 기반 사용자 확인 응답:', {
          status: response.status,
          success: data.success,
          message: data.message,
          found: data.data?.found,
          data: data.data
        });
        
        if (response.ok) {
          // 백엔드에서 success가 false여도 found 필드를 확인
          const userExists = data.data?.found === true;
          console.log('[FORGOT_PASSWORD] 전화번호 기반 사용자 존재 여부:', userExists);
          return userExists;
        }
        
        return false;
      } else {
        // 이메일인 경우 새로운 check API 사용
        const response = await fetch(`/api/auth/check?type=${type}&value=${encodeURIComponent(value)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        
        console.log('[FORGOT_PASSWORD] 이메일 기반 사용자 확인 응답:', data);
        
        if (response.ok) {
          // 새로운 API 응답 형식: data.found === true면 사용자가 존재함
          const userExists = data.data?.found === true;
          console.log('[FORGOT_PASSWORD] 이메일 기반 사용자 존재 여부:', userExists);
          return userExists;
        }
        
        return false;
      }
    } catch (error) {
      console.error('[FORGOT_PASSWORD] 사용자 확인 오류:', error);
      return false;
    }
  }, []);

  // 비밀번호 재설정 요청 - useCallback으로 최적화
  const handleResetRequest = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mountedRef.current || !validateInput()) return;
    
    // 햅틱 피드백
    if (isIOS()) {
      hapticFeedback.formSubmit({ component: 'forgot-password', action: 'reset_request' });
    }

    setIsLoading(true);
    // 에러는 유지하되 입력 필드는 계속 활성화

    try {
      console.log('[FORGOT_PASSWORD] 사용자 존재 확인 시작:', { type: contactType, contact: contact.substring(0, 3) + '***' });
      
      // 사용자 존재 여부 확인
      const userExists = await checkUserExists(contactType, contact);
      
      if (!userExists) {
        throw new Error(`가입되지 않은 ${contactType === 'phone' ? '전화번호' : '이메일'}입니다.`);
      }
      
      console.log('[FORGOT_PASSWORD] 사용자 확인 완료, 가입된 사용자입니다.');

      console.log('[FORGOT_PASSWORD] 재설정 요청 시작:', { type: contactType, contact: contact.substring(0, 3) + '***' });
      
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: contactType,
          contact: contact,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '요청 처리 중 오류가 발생했습니다.');
      }

      // 성공 시 다음 단계로
      if (mountedRef.current) {
        setStep('sent');
        console.log('[FORGOT_PASSWORD] 재설정 요청 성공');
        
        // 성공 햅틱 피드백
        if (isIOS()) {
          hapticFeedback.success();
        }
      }
    } catch (error: any) {
      console.error('[FORGOT_PASSWORD] 재설정 요청 오류:', error);
      if (mountedRef.current) {
        setErrors({ 
          general: error.message || '요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.' 
        });
        
        // 에러 햅틱 피드백
        if (isIOS()) {
          hapticFeedback.error();
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        // 로딩 완료 후 입력 필드에 포커스 유지
        setTimeout(() => {
          if (inputRef.current && mountedRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  }, [contactType, contact, validateInput, isIOS, checkUserExists]);

  // 연락처 입력 처리 - useCallback으로 최적화
  const handleContactChange = useCallback((value: string) => {
    if (!mountedRef.current) return;
    
    if (contactType === 'phone') {
      setContact(formatPhoneNumber(value));
    } else {
      setContact(value);
    }
    
    // 에러 초기화 - 입력 시 모든 에러 메시지 제거
    if (errors.contact || errors.general) {
      setErrors({});
    }
  }, [contactType, formatPhoneNumber, errors.contact, errors.general]);
  
  // 연락처 타입 변경 핸들러
  const handleContactTypeChange = useCallback((newType: 'phone' | 'email') => {
    if (!mountedRef.current) return;
    
    setContactType(newType);
    setContact('');
    setErrors({});
    
    // 햅틱 피드백
    if (isIOS()) {
      hapticFeedback.toggle({ component: 'forgot-password', action: 'contact_type_change' });
    }
  }, [isIOS]);

  // Critical Error 상태 처리 (페이지가 사라지는 것 방지)
  if (criticalError) {
    return (
      <div 
        className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 999999,
          backgroundColor: 'white'
        }}
      >
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">페이지 오류</h3>
            <p className="text-sm text-gray-600 mb-4">{criticalError}</p>
            <div className="space-y-2">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
              >
                페이지 새로고침
              </button>
              <button 
                onClick={() => {
                  setCriticalError(null);
                  setIsPageReady(false);
                  // 페이지 재초기화
                  setTimeout(() => setIsPageReady(true), 500);
                }}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                오류 무시하고 계속
              </button>
              <Link
                href="/signin"
                className="block w-full bg-[#0114a2] text-white py-2 px-4 rounded-lg text-center hover:bg-[#001f87] transition-colors"
              >
                로그인 페이지로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 페이지 준비 상태 확인
  if (!isPageReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <IOSCompatibleSpinner size="lg" />
          <p className="text-gray-600 text-sm mt-4">페이지를 준비하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={componentRef}
      className="min-h-screen bg-white"
      style={{ 
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'white'
      }}
    >
      {/* 통일된 헤더 애니메이션 - group 페이지 스타일 적용 */}
      <AnimatedHeader 
        variant="simple"
        className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed forgot-password-header"
        style={{ 
          paddingTop: '0px !important',
          marginTop: '0px !important',
          top: '0px !important',
          position: 'fixed',
          padding: '0px !important',
          height: '64px !important',
          minHeight: '64px !important',
          maxHeight: '64px !important'
        }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center space-x-3 motion-div"
          >
            <motion.button 
              onClick={() => {
                if (isIOS()) {
                  hapticFeedback.backButton({ component: 'forgot-password' });
                }
                router.push('/signin');
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <HiOutlineChevronLeft className="w-5 h-5 text-gray-700" />
            </motion.button>
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-lg font-bold text-gray-900">비밀번호 찾기</h1>
                <p className="text-xs text-gray-500">계정 복구를 위한 인증을 진행해주세요</p>
              </div>
            </div>
          </motion.div>
          
          <div className="flex items-center space-x-2">
            {/* 필요시 추가 버튼들을 여기에 배치 */}
          </div>
        </div>
      </AnimatedHeader>

              {/* 메인 컨텐츠 - 헤더와 설명영역 간격 줄임 */}
        <div className="max-w-md mx-auto px-4 py-4" style={{ 
          paddingTop: 'calc(62px + 1rem)', // 헤더 높이 + 줄어든 패딩
          minHeight: 'calc(100vh - 62px)' // 헤더 높이 제외한 전체 높이
        }}>
        
        {/* 비밀번호 찾기 정보 카드 - 버튼 색상과 맞춤 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className="mb-4"
        >
          <div className="bg-[#0114a2] rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <FiKey className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-xl font-bold">비밀번호 찾기</h2>
                  <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                    <FiMail className="w-3 h-3 text-blue-100" />
                    <span className="text-xs font-medium text-blue-100">계정 복구</span>
                  </div>
                </div>
                <p className="text-blue-100 text-sm mb-1">비밀번호를 잊어버리셨나요?</p>
                <p className="text-blue-200 text-xs">가입 시 등록한 정보로 재설정 링크를 보내드립니다</p>
              </div>
            </div>
          </div>
        </motion.div>

        {step === 'input' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="forgot-password-content"
          >

            {/* 연락처 타입 선택 - iOS 최적화 */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => handleContactTypeChange('phone')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
                  contactType === 'phone' 
                    ? 'bg-white text-[#0114a2] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FiPhone size={16} />
                <span>전화번호</span>
              </button>
              <button
                type="button"
                onClick={() => handleContactTypeChange('email')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
                  contactType === 'email' 
                    ? 'bg-white text-[#0114a2] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FiMail size={16} />
                <span>이메일</span>
              </button>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleResetRequest} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {contactType === 'phone' ? '전화번호' : '이메일'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    {contactType === 'phone' ? (
                      <FiPhone className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FiMail className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type={contactType === 'phone' ? 'tel' : 'email'}
                    value={contact}
                    onChange={(e) => handleContactChange(e.target.value)}
                    placeholder={
                      contactType === 'phone' 
                        ? '010-1234-5678' 
                        : 'example@email.com'
                    }
                    maxLength={contactType === 'phone' ? 13 : undefined}
                    disabled={isLoading}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#0114a2] focus:border-transparent transition-all ${
                      errors.contact 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-200'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                {errors.contact && (
                  <p className="text-red-500 text-sm mt-1 text-center">{errors.contact}</p>
                )}
              </div>

              {/* 일반 에러 */}
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm text-center">{errors.general}</p>
                </div>
              )}

              {/* 전송 버튼 - iOS 최적화 */}
              <button
                type="submit"
                disabled={isLoading || !contact.trim()}
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all min-h-[48px] ${
                  isLoading || !contact.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0114a2] text-white hover:bg-[#001f87] transform hover:scale-105 active:scale-95'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>전송 중...</span>
                    </>
                  ) : (
                    <>
                      <FiSend size={16} />
                      <span>재설정 링크 전송</span>
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* 로그인으로 돌아가기 */}
            <div className="text-center mt-6">
              <Link 
                href="/signin" 
                className="text-sm text-gray-600 hover:text-[#0114a2] transition-colors"
              >
                로그인으로 돌아가기
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-center forgot-password-content"
          >
            {/* 성공 아이콘 */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiCheckCircle className="w-8 h-8 text-green-600" />
            </div>

            {/* 성공 메시지 */}
            <h2 className="text-xl font-bold text-gray-900 mb-2">전송 완료!</h2>
            <p className="text-gray-600 text-sm mb-6">
              {contactType === 'phone' ? contact : contact}로<br />
              비밀번호 재설정 {contactType === 'phone' ? 'SMS' : '이메일'}를 보내드렸습니다.
            </p>

            {/* 안내 사항 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-blue-900 mb-2">안내사항</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• {contactType === 'phone' ? 'SMS' : '이메일'}가 도착하지 않으면 스팸함을 확인해주세요.</li>
                <li>• 재설정 링크는 24시간 동안 유효합니다.</li>
                <li>• 문제가 지속되면 고객센터에 문의해주세요.</li>
              </ul>
            </div>

            {/* 액션 버튼들 - iOS 최적화 */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (isIOS()) {
                    hapticFeedback.buttonClick({ component: 'forgot-password', action: 'retry' });
                  }
                  setStep('input');
                  setContact('');
                  setErrors({});
                }}
                className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                다시 전송하기
              </button>
              <Link
                href="/signin"
                onClick={() => {
                  if (isIOS()) {
                    hapticFeedback.navigation({ component: 'forgot-password', action: 'nav_to_signin' });
                  }
                }}
                className="block w-full py-3 px-4 bg-[#0114a2] text-white rounded-xl text-center hover:bg-[#001f87] transition-colors"
              >
                로그인으로 돌아가기
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;