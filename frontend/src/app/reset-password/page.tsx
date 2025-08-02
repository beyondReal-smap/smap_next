'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertCircle, FiKey } from 'react-icons/fi';
import { HiOutlineChevronLeft } from 'react-icons/hi2';
import { useRouter, useSearchParams } from 'next/navigation';
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
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reset-password-content {
  opacity: 0;
  animation: fadeIn 0.5s ease-out forwards;
}

.reset-password-content:nth-child(1) { animation-delay: 0.1s; }
.reset-password-content:nth-child(2) { animation-delay: 0.2s; }
.reset-password-content:nth-child(3) { animation-delay: 0.3s; }

/* iOS 스크롤 최적화 */
.reset-password-container {
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
}

/* iOS WebView 안정성 */
.reset-password-fixed {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 10 !important;
  background-color: white !important;
}

/* 헤더 padding 완전 제거 */
.reset-password-header,
.reset-password-header * {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}

/* AnimatedHeader 내부 요소 padding 제거 */
.reset-password-header .flex {
  padding: 0px !important;
  margin: 0px !important;
}

/* 모든 헤더 관련 요소 강제 padding 제거 */
.reset-password-header,
.reset-password-header *,
.reset-password-header header,
.reset-password-header .motion-header,
.reset-password-header [class*="header"] {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}

