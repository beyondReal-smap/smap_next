// frontend/src/app/signin/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // Image 컴포넌트 임포트
import { motion, AnimatePresence } from 'framer-motion';
// import { signIn, getSession } from 'next-auth/react'; // 임시 비활성화
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import UnifiedLoadingSpinner from '../../../../components/UnifiedLoadingSpinner';
import IOSCompatibleSpinner from '../../../../components/IOSCompatibleSpinner';

// 아이콘 임포트 (react-icons 사용 예시)
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiX, FiAlertTriangle, FiPhone, FiLock, FiEye, FiEyeOff, FiMail, FiUser } from 'react-icons/fi';
import { AlertModal } from '@/components/ui';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';
import iosLogger, { LogCategory } from '@/utils/iosLogger';
import '@/utils/fetchLogger'; // Fetch API 자동 로깅 활성화

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export default function SignInPage() {
  // 🚨 페이지 로드 디버깅
  console.log('[SIGNIN PAGE] 컴포넌트 로딩 시작', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

  // 🚨 페이지 로드 즉시 브라우저 저장소에서 에러 모달 상태 확인 및 복원
  const [showErrorModal, setShowErrorModal] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedErrorFlag = sessionStorage.getItem('__SIGNIN_ERROR_MODAL_ACTIVE__') === 'true';
        if (savedErrorFlag) {
          console.log('[SIGNIN] 🔄 페이지 로드 시 브라우저 저장소에서 에러 모달 상태 복원');
          
          // 전역 플래그도 즉시 복원
          const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
          (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
          (window as any).__SIGNIN_ERROR_MESSAGE__ = savedErrorMessage;
          
          return true;
        }
      } catch (error) {
        console.warn('[SIGNIN] sessionStorage 접근 실패:', error);
      }
    }
    return false;
  });
  
  const [errorModalMessage, setErrorModalMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
        if (savedErrorMessage) {
          console.log('[SIGNIN] 🔄 페이지 로드 시 에러 메시지 복원:', savedErrorMessage);
          return savedErrorMessage;
        }
      } catch (error) {
        console.warn('[SIGNIN] sessionStorage 접근 실패:', error);
      }
    }
    return '';
  });

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  // 안전한 useAuth 접근
  let authContextData;
  try {
    authContextData = useAuth();
  } catch (error) {
    console.error('[SIGNIN] useAuth 컨텍스트 오류:', error);
    authContextData = {
      login: () => Promise.resolve(),
      isLoggedIn: false,
      loading: false,
      error: null,
      setError: () => {},
      refreshAuthState: () => Promise.resolve()
    };
  }
  const { login, isLoggedIn, loading, error, setError, refreshAuthState } = authContextData;
  
  // 리다이렉트 중복 실행 방지 플래그
  const isRedirectingRef = useRef(false);
  
  // 에러 처리 완료 플래그 - 한 번 에러를 처리하면 더 이상 처리하지 않음
  const errorProcessedRef = useRef(false);
  
  // 에러 모달 표시 중 모든 useEffect 차단 플래그
  const blockAllEffectsRef = useRef(false);
  
  // 핸들러 모니터링 interval 참조
  const handlerMonitorRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🔒 컴포넌트 재마운트 방지 플래그들
  const componentMountedRef = useRef(false);
  const preventRemountRef = useRef(false);

  // 🔍 핸들러 모니터링 useEffect (최우선)
  useEffect(() => {
    console.log('🔍 [HANDLER MONITOR] 핸들러 모니터링 시작');
    
    // 🧪 테스트 함수들 등록
    registerTestFunctions();
    
    // iOS 로그 전송
    sendLogToiOS('info', '📱 로그인 페이지 로드', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 100),
      currentURL: window.location.href
    });
    
    // 핸들러 모니터링 시작
    handlerMonitorRef.current = monitorHandlerStatus();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (handlerMonitorRef.current) {
        clearInterval(handlerMonitorRef.current);
        console.log('🔍 [HANDLER MONITOR] 핸들러 모니터링 정리 완료');
      }
    };
  }, []); // 의존성 없음 - 페이지 로드 시 한 번만 실행
  
  // 네비게이션 차단 이벤트 리스너 참조
  const navigationListenersRef = useRef<{
    beforeunload?: (e: BeforeUnloadEvent) => void;
    popstate?: (e: PopStateEvent) => void;
    unload?: (e: Event) => void;
    pagehide?: (e: PageTransitionEvent) => void;
    visibilitychange?: (e: Event) => void;
    keydown?: (e: KeyboardEvent) => void;
  }>({});

  // iOS WebView 환경 감지 - 모든 제한 제거, 시뮬레이터 완전 허용
  const isIOSWebView = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const hasWebKit = !!(window as any).webkit;
    const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;
    const hasIosBridge = typeof (window as any).SMAP_FORCE_HAPTIC === 'function';
    const isLocalhost = window.location.hostname === 'localhost';
    const isSimulator = /Simulator/.test(userAgent) || 
                      navigator.userAgent.includes('iPhone Simulator') ||
                      navigator.userAgent.includes('iPad Simulator');
    
    // 🚨 제한 완전 제거 - 아래 조건 중 하나라도 만족하면 iOS 앱으로 인정 (시뮬레이터 포함)
    const conditions = {
      condition1: isIOS && hasWebKit && hasMessageHandlers, // 표준 WebKit
      condition2: isIOS && hasIosBridge, // ios-bridge.js가 로드된 iOS
      condition3: isLocalhost && isIOS, // localhost의 iOS
      condition4: isSimulator, // iOS 시뮬레이터 (완전 허용)
      condition5: (window as any).__FORCE_IOS_MODE__ === true, // 강제 iOS 모드
      condition6: isIOS, // 단순히 iOS면 모두 허용
      condition7: isLocalhost, // localhost면 모두 허용
      condition8: true // 🚨 무조건 허용 모드 (테스트용)
    };
    
    const result = Object.values(conditions).some(Boolean);
    
    console.log('[SIGNIN] 🚨 제한 완전 해제된 환경 감지 (시뮬레이터 허용):', {
      userAgent: userAgent.substring(0, 50) + '...',
      hostname: window.location.hostname,
      isSimulator,
      conditions,
      finalResult: result
    });
    
    return result;
  }, []);

  // 안전한 이벤트 등록 함수
  const safeAddEventListener = (target: any, event: string, handler: any, options?: any) => {
    try {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener(event, handler, options);
        return true;
      }
    } catch (error) {
      console.warn(`[SIGNIN] 🚨 이벤트 리스너 등록 실패 (${event}):`, error);
    }
    return false;
  };

  // 안전한 이벤트 제거 함수
  const safeRemoveEventListener = (target: any, event: string, handler: any, options?: any) => {
    try {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(event, handler, options);
        return true;
      }
    } catch (error) {
      console.warn(`[SIGNIN] 🚨 이벤트 리스너 제거 실패 (${event}):`, error);
    }
    return false;
  };

  // 🔍 실시간 핸들러 모니터링
  const monitorHandlerStatus = () => {
    const checkHandlers = () => {
      const webkit = (window as any).webkit;
      const hasWebkit = !!webkit;
      const hasMessageHandlers = !!webkit?.messageHandlers;
      const hasSmapIos = !!webkit?.messageHandlers?.smapIos;
      const hasNativeCheck = typeof (window as any).SMAP_CHECK_HANDLERS === 'function';
      const hasForceHaptic = typeof (window as any).SMAP_FORCE_HAPTIC === 'function';
      
      console.log(`🔍 [HANDLER MONITOR] 핸들러 상태 실시간 체크:`, {
        hasWebkit,
        hasMessageHandlers,
        hasSmapIos,
        hasNativeCheck,
        hasForceHaptic,
        userAgent: navigator.userAgent.substring(0, 30) + '...',
        timestamp: new Date().toISOString()
      });
      
      // 네이티브 체크 함수가 있으면 호출
      if (hasNativeCheck) {
        try {
          const nativeResult = (window as any).SMAP_CHECK_HANDLERS();
          console.log(`🔍 [NATIVE CHECK] 네이티브 핸들러 확인 결과:`, nativeResult);
        } catch (e) {
          console.warn(`⚠️ [NATIVE CHECK] 네이티브 확인 실패:`, e);
        }
      }
      
      return hasSmapIos;
    };
    
    // 즉시 체크
    checkHandlers();
    
    // 1초마다 체크 (최대 10번)
    let checkCount = 0;
    const interval = setInterval(() => {
      checkCount++;
      const hasHandler = checkHandlers();
      
      if (hasHandler) {
        console.log(`✅ [HANDLER MONITOR] 핸들러 발견! (${checkCount}번째 시도)`);
        clearInterval(interval);
        
        // 핸들러 발견 시 즉시 테스트 햅틱 전송
        testHapticWithHandler();
      } else if (checkCount >= 10) {
        console.log(`❌ [HANDLER MONITOR] 10초 후에도 핸들러 없음`);
        clearInterval(interval);
      }
    }, 1000);
    
    return interval;
  };

  // 🧪 핸들러 발견 시 햅틱 테스트
  const testHapticWithHandler = () => {
    console.log('🧪 [HAPTIC TEST] 핸들러 발견! 햅틱 테스트 시작');
    
    try {
      // 직접 메시지 전송 테스트
      const webkit = (window as any).webkit;
      if (webkit?.messageHandlers?.smapIos) {
        console.log('🧪 [HAPTIC TEST] 직접 메시지 전송 테스트');
        webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: 'success'
        });
        
        webkit.messageHandlers.smapIos.postMessage({
          type: 'jsLog',
          param: JSON.stringify({
            level: 'info',
            message: '[HAPTIC TEST] 웹에서 테스트 햅틱 요청',
            data: { test: true, timestamp: Date.now() }
          })
        });
      }
      
      // triggerHapticFeedback도 테스트
      triggerHapticFeedback(HapticFeedbackType.SUCCESS, '핸들러 발견 테스트', { 
        component: 'signin', 
        action: 'handler-detected-test' 
      });
      
    } catch (error) {
      console.error('🧪 [HAPTIC TEST] 햅틱 테스트 실패:', error);
    }
  };

  // 🧪 햅틱 테스트 함수 (개발용)
  const testHapticFeedback = () => {
    console.log('🧪 [HAPTIC TEST] 수동 햅틱 테스트 시작');
    
    // 현재 상태 로그
    const webkit = (window as any).webkit;
    console.log('🧪 [HAPTIC TEST] 현재 WebKit 상태:', {
      hasWebkit: !!webkit,
      hasMessageHandlers: !!webkit?.messageHandlers,
      hasSmapIos: !!webkit?.messageHandlers?.smapIos,
      hasForceHaptic: typeof (window as any).SMAP_FORCE_HAPTIC === 'function'
    });
    
    // 여러 방법으로 햅틱 테스트
    try {
      // 1. 강제 네이티브 함수 시도
      if (typeof (window as any).SMAP_FORCE_HAPTIC === 'function') {
        console.log('🧪 [HAPTIC TEST] 강제 네이티브 함수 시도');
        (window as any).SMAP_FORCE_HAPTIC('success');
      }
      
      // 2. 직접 메시지 전송 시도  
      if (webkit?.messageHandlers?.smapIos) {
        console.log('🧪 [HAPTIC TEST] 직접 메시지 전송 시도');
        webkit.messageHandlers.smapIos.postMessage({ type: 'haptic', param: 'success' });
      }
      
      // 3. triggerHapticFeedback 유틸 시도
      console.log('🧪 [HAPTIC TEST] triggerHapticFeedback 유틸 시도');
      triggerHapticFeedback(HapticFeedbackType.SUCCESS, '수동 햅틱 테스트', { 
        component: 'signin', 
        action: 'manual-test' 
      });
      
    } catch (error) {
      console.error('🧪 [HAPTIC TEST] 햅틱 테스트 실패:', error);
    }
  };

  // 🧪 강제 시뮬레이터 모드 활성화 (Google 로그인 허용)
  const enableSimulatorMode = () => {
    console.log('🚨 시뮬레이터 모드 강제 활성화 (Google 로그인 허용)');
    (window as any).__SMAP_FORCE_SIMULATOR_MODE__ = true;
    (window as any).__SMAP_FORCE_GOOGLE_LOGIN__ = true;
    (window as any).__SMAP_IGNORE_ALL_RESTRICTIONS__ = true;
    
    // iOS 로그 전송 - 시뮬레이터 모드 활성화
    sendLogToiOS('info', '🚨 시뮬레이터 모드 강제 활성화', {
      timestamp: new Date().toISOString(),
      simulatorMode: true,
      googleLoginForced: true,
      restrictionsIgnored: true
    });
    
    console.log('🧪 [SIMULATOR] 강제 시뮬레이터 모드 활성화 (Google 로그인 허용)');
    showError('🧪 시뮬레이터 모드 활성화됨 (Google 로그인 허용)\n\n이제 Google 로그인이 무조건 허용됩니다:\n- 네이티브 실패 시 자동으로 웹 SDK 사용\n- 모든 환경 제한 무시\n- 상세한 오류 메시지 제공\n\nGoogle 로그인을 다시 시도해보세요.');
  };

  // iOS 네이티브 로그 전송 함수 (IPC 과부하 방지)
  const sendLogToiOS = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
    // 🚨 IPC 과부하 방지 - 개발 환경에서만 상세 로그
    const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 프로덕션에서는 에러와 경고만 전송
    if (isProduction && level === 'info') {
      return;
    }
    
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
        
        // 🚨 콘솔 로그도 조건부로 제한
        if (isDevelopment) {
          console.log(`[iOS LOG SENT] ${level.toUpperCase()}: ${message}`);
        }
      } catch (e) {
        if (isDevelopment) {
          console.error('iOS 로그 전송 실패:', e);
        }
      }
    }
  };

  // 🚨 디버깅용 콘솔 로그 래퍼 함수 (IPC 과부하 방지)
  const debugLog = (message: string, data?: any) => {
    const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
    if (isDevelopment) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  };

  // 🚨 에러 로그만 허용하는 함수
  const errorLog = (message: string, error?: any) => {
    console.error(message, error);
    // 에러는 항상 iOS로 전송
    sendLogToiOS('error', message, error);
  };

  // Google 로그인 콜백 핸들러
  const handleGoogleCallback = async (response: any) => {
    try {
      console.log('[GOOGLE CALLBACK] 응답 수신:', response);
      
      // ID 토큰 추출
      const idToken = response.credential;
      if (!idToken) {
        throw new Error('Google ID 토큰을 받지 못했습니다.');
      }
      
      // 임시로 Google 로그인 기능 비활성화
      console.log('[GOOGLE CALLBACK] ID 토큰:', idToken);
      throw new Error('Google 로그인 서버 연동이 아직 구현되지 않았습니다. 전화번호 로그인을 사용해주세요.');
      
    } catch (error) {
      console.error('[GOOGLE CALLBACK] 처리 실패:', error);
      showError('Google 로그인은 현재 준비 중입니다.\n\n전화번호 로그인을 사용해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 시뮬레이터용 Google SDK 로그인 함수
  const handleGoogleSDKLogin = async (retryCount: number = 0) => {
    console.log('[GOOGLE SDK] 웹 Google SDK를 통한 로그인 시작', retryCount > 0 ? `(재시도 ${retryCount})` : '');
    
    try {
      // Google Identity Services 초기화 (이미 로드되어 있다고 가정)
      if ((window as any).google?.accounts?.id) {
        const google = (window as any).google;
        
        console.log('[GOOGLE SDK] Google Identity Services 초기화');
        
        // 동적 Client ID 설정 (환경변수에서 직접 가져오기)
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
        
        console.log('[GOOGLE SDK] Client ID 확인:', {
          hasPublicEnv: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          hasPrivateEnv: !!process.env.GOOGLE_CLIENT_ID,
          usingClientId: clientId.substring(0, 12) + '...',
          clientIdLength: clientId.length,
          currentDomain: window.location.hostname,
          isProduction: window.location.hostname.includes('.smap.site')
        });
        
        // 프로덕션 환경에서 추가 도메인 검증
        if (window.location.hostname.includes('.smap.site')) {
          console.log('🔐 [GOOGLE OAUTH] 프로덕션 환경 감지 - 도메인 검증 수행');
          
          // Google Console에서 nextstep.smap.site 도메인이 등록되어 있는지 확인
          const allowedDomains = ['nextstep.smap.site', 'app2.smap.site', 'app.smap.site'];
          const currentDomain = window.location.hostname;
          
          if (!allowedDomains.includes(currentDomain)) {
            console.warn('⚠️ [GOOGLE OAUTH] 등록되지 않은 도메인:', currentDomain);
            throw new Error(`Google OAuth에 등록되지 않은 도메인입니다: ${currentDomain}`);
          }
          
          console.log('✅ [GOOGLE OAUTH] 도메인 검증 성공:', currentDomain);
        }
        
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            console.log('[GOOGLE SDK] 로그인 성공, 백엔드로 토큰 전송:', response);
            
            try {
              // 백엔드로 토큰 전송
              const backendResponse = await fetch('/api/google-auth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  credential: response.credential,
                }),
              });
              
              const data = await backendResponse.json();
              
              if (data.success) {
                console.log('[GOOGLE SDK] 백엔드 인증 성공:', data.user);
                
                // authService에 사용자 정보 저장
                if (data.user) {
                  console.log('[GOOGLE SDK] 사용자 데이터 저장 시작');
                  authService.setUserData(data.user);
                  
                  // 토큰이 있다면 저장
                  if (data.token) {
                    authService.setToken(data.token);
                    
                    // localStorage에도 직접 저장 (안전장치)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('auth-token', data.token);
                      localStorage.setItem('smap_user_data', JSON.stringify(data.user));
                      console.log('[GOOGLE SDK] localStorage에 직접 저장 완료');
                    }
                  }
                }
                
                console.log('[GOOGLE SDK] AuthContext 상태 동기화 시작');
                
                // AuthContext 상태 동기화
                await refreshAuthState();
                
                // 상태 동기화 확인 (최대 3초 대기)
                let syncAttempts = 0;
                const maxSyncAttempts = 15; // 3초 (200ms * 15)
                
                while (syncAttempts < maxSyncAttempts && !isLoggedIn) {
                  console.log('[GOOGLE SDK] 인증 상태 동기화 대기 중...', syncAttempts + 1);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  await refreshAuthState();
                  syncAttempts++;
                }
                
                if (isLoggedIn) {
                  console.log('[GOOGLE SDK] 인증 상태 동기화 성공!');
                } else {
                  console.warn('[GOOGLE SDK] 인증 상태 동기화 시간 초과, 강제 진행');
                }
                
                // 성공 햅틱 피드백
                triggerHapticFeedback(HapticFeedbackType.SUCCESS, 'Google SDK 로그인 성공', { component: 'signin', action: 'google-sdk-login', userEmail: data.user?.mt_email });
                console.log('🎮 [SIGNIN] Google 로그인 성공 햅틱 피드백 실행');
                
                // 추가 지연 후 홈으로 이동
                setTimeout(() => {
                  console.log('[GOOGLE SDK] 홈 페이지로 이동');
                  router.push('/home');
                }, 300); // 300ms 추가 지연
              } else {
                throw new Error(data.error || 'Google 인증 실패');
              }
            } catch (error) {
              console.error('[GOOGLE SDK] 백엔드 인증 실패:', error);
              showError('Google 로그인 처리 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
          error_callback: (error: any) => {
            console.error('[GOOGLE SDK] 로그인 실패:', error);
            
            let errorMessage = 'Google 로그인에 실패했습니다.';
            if (window.location.hostname.includes('.smap.site')) {
              errorMessage += '\n\n프로덕션 환경에서 Google OAuth 설정을 확인해주세요.';
              errorMessage += '\n\n해결 방법:';
              errorMessage += '\n1. Google Cloud Console에서 도메인 등록 확인';
              errorMessage += '\n2. Client ID 설정 확인';
              errorMessage += '\n3. 전화번호 로그인 사용';
            } else {
              errorMessage += '\n\n다시 시도하거나 전화번호 로그인을 사용해주세요.';
            }
            
            showError(errorMessage);
            setIsLoading(false);
          }
        });
        
        // 로그인 팝업 띄우기
        google.accounts.id.prompt((notification: any) => {
          console.log('[GOOGLE SDK] Prompt notification:', notification);
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // 팝업이 표시되지 않은 경우 버튼 클릭 방식 사용
            google.accounts.id.renderButton(
              document.createElement('div'), // 임시 div
              {
                theme: 'outline',
                size: 'large',
                type: 'standard',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
              }
            );
            
            // 직접 로그인 함수 호출
            setTimeout(() => {
              try {
                google.accounts.id.prompt();
              } catch (e) {
                console.error('[GOOGLE SDK] 두 번째 prompt 실패:', e);
                showError('Google 로그인 팝업을 열 수 없습니다.');
                setIsLoading(false);
              }
            }, 100);
          }
        });
        
              } else {
        console.error('[GOOGLE SDK] window.google.accounts.id가 없음:', {
          hasWindow: typeof window !== 'undefined',
          hasGoogle: !!(window as any).google,
          hasAccounts: !!(window as any).google?.accounts,
          hasId: !!(window as any).google?.accounts?.id,
          userAgent: navigator.userAgent
        });
        
        // 최대 2회까지만 재시도
        if (retryCount < 2) {
          console.log('[GOOGLE SDK] 3초 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if ((window as any).google?.accounts?.id) {
            console.log('[GOOGLE SDK] 재시도 성공 - SDK 사용 가능');
            // 재귀 호출로 다시 시도
            return handleGoogleSDKLogin(retryCount + 1);
          } else {
            console.log('[GOOGLE SDK] 재시도해도 SDK 없음');
          }
        }
        
        throw new Error('Google Identity Services를 사용할 수 없습니다.');
      }
      
    } catch (error: any) {
      console.error('[GOOGLE SDK] 초기화 실패:', error);
      
      // 에러 타입별 세부 메시지 (시뮬레이터 허용)
      let errorMessage = 'Google 로그인 SDK 초기화에 실패했습니다.';
      if (error.message.includes('로드 타임아웃')) {
        errorMessage = 'Google 로그인 서비스 연결에 시간이 너무 오래 걸립니다.\n\n해결 방법:\n1. 네트워크 연결 확인\n2. VPN 연결 해제 후 재시도\n3. WiFi 연결 상태 확인';
      } else if (error.message.includes('스크립트 로드 실패')) {
        errorMessage = 'Google 로그인 서비스에 연결할 수 없습니다.\n\n해결 방법:\n1. 인터넷 연결 확인\n2. 방화벽 설정 확인\n3. 브라우저 캐시 삭제 후 재시도';
      } else if (error.message.includes('사용할 수 없습니다')) {
        errorMessage = 'Google 로그인 SDK를 사용할 수 없습니다.\n\n상세 오류:\n' + (error.message || '알 수 없는 오류') + '\n\n해결 방법:\n1. 페이지 새로고침 후 재시도\n2. 브라우저 업데이트\n3. 전화번호 로그인 사용';
      } else {
        errorMessage = 'Google 로그인 처리 중 오류가 발생했습니다.\n\n상세 오류:\n' + (error.message || error.toString()) + '\n\n해결 방법:\n1. 페이지 새로고침\n2. 브라우저 설정 확인\n3. 전화번호 로그인 사용';
      }
      
      showError(errorMessage);
      setIsLoading(false);
    }
  };

  // 🔒 컴포넌트 마운트 추적 및 재마운트 방지 (강화) - 브라우저 저장소 상태 복원
  useEffect(() => {
    // React 모달만 사용하므로 DOM 직접 모달 정리 코드 제거
    
    // 브라우저 저장소에서 에러 모달 상태 복원 (최우선)
    if (typeof window !== 'undefined') {
      const savedErrorFlag = sessionStorage.getItem('__SIGNIN_ERROR_MODAL_ACTIVE__') === 'true';
      const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
      const savedPreventRemount = sessionStorage.getItem('__SIGNIN_PREVENT_REMOUNT__') === 'true';
      const savedBlockEffects = sessionStorage.getItem('__SIGNIN_BLOCK_ALL_EFFECTS__') === 'true';
      
      if (savedErrorFlag) {
        console.log('[SIGNIN] 🔄 브라우저 저장소에서 에러 모달 상태 복원:', {
          errorFlag: savedErrorFlag,
          errorMessage: savedErrorMessage,
          preventRemount: savedPreventRemount,
          blockEffects: savedBlockEffects
        });
        
        // 전역 플래그 복원
        (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
        (window as any).__SIGNIN_ERROR_MESSAGE__ = savedErrorMessage;
        preventRemountRef.current = true;
        blockAllEffectsRef.current = true;
        
        // React 상태 복원
        setTimeout(() => {
          setErrorModalMessage(savedErrorMessage);
          setShowErrorModal(true);
          setIsLoading(false);
        }, 100);
        
        return;
      }
    }
    
    // 전역 에러 모달 플래그 확인 (기존 로직 유지)
    if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[SIGNIN] 🚫 전역 에러 모달 플래그 감지 - 모든 동작 차단');
      preventRemountRef.current = true;
      blockAllEffectsRef.current = true;
      
      // 전역 에러 상태 복원
      const globalErrorMessage = (window as any).__SIGNIN_ERROR_MESSAGE__;
      if (globalErrorMessage) {
        console.log('[SIGNIN] 🔄 전역 에러 상태 복원:', globalErrorMessage);
        setTimeout(() => {
          setErrorModalMessage(globalErrorMessage);
          setShowErrorModal(true);
          setIsLoading(false);
        }, 100);
      }
      return;
    }
    
    if (componentMountedRef.current && !preventRemountRef.current) {
      console.log('[SIGNIN] ⚠️ 컴포넌트 재마운트 감지 - 차단 활성화');
      preventRemountRef.current = true;
      blockAllEffectsRef.current = true;
      
      // 강제로 현재 페이지 상태 유지
      window.history.replaceState(null, '', window.location.href);
      
      return;
    }
    
    if (!componentMountedRef.current) {
      componentMountedRef.current = true;
      console.log('[SIGNIN] 🚀 컴포넌트 최초 마운트');
    }
  }, []);

  // 통합된 인증 상태 확인 및 리다이렉트 처리 - 에러 모달 중에는 완전히 비활성화
  useEffect(() => {
    // 전역 에러 모달 플래그 확인 - 최우선 차단
    if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[SIGNIN] 🚫 전역 에러 모달 플래그로 인한 메인 useEffect 차단');
      return;
    }
    
    // 모든 useEffect 차단 플래그가 설정되어 있으면 아무것도 하지 않음
    if (blockAllEffectsRef.current || preventRemountRef.current) {
      console.log('[SIGNIN] 🚫 모든 useEffect 차단됨 (재마운트 방지 포함)');
      return;
    }
    
    // 에러 모달이 표시 중이면 아무것도 하지 않음 (최우선 조건)
    if (showErrorModal) {
      console.log('[SIGNIN] ⛔ 에러 모달 표시 중, useEffect 완전 중단');
      blockAllEffectsRef.current = true; // 차단 플래그 설정
      return;
    }
    
    console.log('[SIGNIN] 🔄 메인 useEffect 실행:', { isLoggedIn, loading, showErrorModal, isCheckingAuth });
    
    // 로딩 중이면 대기
    if (loading) {
      console.log('[SIGNIN] AuthContext 로딩 중, 대기...');
      return;
    }

    // URL에서 탈퇴 완료 플래그 확인
    const urlParams = new URLSearchParams(window.location.search);
    const isFromWithdraw = urlParams.get('from') === 'withdraw';
    
    if (isFromWithdraw) {
      console.log('[SIGNIN] 탈퇴 후 접근 - 자동 로그인 건너뛰기');
      
      // URL에서 from 파라미터 제거
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('from');
      window.history.replaceState({}, '', newUrl.toString());
      
      if (isCheckingAuth) {
        setIsCheckingAuth(false);
      }
      return;
    }

    // 로그인된 사용자는 홈으로 리다이렉트 (한 번만 실행)
    if (isLoggedIn && !isRedirectingRef.current) {
      console.log('[SIGNIN] 로그인된 사용자 감지, /home으로 리다이렉트');
      isRedirectingRef.current = true;
      
      // 추가 안전장치: 모든 상태 업데이트 차단
      blockAllEffectsRef.current = true;
      
      router.replace('/home');
      return;
    }

    // 로그인되지 않은 상태에서만 페이지 표시 (상태 변경 최소화)
    if (!isLoggedIn && isCheckingAuth) {
      console.log('[SIGNIN] 로그인되지 않은 상태, 로그인 페이지 표시');
      setIsCheckingAuth(false);
    }
    
    // cleanup 함수: 컴포넌트 언마운트 시 플래그 리셋
    return () => {
      isRedirectingRef.current = false;
    };
  }, [isLoggedIn, loading, showErrorModal, isCheckingAuth, router]);

  // 자동 입력 기능 제거됨 - 사용자가 직접 입력해야 함
  // useEffect(() => {
  //   try {
  //     const lastRegisteredPhone = localStorage.getItem('lastRegisteredPhone');
  //     if (lastRegisteredPhone) {
  //       setPhoneNumber(lastRegisteredPhone);
  //     }
  //   } catch (error) {
  //     console.error('localStorage 접근 실패:', error);
  //   }
  // }, []);

  // URL 파라미터에서 에러 메시지 확인
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      let errorMessage = '';
      switch (error) {
        case 'AccessDenied':
          errorMessage = '비활성화된 계정입니다. 고객센터에 문의해주세요.';
          break;
        case 'OAuthSignin':
          errorMessage = '소셜 로그인 중 오류가 발생했습니다.';
          break;
        case 'OAuthCallback':
          errorMessage = '소셜 로그인 콜백 처리 중 오류가 발생했습니다.';
          break;
        case 'OAuthCreateAccount':
          errorMessage = '계정 생성 중 오류가 발생했습니다.';
          break;
        case 'EmailCreateAccount':
          errorMessage = '이메일 계정 생성 중 오류가 발생했습니다.';
          break;
        case 'Callback':
          errorMessage = '로그인 처리 중 오류가 발생했습니다.';
          break;
        case 'OAuthAccountNotLinked':
          errorMessage = '이미 다른 방법으로 가입된 이메일입니다.';
          break;
        case 'EmailSignin':
          errorMessage = '이메일 로그인 중 오류가 발생했습니다.';
          break;
        case 'CredentialsSignin':
          errorMessage = '로그인 정보가 올바르지 않습니다.';
          break;
        case 'SessionRequired':
          errorMessage = '로그인이 필요합니다.';
          break;
        default:
          errorMessage = '로그인 중 오류가 발생했습니다.';
      }
      
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
      
      // URL에서 error 파라미터 제거
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams]);

  // iOS 네이티브 Google Sign-In 콜백 함수 등록
  useEffect(() => {
    // iOS 환경인지 확인
    const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    console.log('[GOOGLE LOGIN] 콜백 함수 등록 - iOS WebView 환경:', isIOSWebView);
    
    if (isIOSWebView) {
      // Google Sign-In 성공 콜백
      (window as any).googleSignInSuccess = async (idToken: string, userInfoJson: any) => {
        try {
          console.log('[GOOGLE LOGIN] iOS 네이티브 Google Sign-In 성공');
          console.log('[GOOGLE LOGIN] 매개변수 타입 확인:', {
            idTokenType: typeof idToken,
            idTokenLength: idToken?.length || 0,
            userInfoType: typeof userInfoJson,
            userInfoValue: userInfoJson
          });
          setIsLoading(true);
          
                      // 사용자 정보 처리 (다양한 형태 지원)
            let userInfo;
            try {
              if (typeof userInfoJson === 'string') {
                console.log('[GOOGLE LOGIN] JSON 문자열 파싱 시도:', userInfoJson);
                userInfo = JSON.parse(userInfoJson);
              } else if (typeof userInfoJson === 'object' && userInfoJson !== null) {
                console.log('[GOOGLE LOGIN] 객체 형태의 사용자 정보 수신:', userInfoJson);
                userInfo = userInfoJson;
              } else if (userInfoJson === null || userInfoJson === undefined) {
                console.log('[GOOGLE LOGIN] 사용자 정보가 null/undefined, ID 토큰에서 추출 시도');
                // ID 토큰에서 사용자 정보 추출 시도
                try {
                  const tokenParts = idToken.split('.');
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    userInfo = {
                      email: payload.email,
                      name: payload.name,
                      givenName: payload.given_name,
                      familyName: payload.family_name,
                      picture: payload.picture,
                      sub: payload.sub
                    };
                    console.log('[GOOGLE LOGIN] ID 토큰에서 추출한 사용자 정보:', userInfo);
                  } else {
                    throw new Error('Invalid token format');
                  }
                } catch (tokenError) {
                  console.error('[GOOGLE LOGIN] ID 토큰 파싱 실패:', tokenError);
                  throw new Error('사용자 정보를 가져올 수 없습니다.');
                }
              } else {
                console.log('[GOOGLE LOGIN] 예상치 못한 userInfoJson 타입:', typeof userInfoJson, userInfoJson);
                throw new Error('지원되지 않는 사용자 정보 형태입니다.');
              }
              
              console.log('[GOOGLE LOGIN] 처리된 사용자 정보:', userInfo);
            } catch (parseError) {
              console.error('[GOOGLE LOGIN] 사용자 정보 처리 오류:', parseError);
              console.log('[GOOGLE LOGIN] 원본 데이터 타입:', typeof userInfoJson);
              console.log('[GOOGLE LOGIN] 원본 데이터:', userInfoJson);
              throw new Error('사용자 정보 파싱에 실패했습니다.');
            }
          
          // 사용자 정보 필드명 정규화 (iOS에서 오는 필드명을 표준화)
          const normalizedUserInfo = {
            email: userInfo.email || userInfo.Email,
            name: userInfo.name || userInfo.Name || `${userInfo.givenName || userInfo.GivenName || ''} ${userInfo.familyName || userInfo.FamilyName || ''}`.trim(),
            givenName: userInfo.givenName || userInfo.GivenName,
            familyName: userInfo.familyName || userInfo.FamilyName,
            picture: userInfo.picture || userInfo.imageURL || userInfo.ImageURL,
            sub: userInfo.sub || userInfo.Sub
          };
          
          console.log('[GOOGLE LOGIN] 정규화된 사용자 정보:', normalizedUserInfo);

          // ID 토큰을 서버로 전송하여 로그인 처리
          console.log('[GOOGLE LOGIN] 서버 API 호출 시작');
          sendLogToiOS('info', 'Google Auth API 호출 시작', {
            idTokenLength: idToken.length,
            userInfo: normalizedUserInfo
          });
          
          const response = await fetch('/api/google-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idToken: idToken,
              userInfo: normalizedUserInfo
            }),
          });

          console.log('[GOOGLE LOGIN] 서버 응답 상태:', response.status);
          sendLogToiOS('info', `Google Auth API 응답: ${response.status}`, {
            ok: response.ok,
            statusText: response.statusText
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[GOOGLE LOGIN] 서버 응답 오류:', response.status, response.statusText);
            console.error('[GOOGLE LOGIN] 서버 에러 본문:', errorText);
            
            sendLogToiOS('error', `Google Auth API 실패: ${response.status}`, {
              status: response.status,
              statusText: response.statusText,
              errorBody: errorText
            });
            
            throw new Error(`서버 오류: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('[GOOGLE LOGIN] 서버 응답 데이터:', data);
          
          // 🔍 서버 응답 데이터 상세 분석
          console.log('[GOOGLE LOGIN] 🔍 additionalData 분석:', {
            hasAdditionalData: !!data.additionalData,
            groupCount: data.additionalData?.group_count,
            scheduleCount: data.additionalData?.schedule_count,
            backendLogGroups: data.additionalData?.backend_log_groups,
            backendLogSchedules: data.additionalData?.backend_log_schedules,
            backendLogMembers: data.additionalData?.backend_log_members,
            groups: data.additionalData?.groups,
            schedules: data.additionalData?.recent_schedules,
            rawBackendData: data.additionalData?.raw_backend_data
          });
          
          sendLogToiOS('info', 'Google Auth API 성공', {
            success: data.success,
            hasUser: !!data.user,
            hasToken: !!data.token,
            hasAdditionalData: !!data.additionalData,
            groupCount: data.additionalData?.group_count || 0,
            scheduleCount: data.additionalData?.schedule_count || 0
          });

          if (data.success) {
            console.log('[GOOGLE LOGIN] 네이티브 Google 로그인 성공, 사용자 정보:', data.user);
            
            // 🚨 Google 로그인 성공 상세 로깅
            iosLogger.logGoogleLogin('네이티브 로그인 성공', {
              hasUser: !!data.user,
              hasToken: !!data.token,
              isNewUser: data.isNewUser || false,
              userEmail: data.user?.mt_email || data.user?.email || normalizedUserInfo.email || 'unknown',
              userNickname: data.user?.mt_nickname || data.user?.nickname || normalizedUserInfo.name || 'unknown',
              userId: data.user?.mt_idx || data.user?.id || 'unknown',
              provider: 'google_native',
              requestedEmail: normalizedUserInfo.email,
              emailMatch: (data.user?.mt_email || data.user?.email) === normalizedUserInfo.email
            });
            
            // 🔥 Google 로그인 성공 후 강화된 토큰 및 사용자 정보 저장
            if (data.user && data.token) {
              console.log('[GOOGLE LOGIN] 🔥 사용자 데이터 및 토큰 저장 시작');
              sendLogToiOS('info', 'Google 로그인 데이터 저장 시작', {
                hasUser: !!data.user,
                hasToken: !!data.token,
                userId: data.user.mt_idx,
                userEmail: data.user.email
              });
              
              // 1. authService에 데이터 저장 (그룹 정보 포함)
              const enhancedUserData = {
                ...data.user,
                // 🔥 additionalData를 user 객체에 병합
                groups: data.additionalData?.groups || [],
                group_count: data.additionalData?.group_count || 0,
                schedule_count: data.additionalData?.schedule_count || 0,
                has_data: data.additionalData?.has_data || false,
                // 추가 정보
                additionalData: data.additionalData
              };
              
              authService.setUserData(enhancedUserData);
              authService.setToken(data.token);
              console.log('[GOOGLE LOGIN] ✅ authService 저장 완료 (그룹 정보 포함):', {
                userId: enhancedUserData.mt_idx,
                groupCount: enhancedUserData.groups?.length || 0,
                hasAdditionalData: !!enhancedUserData.additionalData
              });
              
              // 2. localStorage에도 직접 저장 (안전장치) - 그룹 정보 포함
              if (typeof window !== 'undefined') {
                localStorage.setItem('auth-token', data.token);
                localStorage.setItem('smap_user_data', JSON.stringify(enhancedUserData));
                // 🔥 그룹 정보 별도 저장
                localStorage.setItem('user_groups', JSON.stringify(data.additionalData?.groups || []));
                localStorage.setItem('user_group_count', String(data.additionalData?.group_count || 0));
                console.log('[GOOGLE LOGIN] ✅ localStorage에 직접 저장 완료');
                
                // 🔥 추가 안전장치: 쿠키에서 토큰 확인 및 localStorage 동기화
                const cookieToken = document.cookie
                  .split('; ')
                  .find(row => row.startsWith('client-token='))
                  ?.split('=')[1];
                
                if (cookieToken && cookieToken !== data.token) {
                  console.log('[GOOGLE LOGIN] 🔄 쿠키 토큰과 다름, 쿠키 토큰으로 동기화');
                  localStorage.setItem('auth-token', cookieToken);
                  authService.setToken(cookieToken);
                }
              }
              
              // 3. 저장 확인 로깅
              const savedToken = authService.getToken();
              const savedUserData = authService.getUserData();
              console.log('[GOOGLE LOGIN] 🔍 저장 확인:', {
                tokenSaved: !!savedToken,
                userDataSaved: !!savedUserData,
                userIdMatch: savedUserData?.mt_idx === data.user.mt_idx
              });
              
              sendLogToiOS('info', 'Google 로그인 데이터 저장 완료', {
                tokenSaved: !!savedToken,
                userDataSaved: !!savedUserData,
                userIdMatch: savedUserData?.mt_idx === data.user.mt_idx
              });
              
              console.log('[GOOGLE LOGIN] 🔄 AuthContext 상태 동기화 시작');
              
              // 4. AuthContext 상태를 수동으로 동기화 (그룹 정보 로깅 포함)
              const currentUser = authService.getUserData();
              console.log('[GOOGLE LOGIN] 동기화 전 상태:', {
                isLoggedIn,
                contextUser: currentUser?.mt_idx,
                savedUserGroups: enhancedUserData.groups?.length || 0,
                additionalDataGroupCount: data.additionalData?.group_count || 0
              });
              
              await refreshAuthState();
              
              const updatedUser = authService.getUserData();
              console.log('[GOOGLE LOGIN] ✅ AuthContext 상태 동기화 완료 - 그룹 정보:', {
                isLoggedInAfter: isLoggedIn,
                contextUserAfter: updatedUser?.mt_idx,
                userGroups: updatedUser?.groups?.length || 0,
                additionalData: !!data.additionalData
              });
              
              // 5. 상태 동기화 확인 (최대 3초 대기)
              let syncAttempts = 0;
              const maxSyncAttempts = 15; // 3초 (200ms * 15)
              
              while (syncAttempts < maxSyncAttempts && !isLoggedIn) {
                console.log('[GOOGLE LOGIN] ⏳ 인증 상태 동기화 대기 중...', syncAttempts + 1);
                await new Promise(resolve => setTimeout(resolve, 200));
                await refreshAuthState();
                syncAttempts++;
              }
              
              if (isLoggedIn) {
                console.log('[GOOGLE LOGIN] 🎉 인증 상태 동기화 성공!');
                sendLogToiOS('info', 'Google 로그인: 네이티브 로그인 성공', {
                  step: '네이티브 로그인 성공',
                  timestamp: new Date().toISOString(),
                  hasUser: !!data.user,
                  hasToken: !!data.token,
                  isNewUser: data.isNewUser || false,
                  userEmail: data.user.email,
                  userNickname: data.user.nickname || data.user.mt_name,
                  userId: data.user.mt_idx,
                  provider: 'google_native',
                  requestedEmail: data.user.email,
                  emailMatch: true
                });
              } else {
                console.warn('[GOOGLE LOGIN] ⚠️ 인증 상태 동기화 시간 초과, 강제 진행');
                sendLogToiOS('warning', 'Google 로그인: 동기화 시간 초과하지만 강제 진행', {
                  syncAttempts: maxSyncAttempts,
                  hasStoredData: !!savedUserData && !!savedToken
                });
              }
              
              // 5. Google 로그인 성공 햅틱 피드백
              triggerHapticFeedback(HapticFeedbackType.SUCCESS, 'Google 로그인 성공', { 
                component: 'signin', 
                action: 'google-login', 
                userEmail: data.user?.mt_email?.substring(0, 3) + '***' 
              });
              console.log('🎮 [SIGNIN] Google 로그인 성공 햅틱 피드백 실행');
              
              // 6. 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
              // 7. 모든 상태 업데이트 차단
              blockAllEffectsRef.current = true;
              
              // 8. 🔥 강화된 홈 페이지 이동 로직
              setTimeout(() => {
                console.log('[GOOGLE LOGIN] 🏠 홈 페이지로 이동');
                sendLogToiOS('info', 'Google 로그인 홈 페이지 이동', {
                  userId: data.user.mt_idx,
                  hasToken: !!authService.getToken(),
                  hasUser: !!authService.getUserData(),
                  authContextReady: isLoggedIn
                });
                
                // 즉시 홈 페이지로 이동
                router.replace('/home');
                
                // 🔥 추가 안전장치: 이동이 실패할 경우를 대비한 재시도
                setTimeout(() => {
                  if (window.location.pathname !== '/home') {
                    console.log('[GOOGLE LOGIN] ⚡ 홈 페이지 이동 재시도');
                    window.location.href = '/home';
                  }
                }, 500);
              }, 300); // 300ms 추가 지연
            }
          } else {
            throw new Error(data.error || '로그인에 실패했습니다.');
          }
        } catch (error: any) {
          console.error('[GOOGLE LOGIN] 네이티브 Google 로그인 처리 오류:', error);
          
          // Google 로그인 실패 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.ERROR, 'Google 로그인 실패', { 
            component: 'signin', 
            action: 'google-login-error', 
            error: error.message 
          });
          
          showError(error.message || 'Google 로그인 처리 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      // Google Sign-In 실패 콜백
      (window as any).googleSignInError = (errorMessage: string) => {
        console.error('[GOOGLE LOGIN] iOS 네이티브 Google Sign-In 실패:', errorMessage);
        
        // 강제로 로딩 상태 해제
        setIsLoading(false);
        
        // iOS 로그 전송
        sendLogToiOS('error', 'Google Sign-In 실패', { errorMessage });
        
        // 에러 메시지에 따른 사용자 친화적 메시지 제공
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
          userFriendlyMessage = '사용자가 Google 로그인을 취소했습니다.';
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          userFriendlyMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
        } else if (errorMessage.includes('configuration') || errorMessage.includes('Configuration')) {
          userFriendlyMessage = 'Google 로그인 설정에 문제가 있습니다. 앱을 다시 시작해주세요.';
        }
        
        // Google 로그인 에러 햅틱 피드백
        triggerHapticFeedback(HapticFeedbackType.ERROR, 'Google 로그인 콜백 에러', { 
          component: 'signin', 
          action: 'google-login-callback-error', 
          error: errorMessage 
        });
        
        // 에러 모달 강제 표시 - setTimeout으로 확실히 실행
        console.log('[GOOGLE LOGIN] 에러 모달 강제 표시:', userFriendlyMessage);
        setTimeout(() => {
          showError(`Google 로그인 실패: ${userFriendlyMessage}`);
        }, 100);
      };

      // iOS 앱에서 메시지를 받았는지 확인하는 콜백 (디버깅용)
      (window as any).googleSignInMessageReceived = (message: string) => {
        console.log('[GOOGLE LOGIN] iOS 앱에서 메시지 수신 확인:', message);
      };
    }

    // 컴포넌트 언마운트 시 콜백 함수 정리
    return () => {
      if (isIOSWebView) {
        delete (window as any).googleSignInSuccess;
        delete (window as any).googleSignInError;
        delete (window as any).googleSignInMessageReceived;
      }
    };
  }, []);

  // 에러 모달 상태 디버깅
  useEffect(() => {
    console.log('[SIGNIN] 에러 모달 상태 변화:', { showErrorModal, errorModalMessage });
    if (showErrorModal && errorModalMessage) {
      console.log('[SIGNIN] ⚠️ 에러 모달이 표시되어야 함:', errorModalMessage);
    }
  }, [showErrorModal, errorModalMessage]);

  // AuthContext 에러 감지 및 에러 모달 표시 (한 번만 실행)
  // 주의: 전화번호 로그인은 catch 블록에서 직접 에러 모달을 표시하므로 
  // 여기서는 다른 경우(예: 자동 로그인 실패 등)만 처리
  useEffect(() => {
    // 전역 에러 모달 플래그 확인 - 최우선 차단
    if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[SIGNIN] 🚫 전역 에러 모달 플래그로 인한 useEffect 차단');
      return;
    }
    
    // 모든 useEffect 차단 플래그가 설정되어 있으면 아무것도 하지 않음
    if (blockAllEffectsRef.current) {
      console.log('[SIGNIN] 🚫 에러 감지 useEffect 차단됨');
      return;
    }
    
    console.log('[SIGNIN] 🚨 에러 감지 useEffect 실행:', { 
      error: !!error, 
      errorMessage: error, 
      isLoggedIn, 
      loading, 
      showErrorModal, 
      errorProcessed: errorProcessedRef.current 
    });
    
    // 전화번호 로그인 에러는 catch 블록에서 직접 처리하므로 여기서는 제외
    // 주로 자동 로그인 실패나 기타 AuthContext 에러만 처리
    if (error && !isLoggedIn && !loading && !showErrorModal && !errorProcessedRef.current) {
      console.log('[SIGNIN] ⚠️ AuthContext 에러 감지 (자동 로그인 실패 등):', error);
      
      // 전화번호 로그인 관련 에러가 아닌 경우만 모달 표시
      if (!error.includes('아이디') && !error.includes('비밀번호') && !error.includes('ID') && !error.includes('password')) {
        console.log('[SIGNIN] AuthContext 에러 모달 표시:', error);
        errorProcessedRef.current = true; // 에러 처리 완료 플래그 설정
        blockAllEffectsRef.current = true; // 모든 useEffect 차단
        
        // 에러 모달 표시
        showError(error);
        
        // 에러 처리 후 AuthContext 에러 초기화 (setTimeout으로 지연)
        setTimeout(() => {
          setError(null);
        }, 100);
      } else {
        console.log('[SIGNIN] 전화번호 로그인 에러는 catch 블록에서 처리됨, useEffect 무시');
        // 전화번호 로그인 에러는 catch에서 처리하므로 AuthContext 에러만 초기화
        setError(null);
      }
    }
  }, [error, isLoggedIn, loading, showErrorModal, setError]);

  // 로그인 상태 변화 디버깅 (error 제외)
  useEffect(() => {
    console.log('[SIGNIN] 로그인 상태 변화:', { isLoggedIn, loading, isCheckingAuth });
  }, [isLoggedIn, loading, isCheckingAuth]);

  // 전화번호 포맷팅 함수 (register/page.tsx의 함수와 유사)
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const numericValue = value.replace(/[^0-9]/g, '');
    const length = numericValue.length;

    if (length < 4) return numericValue;
    if (length < 7) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3)}`;
    }
    if (length < 11) {
      return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 6)}-${numericValue.slice(6)}`;
    }
    return `${numericValue.slice(0, 3)}-${numericValue.slice(3, 7)}-${numericValue.slice(7, 11)}`;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPhoneNumber(rawValue);
    setPhoneNumber(formatted);

    const numericOnlyRaw = rawValue.replace(/-/g, '');
    if (/[^0-9]/.test(numericOnlyRaw) && numericOnlyRaw !== '') {
      setFormErrors(prevErrors => ({ ...prevErrors, phoneNumber: '숫자만 입력 가능합니다.'}));
    } else {
      setFormErrors(prevErrors => ({ ...prevErrors, phoneNumber: '' }));
    }
  };

  // 전화번호 로그인 핸들러
  const handlePhoneNumberLogin = async (e: React.FormEvent) => {
    // 폼 기본 제출 동작 방지
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[SIGNIN] 로그인 시도 시작');
    
    // iOS 로그 전송 - 로그인 시도 시작
    sendLogToiOS('info', '📱 전화번호 로그인 시도 시작', {
      timestamp: new Date().toISOString(),
      phoneNumber: phoneNumber.replace(/-/g, '').replace(/\d/g, '*'), // 마스킹
      hasPassword: !!password,
      passwordLength: password.length
    });
    
    setIsLoading(true);
    setApiError('');
    setFormErrors({});
    
    // 기존 AuthContext 에러 초기화 및 에러 처리 플래그 리셋
    if (error) {
      setError(null);
    }
    errorProcessedRef.current = false; // 새로운 로그인 시도를 위해 플래그 리셋
    blockAllEffectsRef.current = false; // useEffect 차단 해제

    let currentFormErrors: Record<string, string> = {};
    if (!phoneNumber.trim()) {
      currentFormErrors.phoneNumber = '전화번호를 입력해주세요.';
    }
    if (!password.trim()) {
      currentFormErrors.password = '비밀번호를 입력해주세요.';
    }

    if (Object.keys(currentFormErrors).length > 0) {
      console.log('[SIGNIN] 입력 검증 실패:', currentFormErrors);
      
      // iOS 로그 전송 - 입력 검증 실패
      sendLogToiOS('warning', '⚠️ 전화번호 로그인 입력 검증 실패', {
        timestamp: new Date().toISOString(),
        errors: currentFormErrors,
        missingFields: Object.keys(currentFormErrors)
      });
      
      setFormErrors(currentFormErrors);
      setIsLoading(false);
      return;
    }

    try {
      console.log('[SIGNIN] AuthContext login 호출 시작');
      
      // iOS 로그 전송 - API 호출 시작
      sendLogToiOS('info', '🔄 전화번호 로그인 API 호출 시작', {
        timestamp: new Date().toISOString(),
        apiEndpoint: '/api/auth/login',
        method: 'POST'
      });
      
      // 전화번호 로그인 시작 시 AuthContext 에러 감지 비활성화
      blockAllEffectsRef.current = true;
      console.log('[SIGNIN] AuthContext 에러 감지 비활성화');
      
      // authService를 통해 직접 로그인 (AuthContext 우회하여 중복 리다이렉트 방지)
      const response = await authService.login({
        mt_id: phoneNumber.replace(/-/g, ''), // 전화번호에서 하이픈 제거
        mt_pwd: password,
      });

      // iOS 로그 전송 - API 응답 수신
      sendLogToiOS('info', '📡 전화번호 로그인 API 응답 수신', {
        timestamp: new Date().toISOString(),
        success: response.success,
        hasMessage: !!response.message,
        hasUserData: !!(response as any).user || !!(response as any).data?.user
      });

      if (!response.success) {
        throw new Error(response.message || '로그인에 실패했습니다.');
      }

      console.log('[SIGNIN] authService 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');
      
      // iOS 로그 전송 - 로그인 성공
      sendLogToiOS('info', '✅ 전화번호 로그인 성공', {
        timestamp: new Date().toISOString(),
        userInfo: {
          hasUserData: !!authService.getUserData(),
          hasToken: !!authService.getToken()
        }
      });
      
      // AuthContext 상태를 수동으로 동기화
      await refreshAuthState();
      console.log('[SIGNIN] AuthContext 상태 동기화 완료');
      
      // iOS 로그 전송 - AuthContext 동기화 완료
      sendLogToiOS('info', '🔄 AuthContext 상태 동기화 완료', {
        timestamp: new Date().toISOString(),
        authState: {
          isLoggedIn: isLoggedIn,
          hasUser: !!authService.getUserData()
        }
      });
      
      // 로그인 성공 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.SUCCESS, '전화번호 로그인 성공', { 
        component: 'signin', 
        action: 'phone-login', 
        phone: phoneNumber.replace(/-/g, '').substring(0, 7) + '****' 
      });
      console.log('🎮 [SIGNIN] 전화번호 로그인 성공 햅틱 피드백 실행');
      
      // 리다이렉트 플래그 설정
      isRedirectingRef.current = true;
      
      // 모든 상태 업데이트 차단
      blockAllEffectsRef.current = true;
      
      // iOS 로그 전송 - 리다이렉트 시작
      sendLogToiOS('info', '🚀 Home 페이지로 리다이렉트 시작', {
        timestamp: new Date().toISOString(),
        redirectMethod: 'router.replace',
        targetPage: '/home'
      });
      
      // router.replace 사용 (페이지 새로고침 없이 이동)
      router.replace('/home');

    } catch (err: any) {
      console.error('[SIGNIN] 🚨 로그인 오류 발생:', err);
      console.log('[SIGNIN] 에러 타입:', typeof err);
      console.log('[SIGNIN] 에러 객체:', err);
      console.log('[SIGNIN] 에러 메시지:', err.message);
      console.log('[SIGNIN] 에러 스택:', err.stack);
      
      // iOS 로그 전송 - 상세 에러 정보
      sendLogToiOS('error', '❌ 전화번호 로그인 실패 - 상세 정보', {
        timestamp: new Date().toISOString(),
        errorDetails: {
          type: typeof err,
          message: err.message,
          stack: err.stack,
          name: err.name,
          code: err.code
        },
        requestInfo: {
          phoneNumber: phoneNumber.replace(/-/g, '').replace(/\d/g, '*'), // 마스킹
          hasPassword: !!password
        }
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
      
      // iOS 로그 전송 - 에러 메시지 변환 및 모달 표시
      sendLogToiOS('info', '🔄 에러 메시지 변환 및 모달 표시', {
        timestamp: new Date().toISOString(),
        originalError: err.message,
        convertedError: errorMessage,
        willShowModal: true
      });
      
      // 로그인 실패 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.ERROR, '전화번호 로그인 실패', { 
        component: 'signin', 
        action: 'phone-login-error', 
        error: err.message 
      });
      console.log('🎮 [SIGNIN] 전화번호 로그인 실패 햅틱 피드백 실행');
      
      try {
        showError(errorMessage);
        console.log('[SIGNIN] ✅ showError 함수 호출 완료');
        sendLogToiOS('info', '✅ 에러 모달 표시 완료', { 
          timestamp: new Date().toISOString(),
          errorMessage 
        });
      } catch (showErrorErr) {
        console.error('[SIGNIN] ❌ showError 함수 호출 실패:', showErrorErr);
        sendLogToiOS('error', '❌ 에러 모달 표시 실패', { 
          timestamp: new Date().toISOString(),
          error: String(showErrorErr) 
        });
      }
      
    } finally {
      setIsLoading(false);
      console.log('[SIGNIN] 로그인 시도 완료');
      
      // iOS 로그 전송 - 로그인 프로세스 완료
      sendLogToiOS('info', '🏁 전화번호 로그인 프로세스 완료', {
        timestamp: new Date().toISOString(),
        finalState: {
          isLoading: false,
          isRedirecting: isRedirectingRef.current,
          blockAllEffects: blockAllEffectsRef.current
        }
      });
    }
  };

  // 에러 모달 닫기 - 단순하게! (브라우저 저장소 정리 포함)
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
    
    // 히스토리 API 복원
    if ((window as any).__SIGNIN_RESTORE_HISTORY__) {
      (window as any).__SIGNIN_RESTORE_HISTORY__();
      delete (window as any).__SIGNIN_RESTORE_HISTORY__;
    }
    
    // location 메서드 복원
    if ((window as any).__SIGNIN_RESTORE_LOCATION__) {
      (window as any).__SIGNIN_RESTORE_LOCATION__();
      delete (window as any).__SIGNIN_RESTORE_LOCATION__;
    }
    
    // fetch 복원
    if ((window as any).__SIGNIN_RESTORE_FETCH__) {
      (window as any).__SIGNIN_RESTORE_FETCH__();
      delete (window as any).__SIGNIN_RESTORE_FETCH__;
    }
    
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
    setErrorModalMessage('');
    
    // 페이지 스크롤 복구
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // 플래그 리셋 (즉시)
    errorProcessedRef.current = false;
    blockAllEffectsRef.current = false;
    preventRemountRef.current = false;
    
    console.log('[SIGNIN] 모든 플래그 리셋 완료');
  };



  // 에러 표시 헬퍼 함수 - 즉시 차단!
  const showError = (message: string) => {
    console.log('[SIGNIN] 💥 showError 함수 시작:', message);
    
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
    
    // 🚨 안전한 기본 이벤트 차단
    const emergencyBlocker = (e: Event) => {
      console.log('[SIGNIN] 🚨 긴급 이벤트 차단:', e.type);
      try {
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      } catch (error) {
        console.warn('[SIGNIN] 이벤트 차단 중 오류:', error);
      }
      return false;
    };
    
    // 안전한 이벤트 리스너 등록
    safeAddEventListener(window, 'beforeunload', emergencyBlocker, { capture: true, passive: false });
    safeAddEventListener(window, 'unload', emergencyBlocker, { capture: true, passive: false });
    safeAddEventListener(window, 'pagehide', emergencyBlocker, { capture: true, passive: false });
    safeAddEventListener(document, 'visibilitychange', emergencyBlocker, { capture: true, passive: false });
    
    // 🚨 즉시 히스토리 고정 (여러 번)
    for (let i = 0; i < 20; i++) {
      window.history.pushState(null, '', window.location.href);
    }
    
    // 🚨 안전한 popstate 차단
    const emergencyPopstateBlocker = (e: PopStateEvent) => {
      console.log('[SIGNIN] 🚨 긴급 popstate 차단!');
      try {
        if (e.preventDefault) e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        window.history.pushState(null, '', window.location.href);
      } catch (error) {
        console.warn('[SIGNIN] popstate 차단 중 오류:', error);
      }
      return false;
    };
    safeAddEventListener(window, 'popstate', emergencyPopstateBlocker, { capture: true, passive: false });
    
    // 🚨 안전한 키보드 차단
    const emergencyKeyBlocker = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.key === 'F5') || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
        console.log('[SIGNIN] 🚨 긴급 키보드 차단:', e.key);
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        } catch (error) {
          console.warn('[SIGNIN] 키보드 이벤트 차단 중 오류:', error);
        }
        return false;
      }
    };
    safeAddEventListener(window, 'keydown', emergencyKeyBlocker, { capture: true, passive: false });
    
    console.log('[SIGNIN] ⚡ 긴급 이벤트 차단 설정 완료');
    
    try {
      console.log('[SIGNIN] 현재 상태:', {
        showErrorModal,
        errorModalMessage,
        isLoading,
        blockAllEffectsRef: blockAllEffectsRef.current,
        preventRemountRef: preventRemountRef.current
      });
      
      // 🚫 브라우저 네비게이션 차단 (최강 버전)
      console.log('[SIGNIN] 브라우저 네비게이션 차단 설정 중...');
      
      // beforeunload 이벤트 (새로고침, 창 닫기 차단) - 안전한 버전
      navigationListenersRef.current.beforeunload = (e: BeforeUnloadEvent) => {
        console.log('[SIGNIN] 🚫 beforeunload 이벤트 차단!');
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          e.returnValue = '에러 모달을 확인해주세요.';
          
          // iOS WebView 환경 체크를 더 안전하게
          if (!isIOSWebView) {
            return false;
          }
        } catch (error) {
          console.warn('[SIGNIN] beforeunload 처리 중 오류:', error);
        }
      };
      
      // popstate 이벤트 (뒤로가기 차단)
      navigationListenersRef.current.popstate = (e: PopStateEvent) => {
        console.log('[SIGNIN] 🚫 popstate 이벤트 차단!');
        e.preventDefault();
        e.stopImmediatePropagation();
        // 즉시 현재 상태로 되돌리기
        setTimeout(() => {
          window.history.pushState(null, '', window.location.href);
        }, 0);
        return false;
      };
      
      // unload 이벤트도 추가 (더 강력한 차단)
      navigationListenersRef.current.unload = (e: Event) => {
        console.log('[SIGNIN] 🚫 unload 이벤트 차단!');
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      };
      
      // pagehide 이벤트 추가 (페이지 숨김 차단)
      navigationListenersRef.current.pagehide = (e: PageTransitionEvent) => {
        console.log('[SIGNIN] 🚫 pagehide 이벤트 차단!');
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      };
      
      // visibilitychange 이벤트 추가 (탭 전환 감지)
      navigationListenersRef.current.visibilitychange = (e: Event) => {
        if (document.visibilityState === 'hidden') {
          console.log('[SIGNIN] 🚫 visibilitychange 이벤트 감지 - 페이지 숨김 시도 차단!');
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      };
      
      // 모든 이벤트 리스너를 안전하게 추가
      const eventOptions = { capture: true, passive: false };
      safeAddEventListener(window, 'beforeunload', navigationListenersRef.current.beforeunload, eventOptions);
      safeAddEventListener(window, 'popstate', navigationListenersRef.current.popstate, eventOptions);
      safeAddEventListener(window, 'unload', navigationListenersRef.current.unload, eventOptions);
      safeAddEventListener(window, 'pagehide', navigationListenersRef.current.pagehide, eventOptions);
      safeAddEventListener(document, 'visibilitychange', navigationListenersRef.current.visibilitychange, eventOptions);
      
      // 키보드 단축키 차단 (F5, Ctrl+R, Ctrl+F5 등)
      navigationListenersRef.current.keydown = (e: KeyboardEvent) => {
        // F5 (새로고침)
        if (e.key === 'F5') {
          console.log('[SIGNIN] 🚫 F5 키 차단!');
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        }
        // Ctrl+R (새로고침)
        if (e.ctrlKey && e.key === 'r') {
          console.log('[SIGNIN] 🚫 Ctrl+R 키 차단!');
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        }
        // Ctrl+F5 (강제 새로고침)
        if (e.ctrlKey && e.key === 'F5') {
          console.log('[SIGNIN] 🚫 Ctrl+F5 키 차단!');
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        }
        // Ctrl+Shift+R (강제 새로고침)
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
          console.log('[SIGNIN] 🚫 Ctrl+Shift+R 키 차단!');
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        }
      };
      
      safeAddEventListener(window, 'keydown', navigationListenersRef.current.keydown, eventOptions);
      
      // 현재 히스토리 상태 고정 (더 많이 실행)
      for (let i = 0; i < 10; i++) {
        window.history.pushState(null, '', window.location.href);
      }
      
      // 주기적으로 히스토리 상태 재고정 (1초마다)
      const historyInterval = setInterval(() => {
        if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          window.history.pushState(null, '', window.location.href);
        } else {
          clearInterval(historyInterval);
        }
      }, 1000);
      
      // Next.js Router 차단 (강제)
      if (typeof window !== 'undefined') {
        // Next.js의 router.push, router.replace 등을 임시로 무력화
        const originalPush = window.history.pushState;
        const originalReplace = window.history.replaceState;
        
        window.history.pushState = function(...args) {
          if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
            console.log('[SIGNIN] 🚫 history.pushState 차단!');
            return;
          }
          return originalPush.apply(this, args);
        };
        
        window.history.replaceState = function(...args) {
          if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
            console.log('[SIGNIN] 🚫 history.replaceState 차단!');
            return;
          }
          return originalReplace.apply(this, args);
        };
        
        // window.location 변경도 차단 (더 강력한 방법)
        try {
          // 기존 메서드들을 백업 (이미 재정의되어 있을 수 있음)
          const originalLocationAssign = window.location.assign.bind(window.location);
          const originalLocationReplace = window.location.replace.bind(window.location);
          const originalLocationReload = window.location.reload.bind(window.location);
          
          // 강제로 재정의 (configurable: true로 설정)
          try {
            Object.defineProperty(window.location, 'assign', {
              value: function(url: string | URL) {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.assign 차단!');
                  return;
                }
                return originalLocationAssign(url);
              },
              writable: true,
              configurable: true
            });
          } catch (e) {
            // 이미 정의되어 있다면 직접 덮어쓰기 시도
            try {
              (window.location as any).assign = function(url: string | URL) {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.assign 차단!');
                  return;
                }
                return originalLocationAssign(url);
              };
            } catch (e2) {
              console.warn('[SIGNIN] location.assign 차단 실패:', e2);
            }
          }
          
          try {
            Object.defineProperty(window.location, 'replace', {
              value: function(url: string | URL) {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.replace 차단!');
                  return;
                }
                return originalLocationReplace(url);
              },
              writable: true,
              configurable: true
            });
          } catch (e) {
            try {
              (window.location as any).replace = function(url: string | URL) {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.replace 차단!');
                  return;
                }
                return originalLocationReplace(url);
              };
            } catch (e2) {
              console.warn('[SIGNIN] location.replace 차단 실패:', e2);
            }
          }
          
          try {
            Object.defineProperty(window.location, 'reload', {
              value: function() {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.reload 차단!');
                  return;
                }
                return originalLocationReload();
              },
              writable: true,
              configurable: true
            });
          } catch (e) {
            try {
              (window.location as any).reload = function() {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.reload 차단!');
                  return;
                }
                return originalLocationReload();
              };
            } catch (e2) {
              console.warn('[SIGNIN] location.reload 차단 실패:', e2);
            }
          }
          
          // window.location.href 직접 할당도 차단
          let originalHref = window.location.href;
          try {
            Object.defineProperty(window.location, 'href', {
              get: function() {
                return originalHref;
              },
              set: function(url: string) {
                if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                  console.log('[SIGNIN] 🚫 location.href 변경 차단!');
                  return;
                }
                originalHref = url;
                window.location.assign(url);
              },
              configurable: true
            });
          } catch (e) {
            console.warn('[SIGNIN] location.href 차단 실패:', e);
          }
          
          // 복원 함수
          (window as any).__SIGNIN_RESTORE_LOCATION__ = () => {
            try {
              Object.defineProperty(window.location, 'assign', {
                value: originalLocationAssign,
                writable: true,
                configurable: true
              });
              Object.defineProperty(window.location, 'replace', {
                value: originalLocationReplace,
                writable: true,
                configurable: true
              });
              Object.defineProperty(window.location, 'reload', {
                value: originalLocationReload,
                writable: true,
                configurable: true
              });
            } catch (e) {
              console.warn('[SIGNIN] location 메서드 복원 실패:', e);
            }
          };
        } catch (e) {
          console.warn('[SIGNIN] location 메서드 차단 실패 (무시):', e);
        }
        
        // 복원 함수 저장
        (window as any).__SIGNIN_RESTORE_HISTORY__ = () => {
          window.history.pushState = originalPush;
          window.history.replaceState = originalReplace;
          // location 메서드는 별도 복원 함수에서 처리
          if ((window as any).__SIGNIN_RESTORE_LOCATION__) {
            (window as any).__SIGNIN_RESTORE_LOCATION__();
          }
        };
      }
      
      console.log('[SIGNIN] 브라우저 네비게이션 차단 완료 (최강 버전)');
      
      // React 컴포넌트 재마운트 방지 - DOM을 직접 조작하여 강제로 고정
      const preventReactRemount = () => {
        // 현재 페이지의 모든 스크립트 태그를 찾아서 새로고침 방지
        const scripts = document.querySelectorAll('script[src*="/_next/"]');
        scripts.forEach(script => {
          script.addEventListener('error', (e) => {
            if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
              console.log('[SIGNIN] 🚫 스크립트 로드 오류 차단!');
              e.preventDefault();
              e.stopPropagation();
            }
          });
        });
        
        // Next.js의 페이지 전환을 완전히 차단
        if ((window as any).__NEXT_DATA__) {
          let originalNextData = (window as any).__NEXT_DATA__;
          Object.defineProperty(window, '__NEXT_DATA__', {
            get: function() {
              if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                console.log('[SIGNIN] 🚫 __NEXT_DATA__ 접근 차단!');
                return originalNextData; // 기존 데이터 유지
              }
              return originalNextData;
            },
            set: function(value) {
              if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
                console.log('[SIGNIN] 🚫 __NEXT_DATA__ 변경 차단!');
                return;
              }
              originalNextData = value;
            },
            configurable: true
          });
        }
        
        // 모든 fetch 요청도 차단 (페이지 데이터 로드 방지)
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
            const url = args[0]?.toString() || '';
            if (url.includes('/_next/') || url.includes('/api/')) {
              console.log('[SIGNIN] 🚫 fetch 요청 차단:', url);
              return Promise.reject(new Error('페이지 고정 모드에서 요청 차단'));
            }
          }
          return originalFetch.apply(this, args);
        };
        
        // 복원 함수
        (window as any).__SIGNIN_RESTORE_FETCH__ = () => {
          window.fetch = originalFetch;
        };
      };
      
      preventReactRemount();
      
      // 🚨 즉시 DOM 직접 에러 모달 생성 (React와 무관)
      // DOM 직접 모달 생성 비활성화 - React AlertModal만 사용
      console.log('[SIGNIN] ⚡ DOM 직접 모달 생성 스킵 - React AlertModal만 사용');
      
      // React 상태도 즉시 설정
      console.log('[SIGNIN] ⚡ 즉시 React 상태 설정...');
      setIsLoading(false);
      setErrorModalMessage(message);
      setShowErrorModal(true);
      
      // React 모달만 사용하므로 DOM 직접 모달 관련 코드 제거
      
      console.log('[SIGNIN] ✅ showError 함수 완료');
    } catch (error) {
      console.error('[SIGNIN] ❌ showError 함수 내부 오류:', error);
    }
  };

  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    console.log('🚀 [GOOGLE LOGIN] 핸들러 시작됨');
    
    setIsLoading(true);
    
    // 타임아웃 설정 (10초 후 자동으로 로딩 해제)
    const timeoutId = setTimeout(() => {
      console.warn('⏰ [GOOGLE LOGIN] 타임아웃 발생 (10초)');
      sendLogToiOS('warning', '⏰ Google 로그인 타임아웃', {
        timestamp: new Date().toISOString(),
        timeout: '10초',
        action: 'auto_loading_off'
      });
      setIsLoading(false);
    }, 10000);
    
    // 🚨 새로운 iOS 로깅 시스템 사용
    iosLogger.logGoogleLogin('로그인 시도 시작', {
      userAgent: navigator.userAgent.substring(0, 100),
      url: window.location.href,
      isIOSWebView: !!(window as any).webkit && !!(window as any).webkit.messageHandlers,
      hasGoogleSDK: !!(window as any).google,
      environment: 'signin_page'
    });
    
    // 레거시 iOS 로그 전송 (호환성 유지)
    sendLogToiOS('info', '🚀 Google 로그인 핸들러 시작', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 100),
      isIOSWebView: !!(window as any).webkit && !!(window as any).webkit.messageHandlers,
      step: 'handler_started'
    });
    
    try {
      console.log('🔍 [GOOGLE LOGIN] 환경 체크 시작');
      
      // 즉시 환경 정보 로그
      const environmentInfo = {
        hasWebkit: !!(window as any).webkit,
        hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
        hasSmapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
        hasIosBridge: !!(window as any).iosBridge,
        hasGoogleSDK: !!(window as any).google,
        userAgent: navigator.userAgent.substring(0, 100),
        currentURL: window.location.href
      };
      console.log('🔍 [GOOGLE LOGIN] 환경 정보:', environmentInfo);
      
      // iOS 로그 전송 - 환경 정보
      sendLogToiOS('info', '🔍 Google 로그인 환경 정보', {
        timestamp: new Date().toISOString(),
        ...environmentInfo,
        step: 'environment_check'
      });
      
      // 🚨 iOS 환경 감지 로직 개선 (운영 환경 대응)
      const hasWebKit = !!(window as any).webkit;
      const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;
      const hasSmapIos = !!(window as any).webkit?.messageHandlers?.smapIos;
      const hasIosBridge = !!(window as any).iosBridge;
      const isIOSUserAgent = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // iOS 앱으로 간주하는 조건들 (더 관대하게 설정)
      const isIOSWebView = (
        // 조건 1: WebKit과 messageHandlers가 모두 있음 (정상적인 iOS 앱)
        (hasWebKit && hasMessageHandlers) ||
        // 조건 2: iOS User Agent + ios-bridge.js 로드됨 (앱 환경)
        (isIOSUserAgent && hasIosBridge) ||
        // 조건 3: 강제 iOS 앱 모드 (테스트용)
        (window as any).__SMAP_FORCE_IOS_APP__ === true ||
        // 조건 4: 강제 Google 로그인 모드 (시뮬레이터 허용)
        (window as any).__SMAP_FORCE_GOOGLE_LOGIN__ === true
      );
      
      const isIOSSimulator = (
        // iOS User Agent 있지만 실제 핸들러가 없는 경우 (시뮬레이터)
        isIOSUserAgent && hasIosBridge && !hasSmapIos
      ) || (
        // 또는 개발자가 강제로 활성화 (테스트용)
        (window as any).__SMAP_FORCE_SIMULATOR_MODE__ === true
      ) || (
        // 🚨 시뮬레이터 패턴 감지 (무조건 허용)
        /Simulator/.test(navigator.userAgent) || 
        navigator.userAgent.includes('iPhone Simulator') ||
        navigator.userAgent.includes('iPad Simulator')
      ) || (
        // 🚨 강제 Google 로그인 플래그 (시뮬레이터로 간주)
        (window as any).__SMAP_FORCE_GOOGLE_LOGIN__ === true ||
        (window as any).__SMAP_IGNORE_ALL_RESTRICTIONS__ === true
      );
      
      console.log('[GOOGLE LOGIN] 환경 체크 (강화):', {
        isIOSWebView,
        isIOSSimulator,
        hasWebKit,
        hasMessageHandlers,
        hasSmapIos,
        hasIosBridge,
        isIOSUserAgent,
        hasGoogleSignIn: !!(window as any).iosBridge?.googleSignIn,
        hasGoogleSignInMethod: !!(window as any).iosBridge?.googleSignIn?.signIn,
        userAgent: navigator.userAgent.substring(0, 100),
        environment: process.env.NODE_ENV,
        currentURL: window.location.href
      });
      
      // iOS 로그 전송 - 환경 체크 결과
      sendLogToiOS('info', '🔍 Google 로그인 환경 체크 완료 (강화)', {
        timestamp: new Date().toISOString(),
        environment: {
          isIOSWebView,
          isIOSSimulator,
          hasWebKit,
          hasMessageHandlers,
          hasSmapIos,
          hasIosBridge,
          isIOSUserAgent,
          hasGoogleSignIn: !!(window as any).iosBridge?.googleSignIn,
          hasGoogleSignInMethod: !!(window as any).iosBridge?.googleSignIn?.signIn,
          currentURL: window.location.href
        }
      });
      
              // 🚨 무조건 네이티브 로그인 시도 (웹 SDK 비활성화)
      if (isIOSWebView || isIOSSimulator || true) { // 모든 환경 허용
          // 🚨 웹 SDK 사용 조건을 매우 제한적으로 설정 (거의 사용하지 않음)
        if (false) { // 웹 SDK 사용 비활성화
          debugLog('[GOOGLE LOGIN] 🚨 웹 Google SDK 사용 (비활성화됨)');
          
          // 모든 iOS 환경에서 웹 Google SDK 허용
          try {
            // Google SDK 로드 확인
            if (typeof (window as any).google === 'undefined') {
              console.log('[GOOGLE LOGIN] Google SDK 로드 시작...');
              
              // 프로덕션 환경 감지
              const isProduction = window.location.hostname.includes('.smap.site');
              const isIOSWebView = typeof window !== 'undefined' && 
                                  !!(window as any).webkit && 
                                  !!(window as any).webkit.messageHandlers;
              
              console.log(`🔐 [GOOGLE SDK] 환경: ${isProduction ? '프로덕션' : '개발'}, iOS: ${isIOSWebView}`);
              
              // Google SDK 동적 로드
              const script = document.createElement('script');
              script.src = 'https://accounts.google.com/gsi/client';
              script.async = true;
              script.defer = true;
              script.id = 'google-gsi-client';
              
              let hasErrorOccurred = false;
              
              script.onload = () => {
                console.log('[GOOGLE LOGIN] Google SDK 로드 완료');
                if (!hasErrorOccurred) {
                  // SDK 로드 후 로그인 재시도
                  setTimeout(() => handleGoogleSDKLogin(), 500);
                }
              };
              
              script.onerror = () => {
                console.error('[GOOGLE LOGIN] Google SDK 로드 실패');
                hasErrorOccurred = true;
                
                let errorMessage = 'Google SDK 로드에 실패했습니다.';
                if (isProduction) {
                  errorMessage += '\n\n프로덕션 환경에서 Google 서비스에 접근할 수 없습니다.\n도메인 등록을 확인해주세요.';
                }
                errorMessage += '\n\n잠시 후 다시 시도하거나\n전화번호 로그인을 사용해주세요.';
                
                showError(errorMessage);
                setIsLoading(false);
              };
              
              // 중복 로드 방지는 생략 (어차피 웹 SDK 사용 안함)
              
              document.head.appendChild(script);
              
              // 타임아웃 설정 (프로덕션에서는 더 긴 시간)
              const timeout = isProduction ? 15000 : 10000;
              setTimeout(() => {
                if (typeof (window as any).google === 'undefined' && !hasErrorOccurred) {
                  console.warn(`[GOOGLE LOGIN] SDK 로드 타임아웃 (${timeout}ms)`);
                  hasErrorOccurred = true;
                  showError(`Google 서비스 연결에 시간이 너무 오래 걸립니다 (${timeout/1000}초).\n\n네트워크 연결을 확인하고\n다시 시도해주세요.`);
                  setIsLoading(false);
                }
              }, timeout);
              
              return;
            } else {
              // SDK가 이미 로드되어 있으면 바로 실행
              setTimeout(() => handleGoogleSDKLogin(), 100);
              return;
            }
          } catch (error) {
            console.error('[GOOGLE LOGIN] Google SDK 처리 실패:', error);
            showError('Google 로그인 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도하거나\n전화번호 로그인을 사용해주세요.');
            setIsLoading(false);
            return;
          }
        }
        
        // 실제 iOS 앱에서는 네이티브 로그인 시도
        console.log('[GOOGLE LOGIN] iOS WebView에서 네이티브 Google Sign-In 사용');
          
        // iOS 로그 전송 - 네이티브 Google Sign-In 사용
        sendLogToiOS('info', '📱 iOS 네이티브 Google Sign-In 사용', {
          timestamp: new Date().toISOString(),
          bridgeType: 'iOS WebView'
        });
        
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
            console.log('🌉 [GOOGLE LOGIN] ios-bridge.js googleSignIn 메서드 사용');
            
            // iOS 로그 전송 - ios-bridge 메서드 사용
            sendLogToiOS('info', '🌉 ios-bridge.js googleSignIn 메서드 사용', {
              timestamp: new Date().toISOString(),
              method: 'iosBridge.googleSignIn.signIn',
              step: 'native_call_attempt'
            });
            
            try {
              console.log('📱 [GOOGLE LOGIN] 네이티브 호출 실행 중...');
              (window as any).iosBridge.googleSignIn.signIn();
              console.log('✅ [GOOGLE LOGIN] ios-bridge 메시지 전송 완료, 콜백 대기 중...');
              
              // iOS 로그 전송 - 네이티브 호출 성공
              sendLogToiOS('info', '✅ Google Sign-In 네이티브 호출 성공', {
                timestamp: new Date().toISOString(),
                waitingFor: 'native callback',
                step: 'native_call_success'
              });
              
              return;
            } catch (error) {
              console.error('❌ [GOOGLE LOGIN] 네이티브 호출 중 오류:', error);
              
              // iOS 로그 전송 - 네이티브 호출 오류
              sendLogToiOS('error', '❌ Google Sign-In 네이티브 호출 오류', {
                timestamp: new Date().toISOString(),
                error: error?.toString(),
                step: 'native_call_error'
              });
              
              // 오류 발생 시 웹 SDK로 fallback
            }
          }

          // ios-bridge.js가 아직 로드되지 않았다면 잠시 대기
          console.log('[GOOGLE LOGIN] ios-bridge.js 로드 대기 중...');
          
          // iOS 로그 전송 - ios-bridge 로드 대기
          sendLogToiOS('info', '⏳ ios-bridge.js 로드 대기 중', {
            timestamp: new Date().toISOString(),
            maxWaitTime: '3000ms'
          });
          
          const bridgeLoaded = await waitForIosBridge();
          
          if (bridgeLoaded) {
            console.log('[GOOGLE LOGIN] ios-bridge.js 로드 완료, googleSignIn 메서드 사용');
            
            // iOS 로그 전송 - ios-bridge 로드 완료
            sendLogToiOS('info', '✅ ios-bridge.js 로드 완료', {
              timestamp: new Date().toISOString(),
              method: 'iosBridge.googleSignIn.signIn'
            });
            
            (window as any).iosBridge.googleSignIn.signIn();
            console.log('[GOOGLE LOGIN] ios-bridge 메시지 전송 완료, 콜백 대기 중...');
            
            // iOS 로그 전송 - 콜백 대기
            sendLogToiOS('info', '⏳ Google Sign-In 콜백 대기 중 (로드 후)', {
              timestamp: new Date().toISOString(),
              waitingFor: 'native callback'
            });
            
            return;
          }
          
          // 직접 메시지 핸들러 사용 (fallback)
          if ((window as any).webkit?.messageHandlers?.smapIos) {
            console.log('[GOOGLE LOGIN] 직접 메시지 핸들러 사용 (fallback)');
            
            // iOS 로그 전송 - 직접 메시지 핸들러 사용
            sendLogToiOS('info', '🔄 직접 메시지 핸들러 사용 (fallback)', {
              timestamp: new Date().toISOString(),
              handler: 'webkit.messageHandlers.smapIos',
              messageType: 'googleSignIn'
            });
            
            (window as any).webkit.messageHandlers.smapIos.postMessage({
              type: 'googleSignIn',
              param: ''
            });
            
            console.log('[GOOGLE LOGIN] 네이티브 메시지 전송 완료, 콜백 대기 중...');
            // 로딩 상태는 콜백에서 처리되므로 여기서는 유지
            
            // iOS 로그 전송 - 네이티브 메시지 전송 완료
            sendLogToiOS('info', '📡 네이티브 메시지 전송 완료', {
              timestamp: new Date().toISOString(),
              waitingFor: 'native callback'
            });
            
            return;
          } else {
            console.warn('[GOOGLE LOGIN] smapIos 메시지 핸들러를 찾을 수 없음');
            
            // iOS 로그 전송 - 메시지 핸들러 없음
            sendLogToiOS('warning', '⚠️ smapIos 메시지 핸들러 없음', {
              timestamp: new Date().toISOString(),
              hasWebkit: !!(window as any).webkit,
              hasMessageHandlers: !!(window as any).webkit?.messageHandlers
            });
          }
        } catch (e) {
          console.error('[GOOGLE LOGIN] iOS 네이티브 구글 로그인 요청 실패:', e);
          
          // iOS 로그 전송 - 네이티브 요청 실패
          sendLogToiOS('error', '❌ iOS 네이티브 Google 로그인 요청 실패', {
            timestamp: new Date().toISOString(),
            error: e instanceof Error ? e.message : String(e),
            errorStack: e instanceof Error ? e.stack : undefined
          });
        }
          
        // 네이티브 처리가 불가능한 경우 웹 SDK로 fallback
        console.log('[GOOGLE LOGIN] 네이티브 실패, 웹 SDK로 fallback');
        
        // iOS 로그 전송 - 웹 SDK fallback
        sendLogToiOS('info', '🌐 웹 SDK fallback 사용', {
          timestamp: new Date().toISOString(),
          reason: 'native_failed_or_unavailable'
        });
        
        setTimeout(() => {
          handleGoogleSDKLogin();
        }, 100);
        return;
      }
      
      // 🚨 모든 환경에서 Google SDK 완전 허용 (시뮬레이터 포함)
              debugLog('[GOOGLE LOGIN] 🚨 모든 환경에서 Google SDK 로그인 허용 (시뮬레이터 포함)');
        
        // iOS 로그 전송 - 모든 환경 허용 (경고 레벨로 변경)
        sendLogToiOS('warning', '🌐 모든 환경에서 Google SDK 로그인 허용 (시뮬레이터 포함)', {
          timestamp: new Date().toISOString(),
          environment: 'universal_including_simulator',
          userAgent: navigator.userAgent.substring(0, 50), // UserAgent 길이 제한
          restriction: 'COMPLETELY_REMOVED',
          simulator_allowed: true,
          isIOSSimulator,
          isIOSWebView
        });
      
      // Google SDK를 사용한 로그인 처리 (모든 환경 허용)
      setTimeout(() => {
        handleGoogleSDKLogin();
      }, 100);
      return;
      
      /*
      // NextAuth 관련 코드 임시 비활성화
      const result = await signIn('google', {
        redirect: false,
        callbackUrl: '/home'
      });
      console.log('Google 로그인 결과:', result);
      if (result?.error) {
        showError(`구글 로그인 실패: ${result.error}`);
        return;
      }
      if (result?.ok) {
        const session = await getSession();
        console.log('Google 로그인 세션:', session);
        if (session?.backendData) {
          try {
            const userData = session.backendData.member;
            const token = session.backendData.token || '';
            console.log('[GOOGLE LOGIN] 새로운 사용자 정보:', userData.mt_name, 'ID:', userData.mt_idx);
            const existingUserData = authService.getUserData();
            if (existingUserData && existingUserData.mt_idx !== userData.mt_idx) {
              console.log('[GOOGLE LOGIN] 다른 사용자 감지, 기존 데이터 초기화:', existingUserData.mt_idx, '->', userData.mt_idx);
              authService.clearAuthData();
            }
            authService.setUserData(userData);
            authService.setToken(token);
            console.log('[GOOGLE LOGIN] 저장 완료, home으로 이동');
          } catch (error) {
            console.error('사용자 정보 저장 실패:', error);
          }
        }
        console.log('[GOOGLE LOGIN] 로그인 성공 - 자동 리다이렉션 대기');
      }
      */
          } catch (error) {
        console.error('Google 로그인 실패:', error);
        
        // iOS 로그 전송 - Google 로그인 catch 블록
        sendLogToiOS('error', '❌ Google 로그인 catch 블록', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error)
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
        
        // iOS 로그 전송 - 에러 메시지 변환
        sendLogToiOS('info', '🔄 Google 로그인 에러 메시지 변환', {
          timestamp: new Date().toISOString(),
          originalError: error instanceof Error ? error.message : String(error),
          convertedError: errorMessage
        });
        
        // 에러 모달 강제 표시
        setTimeout(() => {
          showError(errorMessage);
        }, 100);
      } finally {
        setIsLoading(false);
        
        // 타임아웃 정리 (finally에서도 정리)
        clearTimeout(timeoutId);
        
        // iOS 로그 전송 - Google 로그인 프로세스 완료
        sendLogToiOS('info', '🏁 Google 로그인 프로세스 완료', {
          timestamp: new Date().toISOString(),
          finalState: {
            isLoading: false
          }
        });
      }
  };

  // Kakao 로그인 핸들러
  const handleKakaoLogin = async () => {
    // 🚨 새로운 iOS 로깅 시스템 사용
    iosLogger.logKakaoLogin('로그인 시도 시작', {
      hasKakaoSDK: !!window.Kakao,
      isKakaoInitialized: window.Kakao ? window.Kakao.isInitialized() : false,
      kakaoVersion: window.Kakao ? window.Kakao.VERSION : 'unknown',
      url: window.location.href,
      environment: 'signin_page'
    });
    
    // 레거시 iOS 로그 전송 (호환성 유지)
    sendLogToiOS('info', '💬 카카오 로그인 시도 시작', {
      timestamp: new Date().toISOString(),
      hasKakaoSDK: !!window.Kakao,
      isKakaoInitialized: window.Kakao ? window.Kakao.isInitialized() : false
    });
    
    // 카카오 SDK가 로드되었는지 확인
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      // iOS 로그 전송 - 카카오 SDK 없음
      sendLogToiOS('error', '❌ 카카오 SDK 로드 실패', {
        timestamp: new Date().toISOString(),
        hasKakao: !!window.Kakao,
        isInitialized: window.Kakao ? window.Kakao.isInitialized() : false
      });
      
      showError('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsLoading(true);
    
    // iOS 로그 전송 - 카카오 로그인 팝업 시작
    sendLogToiOS('info', '🚀 카카오 로그인 팝업 시작', {
      timestamp: new Date().toISOString(),
      kakaoSDKVersion: window.Kakao ? window.Kakao.VERSION : 'unknown'
    });
    
    try {
      // 카카오 로그인 팝업 띄우기
              window.Kakao.Auth.login({
          success: async (authObj: any) => {
            try {
              console.log('카카오 로그인 성공:', authObj);
              
              // iOS 로그 전송 - 카카오 로그인 성공
              sendLogToiOS('info', '✅ 카카오 로그인 성공 (토큰 획득)', {
                timestamp: new Date().toISOString(),
                hasAccessToken: !!authObj.access_token,
                tokenType: authObj.token_type || 'unknown',
                expiresIn: authObj.expires_in || 'unknown'
              });
              
              // iOS 로그 전송 - 백엔드 API 호출 시작
              sendLogToiOS('info', '🔄 백엔드 카카오 인증 API 호출 시작', {
                timestamp: new Date().toISOString(),
                apiEndpoint: '/api/kakao-auth',
                method: 'POST'
              });
              
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
              
              // iOS 로그 전송 - 백엔드 API 응답
              sendLogToiOS('info', '📡 백엔드 카카오 인증 API 응답', {
                timestamp: new Date().toISOString(),
                success: data.success,
                hasUser: !!data.user,
                hasError: !!data.error,
                responseStatus: response.status
              });

              if (data.success) {
                console.log('[KAKAO LOGIN] 카카오 로그인 성공, 사용자 정보:', data.user);
                
                // 🚨 Kakao 로그인 성공 상세 로깅
                iosLogger.logKakaoLogin('로그인 성공', {
                  hasUser: !!data.user,
                  hasToken: !!data.token,
                  isNewUser: data.isNewUser || false,
                  userEmail: data.user?.mt_email ? data.user.mt_email.substring(0, 3) + '***@' + data.user.mt_email.split('@')[1] : 'unknown',
                  userNickname: data.user?.mt_nickname || 'unknown',
                  userId: data.user?.mt_idx || 'unknown',
                  provider: 'kakao'
                });
                
                // 레거시 iOS 로그 전송 (호환성 유지)
                sendLogToiOS('info', '💾 카카오 사용자 정보 저장', {
                  timestamp: new Date().toISOString(),
                  hasUserData: !!data.user,
                  userEmail: data.user?.mt_email ? data.user.mt_email.substring(0, 3) + '***' : 'unknown'
                });
                
                // authService에 사용자 정보 설정 (AuthContext 우회, JWT 토큰은 이미 쿠키에 저장됨)
                if (data.user) {
                  authService.setUserData(data.user);
                  // 토큰은 쿠키에 저장되므로 별도 설정 불필요
                }
                
                console.log('[KAKAO LOGIN] 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');
                
                // iOS 로그 전송 - AuthContext 동기화 시작
                sendLogToiOS('info', '🔄 AuthContext 상태 동기화 시작', {
                  timestamp: new Date().toISOString(),
                  authServiceData: {
                    hasUserData: !!authService.getUserData(),
                    hasToken: !!authService.getToken()
                  }
                });
                
                // AuthContext 상태를 수동으로 동기화
                await refreshAuthState();
                console.log('[KAKAO LOGIN] AuthContext 상태 동기화 완료');
                
                // iOS 로그 전송 - AuthContext 동기화 완료
                sendLogToiOS('info', '✅ AuthContext 상태 동기화 완료', {
                  timestamp: new Date().toISOString(),
                  authState: {
                    isLoggedIn: isLoggedIn,
                    hasUser: !!authService.getUserData()
                  }
                });
              
              // 카카오 로그인 성공 햅틱 피드백
              triggerHapticFeedback(HapticFeedbackType.SUCCESS, '카카오 로그인 성공', { 
                component: 'signin', 
                action: 'kakao-login', 
                userEmail: data.user?.mt_email?.substring(0, 3) + '***' 
              });
              console.log('🎮 [SIGNIN] 카카오 로그인 성공 햅틱 피드백 실행');
              
              // 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
                              // 모든 상태 업데이트 차단
                blockAllEffectsRef.current = true;
                
                // iOS 로그 전송 - 리다이렉트 시작
                sendLogToiOS('info', '🚀 Home 페이지로 리다이렉트 시작', {
                  timestamp: new Date().toISOString(),
                  redirectMethod: 'router.replace',
                  targetPage: '/home'
                });
                
                // router.replace 사용 (페이지 새로고침 없이 이동)
                router.replace('/home');
                return;
            } else {
              throw new Error(data.error || '로그인에 실패했습니다.');
            }
                      } catch (error: any) {
              console.error('카카오 로그인 처리 오류:', error);
              
              // iOS 로그 전송 - 카카오 로그인 처리 오류
              sendLogToiOS('error', '❌ 카카오 로그인 처리 오류', {
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                } : String(error),
                isWithdrawnUser: error.response?.status === 403 && error.response?.data?.isWithdrawnUser
              });
              
              // 탈퇴한 사용자 오류 처리
              if (error.response?.status === 403 && error.response?.data?.isWithdrawnUser) {
                // iOS 로그 전송 - 탈퇴한 사용자
                sendLogToiOS('warning', '⚠️ 탈퇴한 카카오 사용자 로그인 시도', {
                  timestamp: new Date().toISOString(),
                  responseStatus: error.response.status
                });
                
                showError('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
              } else {
                showError(error.message || '로그인 처리 중 오류가 발생했습니다.');
              }
            } finally {
              setIsLoading(false);
              
              // iOS 로그 전송 - 카카오 로그인 success 콜백 완료
              sendLogToiOS('info', '🏁 카카오 로그인 success 콜백 완료', {
                timestamp: new Date().toISOString(),
                isLoading: false
              });
            }
        },
                  fail: (error: any) => {
            console.error('카카오 로그인 실패:', error);
            
            // iOS 로그 전송 - 카카오 로그인 실패
            sendLogToiOS('error', '❌ 카카오 로그인 실패 (fail 콜백)', {
              timestamp: new Date().toISOString(),
              error: error ? String(error) : 'unknown error'
            });
            
            showError('카카오 로그인에 실패했습니다.');
          },
        });
      } catch (error: any) {
        console.error('카카오 로그인 오류:', error);
        
        // iOS 로그 전송 - 카카오 로그인 catch 블록
        sendLogToiOS('error', '❌ 카카오 로그인 catch 블록', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error)
        });
        
        showError('카카오 로그인 중 오류가 발생했습니다.');
      } finally {
        // iOS 로그 전송 - 카카오 로그인 프로세스 완료
        sendLogToiOS('info', '🏁 카카오 로그인 프로세스 완료', {
          timestamp: new Date().toISOString(),
          finalState: {
            isLoading: false
          }
        });
      }
    };

  // 로딩 스피너 컴포넌트 (통일된 디자인)
  const LoadingSpinner = ({ message, fullScreen = true }: { message: string; fullScreen?: boolean }) => {
    if (fullScreen) {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg">
            <UnifiedLoadingSpinner size="md" message={message} />
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center">
        <UnifiedLoadingSpinner size="sm" message={message} inline color="white" />
      </div>
    );
  };

  // Kakao SDK 로드
  useEffect(() => {
    const loadKakaoSDK = () => {
      const script = document.createElement('script');
      script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
      script.async = true;
      script.onload = () => {
        // 카카오 SDK 초기화
        if (window.Kakao && !window.Kakao.isInitialized()) {
          const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
          if (kakaoAppKey) {
            window.Kakao.init(kakaoAppKey);
            console.log('카카오 SDK 초기화 완료');
          } else {
            console.error('카카오 앱 키가 설정되지 않았습니다.');
          }
        }
      };
      document.head.appendChild(script);
    };

    loadKakaoSDK();
  }, []);

  // 컴포넌트 언마운트 시 모든 이벤트 리스너 정리
  useEffect(() => {
    return () => {
      // 모든 네비게이션 차단 이벤트 리스너 제거
      if (navigationListenersRef.current.beforeunload) {
        window.removeEventListener('beforeunload', navigationListenersRef.current.beforeunload);
      }
      if (navigationListenersRef.current.popstate) {
        window.removeEventListener('popstate', navigationListenersRef.current.popstate);
      }
      if (navigationListenersRef.current.unload) {
        window.removeEventListener('unload', navigationListenersRef.current.unload);
      }
      if (navigationListenersRef.current.pagehide) {
        window.removeEventListener('pagehide', navigationListenersRef.current.pagehide);
      }
      if (navigationListenersRef.current.visibilitychange) {
        document.removeEventListener('visibilitychange', navigationListenersRef.current.visibilitychange);
      }
      if (navigationListenersRef.current.keydown) {
        window.removeEventListener('keydown', navigationListenersRef.current.keydown);
      }
      
      // 브라우저 저장소에서 에러 모달 상태 제거
      sessionStorage.removeItem('__SIGNIN_ERROR_MODAL_ACTIVE__');
      sessionStorage.removeItem('__SIGNIN_ERROR_MESSAGE__');
      sessionStorage.removeItem('__SIGNIN_PREVENT_REMOUNT__');
      sessionStorage.removeItem('__SIGNIN_BLOCK_ALL_EFFECTS__');
      
      // 전역 플래그 정리
      delete (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__;
      delete (window as any).__SIGNIN_ERROR_MESSAGE__;
      
      // 스크롤 복구
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      console.log('[SIGNIN] 컴포넌트 언마운트 - 모든 이벤트 리스너 및 브라우저 저장소 정리 완료');
    };
  }, []);

  // 인증 상태 확인 중일 때 로딩 화면 표시
  // if (isCheckingAuth) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
  //       <div className="text-center">
  //         <div 
  //           className="rounded-full h-16 w-16 border-4 border-gray-200 border-t-indigo-600 mx-auto mb-6"
  //           style={{
  //             WebkitAnimation: 'spin 1s linear infinite',
  //             animation: 'spin 1s linear infinite',
  //             WebkitTransformOrigin: 'center',
  //             transformOrigin: 'center',
  //             willChange: 'transform'
  //           }}
  //         ></div>
  //         <h2 className="text-xl font-semibold text-gray-800 mb-2">인증 상태 확인 중</h2>
  //         <p className="text-gray-600">잠시만 기다려주세요...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // 🔬 상세 햅틱 디버깅 함수들 추가
  const runDetailedHapticDebug = () => {
    console.log('🔬 [HAPTIC DEBUG] ===== 상세 햅틱 디버깅 시작 =====');
    sendLogToiOS('info', '[HAPTIC DEBUG] 상세 햅틱 디버깅 시작', { timestamp: Date.now() });
    
    // 1. 환경 정보 수집
    const envInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      hasWebKit: !!(window as any).webkit,
      hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
      availableHandlers: (window as any).webkit?.messageHandlers ? 
        Object.keys((window as any).webkit.messageHandlers) : [],
      hasSmapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
      hasNativeFunctions: {
        SMAP_FORCE_HAPTIC: typeof (window as any).SMAP_FORCE_HAPTIC === 'function',
        SMAP_CHECK_HANDLERS: typeof (window as any).SMAP_CHECK_HANDLERS === 'function'
      }
    };
    
    console.log('🔬 [HAPTIC DEBUG] 환경 정보:', envInfo);
    sendLogToiOS('info', '[HAPTIC DEBUG] 환경 정보', envInfo);
    
    // 2. 각 햅틱 타입별 테스트
    const hapticTypes = ['success', 'warning', 'error', 'light', 'medium', 'heavy'];
    
    hapticTypes.forEach((type, index) => {
      setTimeout(() => {
        console.log(`🔬 [HAPTIC DEBUG] ${type.toUpperCase()} 햅틱 테스트 시작`);
        sendLogToiOS('info', `[HAPTIC DEBUG] ${type.toUpperCase()} 햅틱 테스트`, { 
          type, 
          testIndex: index + 1,
          totalTests: hapticTypes.length 
        });
        
        // 3가지 방법으로 동시 시도
        testAllHapticMethods(type as HapticFeedbackType);
        
      }, index * 2000); // 2초 간격
    });
  };
  
  const testAllHapticMethods = (type: HapticFeedbackType) => {
    const webkit = (window as any).webkit;
    const results = {
      nativeFunction: false,
      directMessage: false,
      utilFunction: false,
      errors: [] as string[]
    };
    
    // 방법 1: 네이티브 강제 함수
    try {
      if (typeof (window as any).SMAP_FORCE_HAPTIC === 'function') {
        console.log(`🔬 [METHOD 1] 네이티브 강제 함수 시도: ${type}`);
        const result = (window as any).SMAP_FORCE_HAPTIC(type);
        results.nativeFunction = !!result;
        sendLogToiOS('info', `[METHOD 1] 네이티브 강제 함수 결과`, { type, result });
      }
         } catch (error) {
       const errorMsg = `네이티브 함수 에러: ${error}`;
       results.errors.push(errorMsg);
       console.error(`🔬 [METHOD 1] ${errorMsg}`);
       sendLogToiOS('error', `[METHOD 1] ${errorMsg}`, { type, error: String(error) });
     }
    
    // 방법 2: 직접 메시지 전송
    try {
      if (webkit?.messageHandlers?.smapIos) {
        console.log(`🔬 [METHOD 2] 직접 메시지 전송: ${type}`);
        webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: type,
          debug: true,
          timestamp: Date.now()
        });
        results.directMessage = true;
        sendLogToiOS('info', `[METHOD 2] 직접 메시지 전송 완료`, { type });
      }
         } catch (error) {
       const errorMsg = `직접 메시지 에러: ${error}`;
       results.errors.push(errorMsg);
       console.error(`🔬 [METHOD 2] ${errorMsg}`);
       sendLogToiOS('error', `[METHOD 2] ${errorMsg}`, { type, error: String(error) });
     }
    
    // 방법 3: triggerHapticFeedback 유틸
    try {
      console.log(`🔬 [METHOD 3] triggerHapticFeedback 유틸: ${type}`);
      triggerHapticFeedback(type, `상세 디버그 테스트 - ${type}`, { 
        component: 'signin-debug', 
        action: 'detailed-test',
        debugMode: true
      });
      results.utilFunction = true;
      sendLogToiOS('info', `[METHOD 3] triggerHapticFeedback 완료`, { type });
         } catch (error) {
       const errorMsg = `유틸 함수 에러: ${error}`;
       results.errors.push(errorMsg);
       console.error(`🔬 [METHOD 3] ${errorMsg}`);
       sendLogToiOS('error', `[METHOD 3] ${errorMsg}`, { type, error: String(error) });
     }
    
    // 결과 종합
    const summary = {
      type,
      successful: results.nativeFunction || results.directMessage || results.utilFunction,
      methods: results,
      timestamp: Date.now()
    };
    
    console.log(`🔬 [HAPTIC DEBUG] ${type} 테스트 결과:`, summary);
    sendLogToiOS('info', `[HAPTIC DEBUG] ${type} 테스트 결과`, summary);
  };
  
  // 🎯 실시간 핸들러 상태 모니터링
  const startHandlerMonitoring = () => {
    console.log('🎯 [HANDLER MONITOR] 실시간 모니터링 시작');
    sendLogToiOS('info', '[HANDLER MONITOR] 실시간 모니터링 시작');
    
    const monitor = () => {
      const webkit = (window as any).webkit;
      const status = {
        timestamp: new Date().toISOString(),
        webkit: !!webkit,
        messageHandlers: !!webkit?.messageHandlers,
        smapIos: !!webkit?.messageHandlers?.smapIos,
        availableHandlers: webkit?.messageHandlers ? 
          Object.keys(webkit.messageHandlers) : [],
        nativeFunctions: {
          SMAP_FORCE_HAPTIC: typeof (window as any).SMAP_FORCE_HAPTIC,
          SMAP_CHECK_HANDLERS: typeof (window as any).SMAP_CHECK_HANDLERS
        },
        // 추가 디버깅 정보
        userAgent: navigator.userAgent.substring(0, 50),
        webkitDetails: webkit ? {
          hasUserContentController: !!webkit.messageHandlers,
          messageHandlersKeys: webkit?.messageHandlers ? Object.keys(webkit.messageHandlers) : 'null',
          webkitType: typeof webkit
        } : null
      };
      
      console.log('🎯 [HANDLER MONITOR] 현재 상태:', status);
      sendLogToiOS('info', '[HANDLER MONITOR] 핸들러 상태', status);
      
      // WebKit이 있지만 messageHandlers가 없는 경우 경고
      if (webkit && !webkit.messageHandlers) {
        console.warn('⚠️ [WEBKIT WARNING] WebKit 존재하지만 messageHandlers 없음!');
        console.warn('⚠️ [iOS 조치 필요] webView.configuration.userContentController.add(self, name: "smapIos")');
        sendLogToiOS('warning', '[WEBKIT WARNING] messageHandlers 없음', {
          suggestion: 'iOS에서 webView.configuration.userContentController.add(self, name: "smapIos") 추가 필요'
        });
      }
      
      // 네이티브 체크 함수가 있으면 호출
      if (typeof (window as any).SMAP_CHECK_HANDLERS === 'function') {
        try {
          const nativeCheck = (window as any).SMAP_CHECK_HANDLERS();
          console.log('🎯 [NATIVE CHECK] 네이티브 핸들러 체크:', nativeCheck);
          sendLogToiOS('info', '[NATIVE CHECK] 네이티브 핸들러 체크', nativeCheck);
                 } catch (e) {
           console.error('🎯 [NATIVE CHECK] 에러:', e);
           sendLogToiOS('error', '[NATIVE CHECK] 체크 실패', { error: String(e) });
         }
      }
      
      return status;
    };
    
    // 즉시 실행
    monitor();
    
    // 5초마다 모니터링
    const interval = setInterval(monitor, 5000);
    
    // 30초 후 자동 종료
    setTimeout(() => {
      clearInterval(interval);
      console.log('🎯 [HANDLER MONITOR] 모니터링 종료');
      sendLogToiOS('info', '[HANDLER MONITOR] 모니터링 종료');
    }, 30000);
    
    return interval;
  };
  
  // 🧪 빠른 테스트 함수들 (전역으로 등록)
  const registerTestFunctions = () => {
    // 햅틱 테스트 함수
    (window as any).TEST_HAPTIC = (type = 'success') => {
      console.log(`🧪 [TEST] 햅틱 테스트: ${type}`);
      
      // 여러 방법으로 시도
      const methods = [
        () => (window as any).iosBridge?.haptic?.[type]?.(),
        () => (window as any).webkit?.messageHandlers?.smapIos?.postMessage({
          type: 'haptic', param: type, source: 'TEST_HAPTIC'
        }),
        () => (window as any).SMAP_HAPTIC_TEST?.(type)
      ];
      
      methods.forEach((method, i) => {
        try {
          console.log(`🧪 방법 ${i + 1} 시도`);
          method();
        } catch (e) {
          console.error(`❌ 방법 ${i + 1} 실패:`, e);
        }
      });
    };
    
    // 구글 로그인 테스트 함수
    (window as any).TEST_GOOGLE = () => {
      console.log('🧪 [TEST] Google 로그인 테스트');
      
      const methods = [
        () => (window as any).iosBridge?.googleSignIn?.signIn?.(),
        () => (window as any).webkit?.messageHandlers?.smapIos?.postMessage({
          type: 'googleSignIn', param: '', source: 'TEST_GOOGLE'
        }),
        () => (window as any).SMAP_GOOGLE_TEST?.()
      ];
      
      methods.forEach((method, i) => {
        try {
          console.log(`🧪 Google 방법 ${i + 1} 시도`);
          method();
        } catch (e) {
          console.error(`❌ Google 방법 ${i + 1} 실패:`, e);
        }
      });
    };
    
    // 환경 정보 출력 함수
    (window as any).TEST_ENV = () => {
      const env = {
        webkit: !!(window as any).webkit,
        messageHandlers: !!(window as any).webkit?.messageHandlers,
        smapIos: !!(window as any).webkit?.messageHandlers?.smapIos,
        iosBridge: !!(window as any).iosBridge,
        userAgent: navigator.userAgent.substring(0, 100),
        url: window.location.href
      };
      console.log('🔍 [TEST] 환경 정보:', env);
      return env;
    };
    
    console.log('🧪 [TEST] 테스트 함수 등록 완료:');
    console.log('  TEST_HAPTIC("success") - 햅틱 테스트');
    console.log('  TEST_GOOGLE() - 구글 로그인 테스트');
    console.log('  TEST_ENV() - 환경 정보');
  };

  // 🔧 WebKit 핸들러 강제 등록 시도
  const forceRegisterHandlers = () => {
    console.log('🔧 [FORCE REGISTER] WebKit 핸들러 강제 등록 시도');
    sendLogToiOS('info', '[FORCE REGISTER] WebKit 핸들러 강제 등록 시도');
    
    const webkit = (window as any).webkit;
    if (!webkit) {
      console.error('🔧 [FORCE REGISTER] WebKit 없음');
      return false;
    }
    
    try {
      // messageHandlers가 없으면 강제로 생성 시도
      if (!webkit.messageHandlers) {
        console.log('🔧 [FORCE REGISTER] messageHandlers 없음, 강제 생성 시도');
        webkit.messageHandlers = {};
        sendLogToiOS('info', '[FORCE REGISTER] messageHandlers 객체 생성');
      }
      
      // smapIos 핸들러가 없으면 가짜 핸들러 등록
      if (!webkit.messageHandlers.smapIos) {
        console.log('🔧 [FORCE REGISTER] smapIos 핸들러 없음, 가짜 핸들러 등록');
        webkit.messageHandlers.smapIos = {
          postMessage: function(message: any) {
            console.log('🔧 [FAKE HANDLER] 가짜 핸들러 메시지 수신:', message);
            sendLogToiOS('info', '[FAKE HANDLER] 메시지 수신', message);
            
            // window 이벤트로 네이티브에 알림
            window.dispatchEvent(new CustomEvent('smap-haptic-message', { 
              detail: message 
            }));
          }
        };
        sendLogToiOS('info', '[FORCE REGISTER] 가짜 smapIos 핸들러 등록 완료');
        
        // 등록 후 즉시 테스트
        webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: 'success',
          source: 'force-register-test'
        });
        
        return true;
      }
      
      console.log('🔧 [FORCE REGISTER] smapIos 핸들러 이미 존재');
      return true;
      
    } catch (error) {
      console.error('🔧 [FORCE REGISTER] 강제 등록 실패:', error);
      sendLogToiOS('error', '[FORCE REGISTER] 강제 등록 실패', { error: String(error) });
      return false;
    }
  };

  // 🚨 긴급 햅틱 테스트 (모든 가능한 방법 동시 시도)
  const emergencyHapticTest = () => {
    console.log('🚨 [EMERGENCY HAPTIC] 긴급 햅틱 테스트 시작');
    sendLogToiOS('warning', '[EMERGENCY HAPTIC] 긴급 햅틱 테스트 시작');
    
    const webkit = (window as any).webkit;
    const allResults = [];
    
    // 1. 모든 가능한 핸들러에 메시지 전송
    if (webkit?.messageHandlers) {
      const handlerNames = ['smapIos', 'iosHandler', 'jsToNative', 'webViewHandler', 'nativeHandler'];
      
      handlerNames.forEach(handlerName => {
        if (webkit.messageHandlers[handlerName]) {
          try {
            webkit.messageHandlers[handlerName].postMessage({
              type: 'haptic',
              param: 'heavy',
              emergency: true,
              source: 'emergency-test'
            });
            console.log(`🚨 [EMERGENCY] ${handlerName} 메시지 전송 성공`);
            sendLogToiOS('info', `[EMERGENCY] ${handlerName} 성공`);
            allResults.push(`${handlerName}: 성공`);
          } catch (e) {
            console.error(`🚨 [EMERGENCY] ${handlerName} 실패:`, e);
            sendLogToiOS('error', `[EMERGENCY] ${handlerName} 실패`, { error: String(e) });
            allResults.push(`${handlerName}: 실패`);
          }
        }
      });
    }
    
    // 2. window 이벤트 발생
    try {
      window.dispatchEvent(new CustomEvent('smap-emergency-haptic', { 
        detail: { type: 'heavy', source: 'emergency-test' } 
      }));
      console.log('🚨 [EMERGENCY] window 이벤트 발생');
      sendLogToiOS('info', '[EMERGENCY] window 이벤트 발생');
      allResults.push('window 이벤트: 성공');
    } catch (e) {
      console.error('🚨 [EMERGENCY] window 이벤트 실패:', e);
      allResults.push('window 이벤트: 실패');
    }
    
    // 3. 글로벌 함수 시도
    const globalFunctions = ['SMAP_FORCE_HAPTIC', 'iosHaptic', 'triggerHaptic', 'nativeHaptic'];
    globalFunctions.forEach(funcName => {
      try {
        if (typeof (window as any)[funcName] === 'function') {
          (window as any)[funcName]('heavy');
          console.log(`🚨 [EMERGENCY] ${funcName} 함수 호출 성공`);
          sendLogToiOS('info', `[EMERGENCY] ${funcName} 함수 성공`);
          allResults.push(`${funcName}: 성공`);
        }
      } catch (e) {
        console.error(`🚨 [EMERGENCY] ${funcName} 함수 실패:`, e);
        allResults.push(`${funcName}: 실패`);
      }
    });
    
    // 결과 요약
    console.log('🚨 [EMERGENCY] 테스트 결과:', allResults);
    sendLogToiOS('info', '[EMERGENCY] 테스트 완료', { results: allResults });
  };

  // iOS WebView fetch 폴리필 추가
  useEffect(() => {
    // iOS WebView에서만 fetch 폴리필 적용
    const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    
    if (isIOSWebView && typeof window !== 'undefined') {
      console.log('[SIGNIN] iOS WebView 환경 감지, fetch 폴리필 적용');
      
      // 원본 fetch 저장
      const originalFetch = window.fetch;
      
      // iOS WebView용 fetch 대체 함수
      window.fetch = function(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const method = options.method || 'GET';
          const urlString = url.toString();
          
          xhr.open(method, urlString, true);
          
          // 헤더 설정
          if (options.headers) {
            const headers = options.headers as Record<string, string>;
            Object.keys(headers).forEach(key => {
              xhr.setRequestHeader(key, headers[key]);
            });
          }
          
          // Content-Type 기본값 설정
          if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            if (!xhr.getResponseHeader('Content-Type')) {
              xhr.setRequestHeader('Content-Type', 'application/json');
            }
          }
          
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              // Response 객체와 유사한 구조 생성
                             const response = {
                 ok: xhr.status >= 200 && xhr.status < 300,
                 status: xhr.status,
                 statusText: xhr.statusText,
                 headers: new Map(),
                 redirected: false,
                 type: 'basic' as ResponseType,
                 url: urlString,
                 clone: () => response,
                 body: null,
                 bodyUsed: false,
                 json: async () => {
                   try {
                     return JSON.parse(xhr.responseText);
                   } catch (e) {
                     throw new Error('Failed to parse JSON response');
                   }
                 },
                 text: async () => xhr.responseText,
                 arrayBuffer: async () => {
                   const encoder = new TextEncoder();
                   return encoder.encode(xhr.responseText).buffer;
                 },
                 blob: async () => new Blob([xhr.responseText]),
                 formData: async () => new FormData()
               } as unknown as Response;
              
              resolve(response);
            }
          };
          
          xhr.onerror = function() {
            reject(new Error('Network request failed'));
          };
          
          xhr.ontimeout = function() {
            reject(new Error('Request timeout'));
          };
          
          xhr.timeout = 30000; // 30초 타임아웃
          
          // 요청 본문 처리
          let body = null;
          if (options.body) {
            if (typeof options.body === 'string') {
              body = options.body;
            } else if (options.body instanceof FormData) {
              body = options.body;
            } else {
              body = JSON.stringify(options.body);
            }
          }
          
          xhr.send(body);
        });
      };
      
      console.log('[SIGNIN] iOS WebView fetch 폴리필 적용 완료');
      
      // 컴포넌트 언마운트 시 원본 fetch 복원
      return () => {
        if (originalFetch) {
          window.fetch = originalFetch;
          console.log('[SIGNIN] 원본 fetch 복원 완료');
        }
      };
    }
  }, []);

  return (
    <motion.div 
      className="min-h-screen flex flex-col items-center justify-center py-6 px-4 sm:px-6 lg:px-8"
      style={{background: 'linear-gradient(to bottom right, #eff6ff, #faf5ff, #fdf2f8)'}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 0.6
      }}
    >
      <motion.div 
        className="max-w-md w-full space-y-6 bg-white p-6 sm:p-8 rounded-xl shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 25,
          delay: 0.1,
          duration: 0.5
        }}
      >
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.2,
            duration: 0.4
          }}
        >
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            SMAP 로그인
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            계정에 로그인하여 서비스를 이용하세요.
          </p>
        </motion.div>

        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.3,
            duration: 0.4
          }}
        >
          {/* 전화번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 flex items-center z-10 pointer-events-none">
                <FiPhone className={`w-4 h-4 transition-colors duration-200 ${
                  focusedField === 'phone' || phoneNumber ? '' : 'text-gray-400'
                }`} 
                style={focusedField === 'phone' || phoneNumber ? {color: '#0113A3'} : {}} />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                onFocus={(e) => {
                  setFocusedField('phone');
                  if (!formErrors.phoneNumber) {
                    e.target.style.boxShadow = '0 0 0 2px #0113A3';
                  }
                }}
                onBlur={(e) => {
                  setFocusedField(null);
                  if (!formErrors.phoneNumber) {
                    e.target.style.boxShadow = '';
                  }
                }}
                placeholder="010-1234-5678"
                maxLength={13}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${
                  formErrors.phoneNumber 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200'
                }`}
                style={{ outline: 'none' }}
              />
            </div>
            {formErrors.phoneNumber && (
              <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>{formErrors.phoneNumber}</p>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 flex items-center z-10 pointer-events-none">
                <FiLock className={`w-4 h-4 transition-colors duration-200 ${
                  focusedField === 'password' || password ? '' : 'text-gray-400'
                }`} 
                style={focusedField === 'password' || password ? {color: '#0113A3'} : {}} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => {
                  setFocusedField('password');
                  if (!formErrors.password) {
                    e.target.style.boxShadow = '0 0 0 2px #0113A3';
                  }
                }}
                onBlur={(e) => {
                  setFocusedField(null);
                  if (!formErrors.password) {
                    e.target.style.boxShadow = '';
                  }
                }}
                placeholder="비밀번호를 입력해주세요"
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${
                  formErrors.password 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200'
                }`}
                style={{ outline: 'none' }}
              />
            </div>
            {formErrors.password && (
              <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>{formErrors.password}</p>
            )}
          </div>
        </motion.div>

        {/* 로그인 버튼 */}
        <motion.form 
          onSubmit={handlePhoneNumberLogin}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.4,
            duration: 0.4
          }}
        >
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95 shadow-md"
            style={{backgroundColor: '#0113A3'}}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#001f87'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0113A3'}
            onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3, 0 0 0 4px rgba(1, 19, 163, 0.1)'}
            onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
          >
            {isLoading ? (
              <LoadingSpinner message="로그인 중..." fullScreen={false} />
            ) : (
              '전화번호로 로그인'
            )}
          </button>
        </motion.form>

        <motion.div 
          className="mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.5,
            duration: 0.4
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">
                또는 다음으로 계속
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {/* Google 로그인 버튼 */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  console.log('🔥 [GOOGLE LOGIN] 버튼 클릭됨!');
                  sendLogToiOS('info', '🔥 Google 로그인 버튼 클릭됨', {
                    timestamp: new Date().toISOString(),
                    event: 'button_click',
                    isLoading: isLoading,
                    buttonDisabled: isLoading
                  });
                  
                  // 햅틱 피드백 (버튼 클릭 시)
                  triggerHapticFeedback(HapticFeedbackType.LIGHT, 'Google 로그인 버튼 클릭', { 
                    component: 'signin', 
                    action: 'google-login-button-click' 
                  });
                  
                  // 실제 핸들러 호출
                  handleGoogleLogin();
                }}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
                onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3'}
                onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
              >
                <FcGoogle className="w-5 h-5 mr-3" aria-hidden="true" />
                Google 계정으로 로그인
              </button>
              
              {/* iOS WebView 안내 메시지 */}
              {/* {typeof window !== 'undefined' && (window as any).webkit && (window as any).webkit.messageHandlers && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start">
                    <FiAlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      앱 내에서 구글 로그인이 제한될 수 있습니다. 
                      <br />
                      문제 발생 시 Safari 브라우저에서 시도해주세요.
                    </p>
                  </div>
                </div>
              )} */}
            </div>

            {/* Kakao 로그인 버튼 */}
            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-[#FEE500] hover:bg-[#F0D900] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
            >
              <RiKakaoTalkFill className="w-5 h-5 mr-3" aria-hidden="true" />
              Kakao 계정으로 로그인
            </button>
          </div>
        </motion.div>

        {/* 회원가입 링크 */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.6,
            duration: 0.4
          }}
        >
          <p className="text-sm text-gray-600">
            아직 계정이 없으신가요?{' '}
            <Link href="/register" className="font-medium transition-colors"
              style={{color: '#0113A3'}}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1e40af'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#0113A3'}>
              회원가입
            </Link>
          </p>
        </motion.div>
      </motion.div>

      {/* 에러 모달 - 전역 플래그와 관계없이 항상 렌더링 */}
      {(() => {
        // 전역 플래그가 있을 때는 강제로 에러 모달 표시
        const globalErrorFlag = (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__;
        const globalErrorMessage = (window as any).__SIGNIN_ERROR_MESSAGE__;
        const shouldShowModal = showErrorModal || globalErrorFlag;
        const displayMessage = errorModalMessage || globalErrorMessage || '로그인 중 오류가 발생했습니다.';
        
        console.log('[SIGNIN] 에러 모달 렌더링 체크:', {
          showErrorModal,
          errorModalMessage,
          isLoading,
          globalErrorFlag,
          globalErrorMessage,
          shouldShowModal,
          displayMessage
        });
        
                  return (
            <AlertModal
              isOpen={shouldShowModal}
              onClose={closeErrorModal}
              message="로그인 실패"
              description={displayMessage}
              buttonText="확인"
              type="error"
            />
          );
      })()}

      {/* 전체 화면 로딩 스피너 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg">
            <IOSCompatibleSpinner size="md" message="처리 중..." />
          </div>
        </div>
      )}
    </motion.div>
  );
}