'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import IOSCompatibleSpinner from '../../../../components/IOSCompatibleSpinner';
import { hapticFeedback } from '@/utils/haptic';

// 아이콘 임포트
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiX, FiAlertTriangle, FiPhone, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export default function SignInPageNew() {
  // 상태 관리
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const router = useRouter();
  const { login, isLoggedIn, refreshAuthState } = useAuth();

  // 참조 관리 (page_old.tsx에서 가져온 강화 기능)
  const isRedirectingRef = useRef(false);
  const errorProcessedRef = useRef(false);
  const blockAllEffectsRef = useRef(false);
  const componentMountedRef = useRef(false);
  const preventRemountRef = useRef(false);
  const navigationListenersRef = useRef<{
    beforeunload?: (e: BeforeUnloadEvent) => void;
    popstate?: (e: PopStateEvent) => void;
    unload?: (e: Event) => void;
    pagehide?: (e: PageTransitionEvent) => void;
    visibilitychange?: (e: Event) => void;
    keydown?: (e: KeyboardEvent) => void;
  }>({});

  // 로그인 상태 체크 및 리다이렉트 (한 번만 실행)
  useEffect(() => {
    if (isLoggedIn && !isRedirectingRef.current) {
      console.log('[SIGNIN_NEW] 이미 로그인된 상태 - home으로 리다이렉트');
      isRedirectingRef.current = true;
      blockAllEffectsRef.current = true;
      router.replace('/home');
    }
  }, [isLoggedIn, router]);

  // iOS 네이티브 로그 전송 함수 (page_old.tsx에서 가져옴)
  const sendLogToiOS = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
    const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    if (isIOSWebView && (window as any).webkit?.messageHandlers?.smapIos) {
      try {
        const logData = {
          type: 'jsLog',
          param: JSON.stringify({
            level,
            message,
            data: data ? JSON.stringify(data) : null,
            timestamp: new Date().toISOString()
          })
        };
        (window as any).webkit.messageHandlers.smapIos.postMessage(logData);
        console.log(`[iOS LOG SENT] ${level.toUpperCase()}: ${message}`);
      } catch (e) {
        console.error('iOS 로그 전송 실패:', e);
      }
    }
  };

  // 강화된 에러 표시 함수 (page_old.tsx에서 가져옴)
  const showError = (message: string) => {
    console.log('[SIGNIN] 💥 showError 함수 시작:', message);
    console.log('[SIGNIN] 💥 현재 상태 - showErrorModal:', showErrorModal, ', isLoading:', isLoading);
    
    // 🚨 즉시 전역 플래그 설정 (가장 먼저!) - 브라우저 저장소에 영구 보존
    (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
    (window as any).__SIGNIN_ERROR_MESSAGE__ = message;
    blockAllEffectsRef.current = true;
    preventRemountRef.current = true;
    
    // 브라우저 저장소에 영구 보존 (컴포넌트 재마운트되어도 유지)
    sessionStorage.setItem('__SIGNIN_ERROR_MODAL_ACTIVE__', 'true');
    sessionStorage.setItem('__SIGNIN_ERROR_MESSAGE__', message);
    sessionStorage.setItem('__SIGNIN_PREVENT_REMOUNT__', 'true');
    sessionStorage.setItem('__SIGNIN_BLOCK_ALL_EFFECTS__', 'true');
    
    console.log('[SIGNIN] ⚡ 즉시 전역 플래그 설정 완료 (브라우저 저장소 포함)');
    
    // 🚨 즉시 페이지 고정
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // 🚨 즉시 브라우저 네비게이션 차단 설정
    const emergencyBlocker = (e: Event) => {
      console.log('[SIGNIN] 🚨 긴급 이벤트 차단:', e.type);
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    };
    
    window.addEventListener('beforeunload', emergencyBlocker, { capture: true, passive: false });
    window.addEventListener('unload', emergencyBlocker, { capture: true, passive: false });
    window.addEventListener('pagehide', emergencyBlocker, { capture: true, passive: false });
    document.addEventListener('visibilitychange', emergencyBlocker, { capture: true, passive: false });
    
    // 🚨 즉시 히스토리 고정
    for (let i = 0; i < 20; i++) {
      window.history.pushState(null, '', window.location.href);
    }
    
    // 🚨 즉시 popstate 차단
    const emergencyPopstateBlocker = (e: PopStateEvent) => {
      console.log('[SIGNIN] 🚨 긴급 popstate 차단!');
      e.preventDefault();
      e.stopImmediatePropagation();
      window.history.pushState(null, '', window.location.href);
      return false;
    };
    window.addEventListener('popstate', emergencyPopstateBlocker, { capture: true, passive: false });
    
    // 🚨 즉시 키보드 차단 (F5, Ctrl+R 등)
    const emergencyKeyBlocker = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.key === 'F5') || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
        console.log('[SIGNIN] 🚨 긴급 키보드 차단:', e.key);
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
    };
    window.addEventListener('keydown', emergencyKeyBlocker, { capture: true, passive: false });
    
    console.log('[SIGNIN] ⚡ 긴급 이벤트 차단 설정 완료');

    // React 상태 업데이트 (즉시)
    setErrorMessage(message);
    setShowErrorModal(true);
    setIsLoading(false);
    
    console.log('[SIGNIN] ⚡ React 상태 업데이트 완료 - showErrorModal:', true, ', message:', message);
    
    hapticFeedback.error();
    
    // iOS 로그 전송
    sendLogToiOS('error', 'showError 함수 호출', { message });
    
    // 강제 DOM 업데이트 확인
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal="error"]');
      console.log('[SIGNIN] ⚡ 모달 DOM 확인:', modalElement ? '존재함' : '없음');
    }, 100);
  };

  // 강화된 에러 모달 닫기 (page_old.tsx에서 가져옴)
  const closeErrorModal = () => {
    console.log('[SIGNIN] 에러 모달 닫기');
    
    // 브라우저 저장소에서 에러 모달 상태 제거
    sessionStorage.removeItem('__SIGNIN_ERROR_MODAL_ACTIVE__');
    sessionStorage.removeItem('__SIGNIN_ERROR_MESSAGE__');
    sessionStorage.removeItem('__SIGNIN_PREVENT_REMOUNT__');
    sessionStorage.removeItem('__SIGNIN_BLOCK_ALL_EFFECTS__');
    console.log('[SIGNIN] 브라우저 저장소 정리 완료');
    
    // 전역 플래그 먼저 제거
    delete (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__;
    delete (window as any).__SIGNIN_ERROR_MESSAGE__;
    
    // 🚫 브라우저 네비게이션 차단 해제
    if (navigationListenersRef.current.beforeunload) {
      window.removeEventListener('beforeunload', navigationListenersRef.current.beforeunload);
      navigationListenersRef.current.beforeunload = undefined;
    }
    
    if (navigationListenersRef.current.popstate) {
      window.removeEventListener('popstate', navigationListenersRef.current.popstate);
      navigationListenersRef.current.popstate = undefined;
    }
    
    if (navigationListenersRef.current.unload) {
      window.removeEventListener('unload', navigationListenersRef.current.unload);
      navigationListenersRef.current.unload = undefined;
    }
    
    if (navigationListenersRef.current.pagehide) {
      window.removeEventListener('pagehide', navigationListenersRef.current.pagehide);
      navigationListenersRef.current.pagehide = undefined;
    }
    
    if (navigationListenersRef.current.visibilitychange) {
      document.removeEventListener('visibilitychange', navigationListenersRef.current.visibilitychange);
      navigationListenersRef.current.visibilitychange = undefined;
    }
    
    if (navigationListenersRef.current.keydown) {
      window.removeEventListener('keydown', navigationListenersRef.current.keydown);
      navigationListenersRef.current.keydown = undefined;
    }
    
    // 모달 닫기
    setShowErrorModal(false);
    setErrorMessage('');
    setFormErrors({});
    
    // 페이지 스크롤 복구
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // 플래그 리셋 (즉시)
    errorProcessedRef.current = false;
    blockAllEffectsRef.current = false;
    preventRemountRef.current = false;
    
    console.log('[SIGNIN] 모든 플래그 리셋 완료');
  };

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  };

  // 전화번호 입력 핸들러
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    if (formErrors.phoneNumber) {
      setFormErrors(prev => ({ ...prev, phoneNumber: '' }));
    }
  };

  // 비밀번호 입력 핸들러
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (formErrors.password) {
      setFormErrors(prev => ({ ...prev, password: '' }));
    }
  };

  // 입력 유효성 검사
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!phoneNumber.trim()) {
      errors.phoneNumber = '전화번호를 입력해주세요.';
    } else if (phoneNumber.replace(/\D/g, '').length !== 11) {
      errors.phoneNumber = '올바른 전화번호를 입력해주세요.';
    }
    
    if (!password.trim()) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (password.length < 4) {
      errors.password = '비밀번호는 4자 이상이어야 합니다.';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 강화된 전화번호 로그인 핸들러 (page_old.tsx에서 가져옴)
  const handlePhoneNumberLogin = async (e: React.FormEvent) => {
    // 폼 기본 제출 동작 방지
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[SIGNIN] 로그인 시도 시작');
    
    setIsLoading(true);
    setFormErrors({});
    
    // 에러 처리 플래그 리셋
    errorProcessedRef.current = false;
    blockAllEffectsRef.current = false;

    let currentFormErrors: Record<string, string> = {};
    if (!phoneNumber.trim()) {
      currentFormErrors.phoneNumber = '전화번호를 입력해주세요.';
    }
    if (!password.trim()) {
      currentFormErrors.password = '비밀번호를 입력해주세요.';
    }

    if (Object.keys(currentFormErrors).length > 0) {
      console.log('[SIGNIN] 입력 검증 실패:', currentFormErrors);
      setFormErrors(currentFormErrors);
      setIsLoading(false);
      return;
    }

    try {
      console.log('[SIGNIN] AuthContext login 호출 시작');
      
      // 전화번호 로그인 시작 시 AuthContext 에러 감지 비활성화
      blockAllEffectsRef.current = true;
      console.log('[SIGNIN] AuthContext 에러 감지 비활성화');
      
      // authService를 통해 직접 로그인 (AuthContext 우회하여 중복 리다이렉트 방지)
      const response = await authService.login({
        mt_id: phoneNumber.replace(/-/g, ''), // 전화번호에서 하이픈 제거
        mt_pwd: password,
      });

      if (!response.success) {
        throw new Error(response.message || '로그인에 실패했습니다.');
      }

      console.log('[SIGNIN] authService 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');
      
      // AuthContext 상태를 수동으로 동기화
      await refreshAuthState();
      console.log('[SIGNIN] AuthContext 상태 동기화 완료');
      
      // 로그인 성공 햅틱 피드백
      hapticFeedback.success();
      
      // 리다이렉트 플래그 설정
      isRedirectingRef.current = true;
      
      // 모든 상태 업데이트 차단
      blockAllEffectsRef.current = true;
      
      // router.replace 사용 (페이지 새로고침 없이 이동)
      router.replace('/home');

    } catch (err: any) {
      console.error('[SIGNIN] 🚨 로그인 오류 발생:', err);
      console.log('[SIGNIN] 에러 타입:', typeof err);
      console.log('[SIGNIN] 에러 객체:', err);
      console.log('[SIGNIN] 에러 메시지:', err.message);
      console.log('[SIGNIN] 에러 스택:', err.stack);
      
      // iOS 로그 전송
      sendLogToiOS('error', '전화번호 로그인 실패', {
        errorType: typeof err,
        errorMessage: err.message,
        errorStack: err.stack,
        phoneNumber: phoneNumber.replace(/-/g, '').replace(/\d/g, '*') // 마스킹
      });
      
      // Google 로그인과 동일하게 에러 모달 표시
      let errorMessage = err.message || '로그인에 실패했습니다.';
      console.log('[SIGNIN] 원본 에러 메시지:', errorMessage);
      
      // 사용자 친화적 에러 메시지 변환
      if (errorMessage.includes('아이디') || errorMessage.includes('ID')) {
        errorMessage = '등록되지 않은 전화번호입니다.';
      } else if (errorMessage.includes('비밀번호') || errorMessage.includes('password')) {
        errorMessage = '비밀번호가 일치하지 않습니다.';
      } else if (errorMessage.includes('네트워크') || errorMessage.includes('network')) {
        errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
      } else if (errorMessage.includes('서버') || errorMessage.includes('server')) {
        errorMessage = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      
      console.log('[SIGNIN] 🔥 변환된 에러 메시지:', errorMessage);
      console.log('[SIGNIN] 🔥 showError 함수 호출 시작');
      
      // 로그인 실패 햅틱 피드백
      hapticFeedback.error();
      
      sendLogToiOS('info', '에러 모달 표시 시도', { errorMessage });
      
      try {
        showError(errorMessage);
        console.log('[SIGNIN] ✅ showError 함수 호출 완료');
        sendLogToiOS('info', 'showError 함수 호출 완료');
      } catch (showErrorErr) {
        console.error('[SIGNIN] ❌ showError 함수 호출 실패:', showErrorErr);
        sendLogToiOS('error', 'showError 함수 호출 실패', { error: String(showErrorErr) });
      }
      
    } finally {
      setIsLoading(false);
      console.log('[SIGNIN] 로그인 시도 완료');
    }
  };

  // 강화된 Google 로그인 핸들러 (page_old.tsx에서 가져옴)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Google 로그인 시도');
      
      // iOS WebView에서 네이티브 Google Sign-In 사용
      const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
      console.log('[GOOGLE LOGIN] 환경 체크:', {
        isIOSWebView,
        hasWebkit: !!(window as any).webkit,
        hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
        hasSmapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
        hasIosBridge: !!(window as any).iosBridge,
        hasGoogleSignIn: !!(window as any).iosBridge?.googleSignIn,
        hasGoogleSignInMethod: !!(window as any).iosBridge?.googleSignIn?.signIn
      });
      
      if (isIOSWebView) {
        console.log('[GOOGLE LOGIN] iOS WebView에서 네이티브 Google Sign-In 사용');
        
        // iOS 네이티브 Google Sign-In 사용
        try {
          // ios-bridge.js가 로드될 때까지 최대 3초 대기
          const waitForIosBridge = async (maxWait = 3000) => {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
              if ((window as any).iosBridge?.googleSignIn?.signIn) {
                return true;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            return false;
          };

          // ios-bridge.js의 googleSignIn 메서드 사용 시도
          if ((window as any).iosBridge?.googleSignIn?.signIn) {
            console.log('[GOOGLE LOGIN] ios-bridge.js googleSignIn 메서드 사용');
            (window as any).iosBridge.googleSignIn.signIn();
            console.log('[GOOGLE LOGIN] ios-bridge 메시지 전송 완료, 콜백 대기 중...');
            return;
          }

          // ios-bridge.js가 아직 로드되지 않았다면 잠시 대기
          console.log('[GOOGLE LOGIN] ios-bridge.js 로드 대기 중...');
          const bridgeLoaded = await waitForIosBridge();
          
          if (bridgeLoaded) {
            console.log('[GOOGLE LOGIN] ios-bridge.js 로드 완료, googleSignIn 메서드 사용');
            (window as any).iosBridge.googleSignIn.signIn();
            console.log('[GOOGLE LOGIN] ios-bridge 메시지 전송 완료, 콜백 대기 중...');
            return;
          }
          
          // 직접 메시지 핸들러 사용 (fallback)
          if ((window as any).webkit?.messageHandlers?.smapIos) {
            console.log('[GOOGLE LOGIN] 직접 메시지 핸들러 사용 (fallback)');
            (window as any).webkit.messageHandlers.smapIos.postMessage({
              type: 'googleSignIn',
              param: ''
            });
            
            console.log('[GOOGLE LOGIN] 네이티브 메시지 전송 완료, 콜백 대기 중...');
            // 로딩 상태는 콜백에서 처리되므로 여기서는 유지
            return;
          } else {
            console.warn('[GOOGLE LOGIN] smapIos 메시지 핸들러를 찾을 수 없음');
          }
        } catch (e) {
          console.error('[GOOGLE LOGIN] iOS 네이티브 구글 로그인 요청 실패:', e);
        }
        
        // 네이티브 처리가 불가능한 경우 에러 표시
        console.log('[GOOGLE LOGIN] 네이티브 Google Sign-In을 사용할 수 없음');
        console.log('[GOOGLE LOGIN] 환경 정보:', {
          hasWebkit: !!(window as any).webkit,
          hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
          hasSmapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
          hasIosBridge: !!(window as any).iosBridge,
          userAgent: navigator.userAgent
        });
        
        // iOS 로그 전송
        sendLogToiOS('error', 'Google Sign-In 환경 오류', {
          hasWebkit: !!(window as any).webkit,
          hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
          hasSmapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
          hasIosBridge: !!(window as any).iosBridge
        });
        
        // Google 로그인 환경 오류 햅틱 피드백
        hapticFeedback.warning();
        
        // 에러 모달 강제 표시
        setTimeout(() => {
          showError('Google 로그인을 사용할 수 없습니다.\n\n가능한 해결 방법:\n1. 앱을 완전히 종료 후 다시 시작\n2. 네트워크 연결 확인\n3. 앱 업데이트 확인');
        }, 100);
        return;
      }
      
      // 웹 환경에서는 Google 로그인 비활성화
      console.log('웹 환경에서 Google 로그인 시도');
      
      // 에러 모달 강제 표시
      setTimeout(() => {
        showError('웹 환경에서는 Google 로그인이 현재 사용할 수 없습니다. 앱에서 이용해주세요.');
      }, 100);
      
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      
      // iOS 로그 전송
      sendLogToiOS('error', 'Google 로그인 catch 블록', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // 에러 메시지 개선
      let errorMessage = 'Google 로그인에 실패했습니다.';
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
        } else {
          errorMessage = `구글 로그인 오류: ${error.message}`;
        }
      }
      
      // 에러 모달 강제 표시
      setTimeout(() => {
        showError(errorMessage);
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  // 강화된 카카오 로그인 핸들러 (page_old.tsx에서 가져옴)
  const handleKakaoLogin = async () => {
    console.log('[SIGNIN] 카카오 로그인 시도 시작');
    
    // 카카오 SDK가 로드되었는지 확인
    if (!window.Kakao) {
      console.error('[SIGNIN] 카카오 SDK가 로드되지 않음');
      showError('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    if (!window.Kakao.isInitialized()) {
      console.error('[SIGNIN] 카카오 SDK가 초기화되지 않음');
      showError('카카오 SDK 초기화에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      return;
    }

    // 카카오 앱 키 확인 (임시 테스트용 키 포함)
    const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 
                        process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                        'test-key'; // 임시 테스트용
    console.log('[SIGNIN] 카카오 앱 키 확인됨:', kakaoAppKey.substring(0, 10) + '...');

    setIsLoading(true);
    
    try {
      console.log('[SIGNIN] 카카오 로그인 팝업 띄우기');
      // 카카오 로그인 팝업 띄우기
      window.Kakao.Auth.login({
        success: async (authObj: any) => {
          try {
            console.log('카카오 로그인 성공:', authObj);
            
            // 백엔드 API로 액세스 토큰 전송
            const response = await fetch('/api/kakao-auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: authObj.access_token,
              }),
            });

            const data = await response.json();

            if (data.success) {
              console.log('[KAKAO LOGIN] 카카오 로그인 성공, 사용자 정보:', data.user);
              
              // authService에 사용자 정보 설정 (AuthContext 우회, JWT 토큰은 이미 쿠키에 저장됨)
              if (data.user) {
                authService.setUserData(data.user);
                // 토큰은 쿠키에 저장되므로 별도 설정 불필요
              }
              
              console.log('[KAKAO LOGIN] 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');
              
              // AuthContext 상태를 수동으로 동기화
              await refreshAuthState();
              console.log('[KAKAO LOGIN] AuthContext 상태 동기화 완료');
              
              // 로그인 성공 햅틱 피드백
              hapticFeedback.success();
              
              // 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
              // 모든 상태 업데이트 차단
              blockAllEffectsRef.current = true;
              
              // router.replace 사용 (페이지 새로고침 없이 이동)
              router.replace('/home');
              return;
            } else {
              throw new Error(data.error || '로그인에 실패했습니다.');
            }
          } catch (error: any) {
            console.error('카카오 로그인 처리 오류:', error);
            
            // 탈퇴한 사용자 오류 처리
            if (error.response?.status === 403 && error.response?.data?.isWithdrawnUser) {
              showError('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
            } else {
              showError(error.message || '로그인 처리 중 오류가 발생했습니다.');
            }
          } finally {
            setIsLoading(false);
          }
        },
        fail: (error: any) => {
          console.error('[SIGNIN] 카카오 로그인 실패:', error);
          
          // 더 명확한 에러 메시지
          let errorMessage = '카카오 로그인에 실패했습니다.';
          if (error?.error === 'access_denied') {
            errorMessage = '카카오 로그인이 취소되었습니다.';
          } else if (error?.error === 'invalid_client') {
            errorMessage = '카카오 로그인 설정에 문제가 있습니다.';
          }
          
          showError(errorMessage);
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      showError('카카오 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 카카오 SDK 로드
  useEffect(() => {
    const loadKakaoSDK = () => {
      if (window.Kakao) {
        if (!window.Kakao.isInitialized()) {
          // 카카오 앱 키 확인 (임시 테스트용 키 포함)
          const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 
                              process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                              'test-key'; // 임시 테스트용
          try {
            window.Kakao.init(kakaoAppKey);
            console.log('[SIGNIN_NEW] 카카오 SDK 초기화 완료');
          } catch (error) {
            console.error('[SIGNIN_NEW] 카카오 SDK 초기화 실패:', error);
          }
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
      script.async = true;
      script.onload = () => {
        if (window.Kakao) {
          // 카카오 앱 키 확인 (임시 테스트용 키 포함)
          const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 
                              process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                              'test-key'; // 임시 테스트용
          try {
            window.Kakao.init(kakaoAppKey);
            console.log('[SIGNIN_NEW] 카카오 SDK 로드 및 초기화 완료');
          } catch (error) {
            console.error('[SIGNIN_NEW] 카카오 SDK 초기화 실패:', error);
          }
        }
      };
      script.onerror = () => {
        console.error('[SIGNIN_NEW] 카카오 SDK 로드 실패');
      };
      document.head.appendChild(script);
    };

    loadKakaoSDK();
  }, []);

  return (
    <>
      {/* 로딩 스피너 */}
      <AnimatePresence>
        {isLoading && (
                      <IOSCompatibleSpinner size="md" message="로그인 중..." fullScreen />
        )}
      </AnimatePresence>

      {/* 에러 모달 */}
      <AnimatePresence>
        {showErrorModal && (
          <motion.div
            data-modal="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4"
            onClick={closeErrorModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm mx-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <FiAlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">
                로그인 실패
              </h3>
              
              <p className="text-center text-gray-600 mb-6">
                {errorMessage}
              </p>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={closeErrorModal}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                확인
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메인 컨테이너 */}
      <div className="min-h-screen flex flex-col justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm mx-auto"
        >
          {/* 로고 섹션 */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 relative"
            >
              <Image
                src="/images/smap_logo.webp"
                alt="SMAP 로고"
                width={80}
                height={80}
                className="rounded-full object-cover"
                priority
              />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">SMAP</h1>
            <p className="text-gray-600">안전한 위치 공유 서비스</p>
          </div>

          {/* 로그인 폼 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <form onSubmit={handlePhoneNumberLogin} className="space-y-4">
              {/* 전화번호 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    onFocus={() => setFocusedField('phoneNumber')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="010-1234-5678"
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      formErrors.phoneNumber
                        ? 'border-red-300 focus:ring-red-500'
                        : focusedField === 'phoneNumber'
                        ? 'border-blue-300 focus:ring-blue-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    maxLength={13}
                  />
                </div>
                {formErrors.phoneNumber && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.phoneNumber}</p>
                )}
              </div>

              {/* 비밀번호 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="비밀번호를 입력하세요"
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      formErrors.password
                        ? 'border-red-300 focus:ring-red-500'
                        : focusedField === 'password'
                        ? 'border-blue-300 focus:ring-blue-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
                )}
              </div>

              {/* 로그인 버튼 */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                로그인
              </motion.button>
            </form>
          </motion.div>

          {/* 소셜 로그인 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="space-y-3"
          >
            <div className="text-center text-sm text-gray-500 mb-4">
              또는 간편 로그인
            </div>

            {/* Google 로그인 */}
            <motion.button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <FcGoogle className="w-5 h-5" />
              <span>Google로 로그인</span>
            </motion.button>

            {/* 카카오 로그인 */}
            <motion.button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <RiKakaoTalkFill className="w-5 h-5" />
              <span>카카오로 로그인</span>
            </motion.button>
          </motion.div>

          {/* 회원가입 링크 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-center mt-6"
          >
            <p className="text-gray-600 text-sm">
              계정이 없으신가요?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                회원가입
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
} 