/* 전역 헤더 스타일 오버라이드 */
header[class*="reset-password"],
header[class*="glass-effect"] {
  padding-top: 0px !important;
  padding: 0px !important;
  margin-top: 0px !important;
  margin: 0px !important;
}
`;

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface PasswordStrength {
  hasLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const ResetPasswordPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);
  const componentRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const stabilityTimersRef = useRef<NodeJS.Timeout[]>([]);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  
  // 상태 관리 - iOS 안정성을 위한 초기값 설정
  const [isPageReady, setIsPageReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    hasLength: false,
    hasLetter: false,
    hasNumber: false,
    hasSpecial: false,
  });
  
  // iOS 감지 함수
  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);
  
  // 에러 바운더리와 안정성 모니터링
  useEffect(() => {
    // 전역 에러 핸들러
    const handleGlobalError = (error: ErrorEvent) => {
      console.error('[RESET_PASSWORD] 전역 에러 감지:', error);
      
      // Next.js 관련 에러는 무시
      if (error.message && (
        error.message.includes('__next_') ||
        error.message.includes('Unexpected token') ||
        error.message.includes('SyntaxError') ||
        error.filename && error.filename.includes('_next/static')
      )) {
        console.warn('[RESET_PASSWORD] Next.js 스크립트 오류 무시:', error.message);
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
      console.error('[RESET_PASSWORD] Promise rejection 감지:', event.reason);
      
      if (mountedRef.current && event.reason && event.reason.message) {
        // 네트워크 오류는 무시
        if (event.reason.message.includes('fetch') || event.reason.message.includes('network')) {
          console.warn('[RESET_PASSWORD] 네트워크 오류 무시');
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
    
    console.log('[RESET_PASSWORD] 페이지 안정성 모니터링 시작');
    
    // 정기적으로 페이지 상태 확인 (1초마다 10번)
    let checkCount = 0;
    const stabilityCheck = setInterval(() => {
      checkCount++;
      
      if (!mountedRef.current) {
        clearInterval(stabilityCheck);
        return;
      }
      
      console.log(`[RESET_PASSWORD] 안정성 체크 ${checkCount}/10`, {
        mounted: mountedRef.current,
        pageReady: isPageReady,
        step: step,
        componentExists: !!componentRef.current
      });
      
      // 컴포넌트가 사라졌는지 확인
      if (componentRef.current && !document.contains(componentRef.current)) {
        console.error('[RESET_PASSWORD] 컴포넌트가 DOM에서 제거됨 - 복구 시도');
        if (mountedRef.current) {
          setCriticalError('페이지가 예상치 못하게 사라졌습니다. 새로고침합니다.');
        }
      }
      
      if (checkCount >= 10) {
        clearInterval(stabilityCheck);
        console.log('[RESET_PASSWORD] 안정성 모니터링 완료 - 페이지 안정됨');
      }
    }, 1000);
    
    stabilityTimersRef.current.push(stabilityCheck);
    
    return () => {
      clearInterval(stabilityCheck);
    };
  }, [isPageReady, step]);
  
  // 페이지 초기화 - iOS WebView 안정성 최적화
  useEffect(() => {
    let initTimer: NodeJS.Timeout;
    
    const initializePage = () => {
      console.log('[RESET_PASSWORD] 페이지 초기화 시작');
      
      if (!mountedRef.current) return;
      
      // iOS에서 추가 안정화 시간
      const delay = isIOS() ? 300 : 100;
      
      initTimer = setTimeout(() => {
        if (mountedRef.current && !isInitializedRef.current) {
          setIsPageReady(true);
          isInitializedRef.current = true;
          console.log('[RESET_PASSWORD] 페이지 준비 완료');
          
          // 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.navigation({ component: 'reset-password', state: 'ready' });
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
    
    console.log('[RESET_PASSWORD] iOS WebView 메모리 최적화 시작');
    
    // 🚨 페이지 완전 고정 (iOS WebView에서 사라지는 것 방지)
    const freezePageForIOS = () => {
      console.log('[RESET_PASSWORD] iOS 페이지 고정 시작');
      
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
      (window as any).__RESET_PASSWORD_FROZEN__ = true;
    };
    
    // 페이지 고정 해제
    const unfreezePageForIOS = () => {
      console.log('[RESET_PASSWORD] iOS 페이지 고정 해제');
      
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
      delete (window as any).__RESET_PASSWORD_FROZEN__;
    };
    
    // 즉시 페이지 고정
    freezePageForIOS();
    
    // iOS WebView에서 메모리 경고 감지
    const handleMemoryWarning = () => {
      console.warn('[RESET_PASSWORD] iOS 메모리 경고 감지 - 가비지 컬렉션 실행');
      
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
        console.log('[RESET_PASSWORD] 페이지가 숨겨짐 - 메모리 정리 준비');
        setTimeout(handleMemoryWarning, 100);
      } else {
        console.log('[RESET_PASSWORD] 페이지가 다시 표시됨');
        
        // 페이지가 다시 표시될 때 상태 확인
        if (mountedRef.current && componentRef.current) {
          if (!document.contains(componentRef.current)) {
            console.error('[RESET_PASSWORD] 컴포넌트가 사라짐 - 복구 필요');
            setCriticalError('페이지가 사라졌습니다. 새로고침이 필요합니다.');
          }
        }
      }
    };
    
    // 자동 리로드/리디렉션 방지
    const preventAutoReload = (event: BeforeUnloadEvent) => {
      console.warn('[RESET_PASSWORD] 자동 리로드 시도 감지 - 차단');
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    
    const preventPopstate = (event: PopStateEvent) => {
      console.warn('[RESET_PASSWORD] popstate 이벤트 감지');
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
      console.log('[RESET_PASSWORD] 페이지 숨김 이벤트');
      handleMemoryWarning();
    };
    
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', preventAutoReload);
      window.removeEventListener('popstate', preventPopstate);
      window.removeEventListener('pagehide', handlePageHide);
      
      // 컴포넌트 언마운트 시 페이지 고정 해제
      if ((window as any).__RESET_PASSWORD_FROZEN__) {
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
          console.warn('[RESET_PASSWORD] 컴포넌트 안정성 문제 감지');
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
        pageContainer.classList.add('reset-password-container');
      }
      
      // 헤더 padding 강제 제거
      const headers = document.querySelectorAll('.reset-password-header, header, .glass-effect');
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

  // 토큰 검증 - 페이지 준비 후에만 실행
  useEffect(() => {
    if (!isPageReady) return;
    
    const urlToken = searchParams.get('token');
    if (!urlToken) {
      setStep('error');
      return;
    }
    
    setToken(urlToken);
    verifyToken(urlToken);
  }, [searchParams, isPageReady]);

  // 토큰 유효성 검사 - useCallback으로 최적화
  const verifyToken = useCallback(async (token: string) => {
    if (!mountedRef.current) return;
    
    try {
      console.log('[RESET_PASSWORD] 토큰 검증 시작');
      
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (mountedRef.current) {
        if (response.ok) {
          setStep('form');
          console.log('[RESET_PASSWORD] 토큰 검증 성공');
          
          // 성공 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.success();
          }
        } else {
          setStep('error');
          console.log('[RESET_PASSWORD] 토큰 검증 실패');
          
          // 에러 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.error();
          }
        }
      }
    } catch (error) {
      console.error('[RESET_PASSWORD] 토큰 검증 에러:', error);
      if (mountedRef.current) {
        setStep('error');
        
        // 에러 햅틱 피드백
        if (isIOS()) {
          hapticFeedback.error();
        }
      }
    }
  }, [isIOS]);

  // 비밀번호 강도 검사
  useEffect(() => {
    setPasswordStrength({
      hasLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [password]);

  // 입력값 검증
  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!password) {
      newErrors.password = '새 비밀번호를 입력해주세요.';
    } else if (password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
    } else if (!Object.values(passwordStrength).every(Boolean)) {
      newErrors.password = '비밀번호 조건을 모두 만족해야 합니다.';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 비밀번호 재설정 처리 - useCallback으로 최적화
  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mountedRef.current || !validateForm() || !token) return;
    
    // 햅틱 피드백
    if (isIOS()) {
      hapticFeedback.formSubmit({ component: 'reset-password', action: 'password_reset' });
    }

    setIsLoading(true);
    setErrors({});

    try {
      console.log('[RESET_PASSWORD] 비밀번호 재설정 시작');
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (mountedRef.current) {
        if (response.ok && data.success) {
          setStep('success');
          console.log('[RESET_PASSWORD] 비밀번호 재설정 성공');
          
          // 성공 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.success();
          }
        } else {
          // 백엔드 응답에서 에러 메시지 확인
          let errorMessage = data.message || '비밀번호 재설정에 실패했습니다.';
          
          // 토큰 관련 에러인 경우 특별 처리
          if (errorMessage.includes('토큰') || errorMessage.includes('만료') || errorMessage.includes('유효하지 않은')) {
            setStep('error');
            console.log('[RESET_PASSWORD] 토큰 에러로 인한 실패:', errorMessage);
          } else {
            setErrors({ general: errorMessage });
          }
          
          // 에러 햅틱 피드백
          if (isIOS()) {
            hapticFeedback.error();
          }
        }
      }
    } catch (error) {
      console.error('[RESET_PASSWORD] 비밀번호 재설정 오류:', error);
      if (mountedRef.current) {
        setErrors({ 
          general: '요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.' 
        });
        
        // 에러 햅틱 피드백
        if (isIOS()) {
          hapticFeedback.error();
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [token, password, validateForm, isIOS]);
  
  // 컴포넌트 정리
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
                href="/forgot-password"
                className="block w-full bg-[#0114a2] text-white py-2 px-4 rounded-lg text-center hover:bg-[#001f87] transition-colors"
              >
                비밀번호 찾기로 이동
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

  // 토큰 검증 로딩 화면
  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <IOSCompatibleSpinner size="lg" />
          <p className="text-gray-600 text-sm mt-4">토큰을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // 에러 화면
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-xl font-bold text-gray-900 mb-2">유효하지 않은 링크</h1>
          <p className="text-gray-600 text-sm mb-6">
            비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.<br />
            새로운 재설정 링크를 요청해주세요.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className="block w-full py-3 px-4 bg-[#0114a2] text-white rounded-xl text-center hover:bg-[#001f87] transition-colors"
            >
              다시 요청하기
            </Link>
            <Link
              href="/signin"
              className="block w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-xl text-center hover:bg-gray-50 transition-colors"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 성공 화면
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-xl font-bold text-gray-900 mb-2">비밀번호 변경 완료!</h1>
          <p className="text-gray-600 text-sm mb-6">
            새로운 비밀번호로 설정되었습니다.<br />
            이제 새 비밀번호로 로그인하실 수 있습니다.
          </p>
          
          <Link
            href="/signin"
            className="block w-full py-3 px-4 bg-[#0114a2] text-white rounded-xl text-center hover:bg-[#001f87] transition-colors"
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  // 비밀번호 재설정 폼
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
        className="fixed top-0 left-0 right-0 z-50 glass-effect header-fixed reset-password-header"
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
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center space-x-3 motion-div"
          >
            <motion.button 
              onClick={() => {
                if (isIOS()) {
                  hapticFeedback.navigation({ component: 'reset-password', action: 'nav_to_signin' });
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
                <h1 className="text-lg font-bold text-gray-900">비밀번호 재설정</h1>
                <p className="text-xs text-gray-500">새로운 비밀번호를 설정해주세요</p>
              </div>
            </div>
          </motion.div>
          
          <div className="flex items-center space-x-2">
            {/* 필요시 추가 버튼들을 여기에 배치 */}
          </div>
        </div>
      </AnimatedHeader>

              {/* 메인 컨텐츠 - 헤더 높이만큼 상단 패딩 추가 */}
        <div className="max-w-md mx-auto px-4 py-8" style={{ 
          paddingTop: 'calc(62px + 1rem)', // 헤더 높이 + 줄어든 패딩
          minHeight: 'calc(100vh - 62px)' // 헤더 높이 제외한 전체 높이
        }}>
        
        {/* 통합된 컨테이너 - 순차적 애니메이션 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="reset-password-content"
        >
          {/* 비밀번호 재설정 정보 카드 - 버튼 색상과 맞춤 */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-4"
          >
            <div className="bg-[#0114a2] rounded-3xl p-6 text-white shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <FiKey className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-xl font-bold">비밀번호 재설정</h2>
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <FiLock className="w-3 h-3 text-blue-100" />
                      <span className="text-xs font-medium text-blue-100">보안 설정</span>
                    </div>
                  </div>
                  <p className="text-blue-100 text-sm mb-1">새로운 비밀번호를 설정하세요</p>
                  <p className="text-blue-200 text-xs">안전한 비밀번호로 계정을 보호하세요</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 비밀번호 재설정 폼 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >

          {/* 비밀번호 재설정 폼 */}
          <form onSubmit={handleResetPassword} className="space-y-6">
            {/* 새 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <FiLock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#0114a2] focus:border-transparent transition-all ${
                    errors.password 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
              
              {/* 비밀번호 강도 표시 */}
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-600">비밀번호 조건</div>
                  <div className="space-y-1">
                    {[
                      { key: 'hasLength', text: '8자 이상' },
                      { key: 'hasLetter', text: '영문 포함' },
                      { key: 'hasNumber', text: '숫자 포함' },
                      { key: 'hasSpecial', text: '특수문자 포함' },
                    ].map(({ key, text }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          passwordStrength[key as keyof PasswordStrength] 
                            ? 'bg-green-500' 
                            : 'bg-gray-300'
                        }`} />
                        <span className={`text-xs ${
                          passwordStrength[key as keyof PasswordStrength] 
                            ? 'text-green-600' 
                            : 'text-gray-500'
                        }`}>
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <FiLock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#0114a2] focus:border-transparent transition-all ${
                    errors.confirmPassword 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
              
              {/* 비밀번호 일치 표시 */}
              {confirmPassword && password && (
                <div className="mt-2">
                  {password === confirmPassword ? (
                    <p className="text-green-600 text-sm flex items-center space-x-1">
                      <FiCheckCircle size={12} />
                      <span>비밀번호가 일치합니다</span>
                    </p>
                  ) : (
                    <p className="text-red-500 text-sm">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>
              )}
            </div>

            {/* 일반 에러 */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            {/* 재설정 버튼 */}
            <button
              type="submit"
              disabled={!password || !confirmPassword || password !== confirmPassword || !Object.values(passwordStrength).every(Boolean)}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all ${
                !password || !confirmPassword || password !== confirmPassword || !Object.values(passwordStrength).every(Boolean)
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#0114a2] text-white hover:bg-[#001f87] transform hover:scale-105 active:scale-95'
              }`}
            >
              <FiLock size={16} />
              <span>비밀번호 변경</span>
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
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;