// frontend/src/app/signin/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiLock, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import AlertModal from '@/components/ui/AlertModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { comprehensivePreloadData } from '@/services/dataPreloadService';
// 카카오 관련 import 제거
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';
import SplashScreen from '@/components/common/SplashScreen';
import groupService from '@/services/groupService';


// 카카오 SDK 타입 정의
declare global {
  interface Window {
    // 카카오 관련 인터페이스 제거
  }
}

// 햅틱 피드백 타입 정의
enum HapticFeedbackType {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

const SignInPage = () => {
  const router = useRouter();

  // 플랫폼 감지 (컴포넌트 상단에 정의)
  const isAndroid = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android/.test(navigator.userAgent);
  }, []);

  // iOS 로거 함수 (컴포넌트 내부로 이동)
  const iosLogger = {
    info: (message: string, data?: any) => {
      console.log(`[iOS LOG] ${message}`, data);
    },
    error: (message: string, error?: any) => {
      console.error(`[iOS LOG] ${message}`, error);
    },
    warn: (message: string, data?: any) => {
      console.warn(`[iOS LOG] ${message}`, data);
    },
    logGoogleLogin: (message: string, data?: any) => {
      console.log(`[iOS LOG] [GOOGLE LOGIN] ${message}`, data);
    }
  };

  // 햅틱 피드백 함수 (컴포넌트 내부로 이동)
  const triggerHapticFeedback = (type: HapticFeedbackType) => {
    console.log('🎮 [HAPTIC] 햅틱 피드백 호출:', type);
    try {
      // iOS 네이티브 햅틱 시도
      if ((window as any).webkit?.messageHandlers?.smapIos) {
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: type
        });
        console.log('🎮 [HAPTIC] iOS 네이티브 햅틱 전송 완료');
        return;
      }
    } catch (error) {
      console.log('🎮 [HAPTIC] iOS 네이티브 햅틱 실패:', error);
      // 개발 환경에서는 조용히 처리
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎮 [HAPTIC] ${type} 햅틱 피드백 (개발 환경)`);
      }
    }

    // 웹 환경에서는 vibrate API 사용
    if (window.navigator && window.navigator.vibrate) {
      const patterns = {
        [HapticFeedbackType.LIGHT]: [10],
        [HapticFeedbackType.MEDIUM]: [20],
        [HapticFeedbackType.HEAVY]: [30],
        [HapticFeedbackType.SUCCESS]: [50, 100, 50],
        [HapticFeedbackType.WARNING]: [100, 50, 100],
        [HapticFeedbackType.ERROR]: [200, 100, 200]
      };
      window.navigator.vibrate(patterns[type]);
      console.log('🎮 [HAPTIC] 웹 vibrate API 사용');
    }
  };

  // 🚨 페이지 로드 디버깅
  console.log('[SIGNIN PAGE] 컴포넌트 로딩 시작', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

  // 🚨 강력한 리다이렉트 차단 시스템 초기화
  useEffect(() => {
    console.log('[REDIRECT BLOCK] 강력한 리다이렉트 차단 시스템 초기화');

    // 전역 리다이렉트 차단 플래그 설정
    (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = false;
    (window as any).__BLOCK_ALL_REDIRECTS__ = false;

    // 리다이렉트 플래그 처리 (NavigationManager에서 설정된 경우)
    if ((window as any).__REDIRECT_TO_SIGNIN__) {
      console.log('[REDIRECT BLOCK] NavigationManager 리다이렉트 플래그 감지 - 이미 signin 페이지에 있으므로 무시');
      delete (window as any).__REDIRECT_TO_SIGNIN__;
      delete (window as any).__REDIRECT_TIMESTAMP__;
    }

    if ((window as any).__REDIRECT_TO_HOME__) {
      console.log('[REDIRECT BLOCK] NavigationManager 홈 리다이렉트 플래그 감지 - 처리');
      delete (window as any).__REDIRECT_TO_HOME__;
      delete (window as any).__REDIRECT_TIMESTAMP__;
      // 홈으로 리다이렉트 (Next.js 라우터 사용)
      router.replace('/home');
    }

    // sessionStorage에서 상태 복원 (처음 방문 시에는 복원하지 않음)
    const savedModalState = sessionStorage.getItem('signin_error_modal_active');
    const savedRedirectBlock = sessionStorage.getItem('block_all_redirects');
    const savedPhoneNumber = sessionStorage.getItem('signin_phone_number');
    const savedErrorMessage = sessionStorage.getItem('signin_error_message');

    // 페이지가 처음 로드되었는지 확인 (document.referrer가 비어있거나 같은 페이지인 경우)
    const isFirstVisit = !document.referrer || document.referrer.includes(window.location.origin + '/signin');

    if (savedModalState === 'true' && !isFirstVisit) {
      console.log('[REDIRECT BLOCK] sessionStorage에서 모달 상태 복원');
      (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
      (window as any).__BLOCK_ALL_REDIRECTS__ = true;

      // 에러 모달 상태 복원
      if (savedErrorMessage) {
        setErrorModalMessage(savedErrorMessage);
        setShowErrorModal(true);
        console.log('[REDIRECT BLOCK] 에러 모달 상태 복원:', savedErrorMessage);
      }
    } else if (isFirstVisit) {
      console.log('[REDIRECT BLOCK] 처음 방문이므로 에러 모달 상태 복원하지 않음');
      // 처음 방문 시 sessionStorage 정리
      sessionStorage.removeItem('signin_error_modal_active');
      sessionStorage.removeItem('signin_error_message');
    }

    if (savedRedirectBlock === 'true') {
      console.log('[REDIRECT BLOCK] sessionStorage에서 리다이렉트 차단 상태 복원');
      (window as any).__BLOCK_ALL_REDIRECTS__ = true;
    }

    // 전화번호 복원
    if (savedPhoneNumber) {
      console.log('[REDIRECT BLOCK] sessionStorage에서 전화번호 복원:', savedPhoneNumber);
      setPhoneNumber(savedPhoneNumber);

      // DOM에서도 복원
      setTimeout(() => {
        const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
        if (phoneInput && !phoneInput.value) {
          phoneInput.value = savedPhoneNumber;
          console.log('[REDIRECT BLOCK] DOM 전화번호 입력 필드 복원:', savedPhoneNumber);
        }
      }, 100);
    }

    // window.location 오버라이드
    const originalReplace = window.location.replace;
    const originalAssign = window.location.assign;

    if (!(window as any).__LOCATION_OVERRIDDEN__) {
      console.log('[REDIRECT BLOCK] window.location 오버라이드 시작');

      // href setter 오버라이드 (안전한 방법)
      try {
        const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');

        if (originalHref && originalHref.configurable) {
          Object.defineProperty(window.location, 'href', {
            set: function (value) {
              console.log('[REDIRECT BLOCK] window.location.href 변경 시도:', value);
              console.log('[REDIRECT BLOCK] 현재 차단 상태:', (window as any).__BLOCK_ALL_REDIRECTS__);

              if ((window as any).__BLOCK_ALL_REDIRECTS__) {
                console.log('[REDIRECT BLOCK] 리다이렉트 차단됨:', value);
                return;
              }

              if (originalHref && originalHref.set) {
                originalHref.set.call(this, value);
              }
            },
            get: function () {
              return originalHref ? originalHref.get?.call(this) : '';
            },
            configurable: true
          });
        } else {
          console.log('[REDIRECT BLOCK] href 속성이 configurable하지 않음, 다른 방법 사용');
        }
      } catch (error) {
        console.log('[REDIRECT BLOCK] href 속성 오버라이드 실패, 다른 방법 사용:', error);
      }

      // replace 메서드 오버라이드
      try {
        window.location.replace = function (url: string) {
          console.log('[REDIRECT BLOCK] window.location.replace 시도:', url);
          console.log('[REDIRECT BLOCK] 현재 차단 상태:', (window as any).__BLOCK_ALL_REDIRECTS__);

          if ((window as any).__BLOCK_ALL_REDIRECTS__) {
            console.log('[REDIRECT BLOCK] replace 차단됨:', url);
            return;
          }

          return originalReplace.call(this, url);
        };
      } catch (error) {
        console.log('[REDIRECT BLOCK] replace 메서드 오버라이드 실패:', error);
      }

      // assign 메서드 오버라이드
      try {
        window.location.assign = function (url: string) {
          console.log('[REDIRECT BLOCK] window.location.assign 시도:', url);
          console.log('[REDIRECT BLOCK] 현재 차단 상태:', (window as any).__BLOCK_ALL_REDIRECTS__);

          if ((window as any).__BLOCK_ALL_REDIRECTS__) {
            console.log('[REDIRECT BLOCK] assign 차단됨:', url);
            return;
          }

          return originalAssign.call(this, url);
        };
      } catch (error) {
        console.log('[REDIRECT BLOCK] assign 메서드 오버라이드 실패:', error);
      }

      // 대안적인 리다이렉트 차단 방법
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      try {
        window.history.pushState = function (state: any, title: string, url?: string) {
          console.log('[REDIRECT BLOCK] history.pushState 시도:', url);
          console.log('[REDIRECT BLOCK] 현재 차단 상태:', (window as any).__BLOCK_ALL_REDIRECTS__);

          if ((window as any).__BLOCK_ALL_REDIRECTS__ && url && url !== window.location.href) {
            console.log('[REDIRECT BLOCK] pushState 차단됨:', url);
            return;
          }

          return originalPushState.call(this, state, title, url);
        };

        window.history.replaceState = function (state: any, title: string, url?: string) {
          console.log('[REDIRECT BLOCK] history.replaceState 시도:', url);
          console.log('[REDIRECT BLOCK] 현재 차단 상태:', (window as any).__BLOCK_ALL_REDIRECTS__);

          if ((window as any).__BLOCK_ALL_REDIRECTS__ && url && url !== window.location.href) {
            console.log('[REDIRECT BLOCK] replaceState 차단됨:', url);
            return;
          }

          return originalReplaceState.call(this, state, title, url);
        };
      } catch (error) {
        console.log('[REDIRECT BLOCK] history 메서드 오버라이드 실패:', error);
      }

      (window as any).__LOCATION_OVERRIDDEN__ = true;
      console.log('[REDIRECT BLOCK] window.location 오버라이드 완료');
    }

    // 전역 함수 등록
    (window as any).__REDIRECT_CONTROL__ = {
      blockRedirects: () => {
        console.log('[REDIRECT BLOCK] 리다이렉트 차단 활성화');
        (window as any).__BLOCK_ALL_REDIRECTS__ = true;
        sessionStorage.setItem('block_all_redirects', 'true');

        // 추가적인 보호 장치
        window.addEventListener('beforeunload', (e) => {
          if ((window as any).__BLOCK_ALL_REDIRECTS__) {
            e.preventDefault();
            e.returnValue = '';
            return '';
          }
        });
      },
      allowRedirects: () => {
        console.log('[REDIRECT BLOCK] 리다이렉트 차단 해제');
        (window as any).__BLOCK_ALL_REDIRECTS__ = false;
        sessionStorage.removeItem('block_all_redirects');
      },
      getStatus: () => {
        return {
          modalActive: (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__,
          redirectBlocked: (window as any).__BLOCK_ALL_REDIRECTS__,
          locationOverridden: (window as any).__LOCATION_OVERRIDDEN__
        };
      },
      forceBlock: () => {
        console.log('[REDIRECT BLOCK] 강제 리다이렉트 차단');
        (window as any).__BLOCK_ALL_REDIRECTS__ = true;
        sessionStorage.setItem('block_all_redirects', 'true');

        // 모든 리다이렉트 시도 차단
        const blockAllRedirects = () => {
          if ((window as any).__BLOCK_ALL_REDIRECTS__) {
            console.log('[REDIRECT BLOCK] 강제 차단 - 모든 리다이렉트 시도 무시');
            return false;
          }
        };

        // 이벤트 리스너 추가
        window.addEventListener('beforeunload', blockAllRedirects);
        window.addEventListener('popstate', blockAllRedirects);

        // 안전한 리다이렉트 차단
        try {
          const originalReplace = window.location.replace;
          const originalAssign = window.location.assign;

          window.location.replace = function (url: string) {
            if ((window as any).__BLOCK_ALL_REDIRECTS__) {
              console.log('[REDIRECT BLOCK] 강제 차단 - replace 차단됨:', url);
              return;
            }
            return originalReplace.call(this, url);
          };

          window.location.assign = function (url: string) {
            if ((window as any).__BLOCK_ALL_REDIRECTS__) {
              console.log('[REDIRECT BLOCK] 강제 차단 - assign 차단됨:', url);
              return;
            }
            return originalAssign.call(this, url);
          };
        } catch (error) {
          console.log('[REDIRECT BLOCK] 강제 차단 설정 실패:', error);
        }
      }
    };

    console.log('[REDIRECT BLOCK] 전역 제어 함수 등록 완료');
    console.log('[REDIRECT BLOCK] 현재 상태:', (window as any).__REDIRECT_CONTROL__.getStatus());
  }, []);

  // 🚨 사파리 시뮬레이터 디버깅을 위한 강제 로그
  useEffect(() => {
    // 즉시 실행되는 강제 로그
    console.log('🔍 [SAFARI DEBUG] 사파리 시뮬레이터 디버깅 시작');
    console.log('🔍 [SAFARI DEBUG] User Agent:', navigator.userAgent);
    console.log('🔍 [SAFARI DEBUG] 현재 URL:', window.location.href);
    console.log('🔍 [SAFARI DEBUG] 개발 환경:', process.env.NODE_ENV);
    console.log('🔍 [SAFARI DEBUG] window 객체 존재:', typeof window !== 'undefined');
    console.log('🔍 [SAFARI DEBUG] document 객체 존재:', typeof document !== 'undefined');

    // 사파리 시뮬레이터 감지
    const isSafariSimulator = /iPhone Simulator|iPad Simulator|Simulator/.test(navigator.userAgent);
    console.log('🔍 [SAFARI DEBUG] 사파리 시뮬레이터 감지:', isSafariSimulator);

    // WebKit 객체 확인
    const hasWebKit = !!(window as any).webkit;
    const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;
    console.log('🔍 [SAFARI DEBUG] WebKit 객체:', hasWebKit);
    console.log('🔍 [SAFARI DEBUG] MessageHandlers:', hasMessageHandlers);

    // 🚨 사파리 시뮬레이터에서 확실히 보이도록 alert 추가
    if (isSafariSimulator) {
      alert('🔍 사파리 시뮬레이터에서 페이지가 로드되었습니다!');
    }

    // 🚨 DOM에 디버그 정보 표시 (시각적으로 확인 가능)
    // const debugDiv = document.createElement('div');
    // debugDiv.id = 'safari-debug-info';
    // debugDiv.style.cssText = `
    //   position: fixed;
    //   top: 10px;
    //   right: 10px;
    //   background: rgba(0, 0, 0, 0.8);
    //   color: white;
    //   padding: 10px;
    //   border-radius: 5px;
    //   font-size: 12px;
    //   z-index: 9999;
    //   max-width: 300px;
    //   word-break: break-all;
    // `;
    // debugDiv.innerHTML = `
    //   <div><strong>🔍 Safari Debug Info</strong></div>
    //   <div>User Agent: ${navigator.userAgent.substring(0, 50)}...</div>
    //   <div>URL: ${window.location.href}</div>
    //   <div>WebKit: ${hasWebKit ? '✅' : '❌'}</div>
    //   <div>MessageHandlers: ${hasMessageHandlers ? '✅' : '❌'}</div>
    //   <div>Time: ${new Date().toLocaleTimeString()}</div>
    //   <div style="margin-top: 5px;">
    //     <button onclick="window.__SAFARI_DEBUG__.test()" style="margin-right: 5px; padding: 2px 5px;">Test</button>
    //     <button onclick="window.__SAFARI_DEBUG__.checkEnvironment()" style="padding: 2px 5px;">Check</button>
    //   </div>
    // `;
    // document.body.appendChild(debugDiv);

    // 전역 함수 등록 (사파리 콘솔에서 직접 호출 가능)
    (window as any).__SAFARI_DEBUG__ = {
      test: () => {
        console.log('🧪 [SAFARI DEBUG] 테스트 함수 호출됨');
        alert('사파리 시뮬레이터에서 테스트 함수가 호출되었습니다!');
      },
      checkEnvironment: () => {
        console.log('🔍 [SAFARI DEBUG] 환경 체크:', {
          userAgent: navigator.userAgent,
          url: window.location.href,
          hasWebKit: !!(window as any).webkit,
          hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
          timestamp: new Date().toISOString()
        });
        alert('환경 체크 완료! 콘솔을 확인하세요.');
      },
      forceLog: (message: string) => {
        console.log('📝 [SAFARI DEBUG] 강제 로그:', message);
        alert(`강제 로그: ${message}`);
      },
      removeDebugDiv: () => {
        const div = document.getElementById('safari-debug-info');
        if (div) {
          div.remove();
          console.log('🔍 [SAFARI DEBUG] 디버그 div 제거됨');
        }
      }
    };

    console.log('✅ [SAFARI DEBUG] 전역 디버그 함수 등록 완료');
    console.log('✅ [SAFARI DEBUG] 사파리 콘솔에서 다음 함수들을 사용할 수 있습니다:');
    console.log('   - window.__SAFARI_DEBUG__.test()');
    console.log('   - window.__SAFARI_DEBUG__.checkEnvironment()');
    console.log('   - window.__SAFARI_DEBUG__.forceLog("메시지")');
    console.log('   - window.__SAFARI_DEBUG__.removeDebugDiv()');

    // 3초 후 자동 체크
    setTimeout(() => {
      console.log('⏰ [SAFARI DEBUG] 3초 후 자동 체크 실행');
      console.log('⏰ [SAFARI DEBUG] 현재 페이지 상태:', {
        title: document.title,
        readyState: document.readyState,
        bodyChildren: document.body?.children?.length || 0
      });

      // 디버그 div 업데이트
      const debugDiv = document.getElementById('safari-debug-info');
      if (debugDiv) {
        debugDiv.innerHTML = `
          <div><strong>🔍 Safari Debug Info (Updated)</strong></div>
          <div>Title: ${document.title}</div>
          <div>Ready State: ${document.readyState}</div>
          <div>Body Children: ${document.body?.children?.length || 0}</div>
          <div>Time: ${new Date().toLocaleTimeString()}</div>
          <div style="margin-top: 5px;">
            <button onclick="window.__SAFARI_DEBUG__.test()" style="margin-right: 5px; padding: 2px 5px;">Test</button>
            <button onclick="window.__SAFARI_DEBUG__.checkEnvironment()" style="margin-right: 5px; padding: 2px 5px;">Check</button>
            <button onclick="window.__SAFARI_DEBUG__.removeDebugDiv()" style="padding: 2px 5px;">Remove</button>
          </div>
        `;
      }
    }, 3000);

  }, []);

  // 🚨 모바일 웹앱 고정 스타일 적용
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // body 스크롤 방지 (임시 주석 처리)
      // document.body.style.overflow = 'hidden';
      // document.body.style.position = 'fixed';
      // document.body.style.width = '100%';
      // document.body.style.height = '100%';
      // document.documentElement.style.overflow = 'hidden';

      // 뒤로가기 방지
      const preventBack = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };

      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', preventBack);

      return () => {
        // 정리 (임시 주석 처리)
        // document.body.style.overflow = '';
        // document.body.style.position = '';
        // document.body.style.width = '';
        // document.body.style.height = '';
        // document.documentElement.style.overflow = '';
        window.removeEventListener('popstate', preventBack);
      };
    }
  }, []);

  // 🚨 페이지 초기화 및 에러 모달 상태 복원
  useEffect(() => {
    // 안전하게 window 객체 확인
    if (typeof window === 'undefined') {
      console.log('[INIT] 서버사이드에서 실행됨, 스킵');
      return;
    }

    console.log('[INIT] 클라이언트사이드 초기화 시작');

    // 카카오 관련 스크립트 로드 제거

    // 에러 모달 상태 복원
    try {
      const savedErrorFlag = sessionStorage.getItem('__SIGNIN_ERROR_MODAL_ACTIVE__') === 'true';
      const savedRedirectBlock = sessionStorage.getItem('__BLOCK_ALL_REDIRECTS__') === 'true';

      // 처음 방문 시에는 에러 모달 복원하지 않음
      const isFirstVisit = !document.referrer || document.referrer.includes(window.location.origin + '/signin');

      if ((savedErrorFlag || savedRedirectBlock) && !isFirstVisit) {
        console.log('[SIGNIN] 🔄 페이지 로드 시 브라우저 저장소에서 에러 모달 상태 복원');

        const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
        (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
        (window as any).__SIGNIN_ERROR_MESSAGE__ = savedErrorMessage;
        (window as any).__BLOCK_ALL_REDIRECTS__ = true; // 리다이렉트 차단 복원

        setShowErrorModal(true);
        if (savedErrorMessage) {
          setErrorModalMessage(savedErrorMessage);
        }
      } else if (isFirstVisit) {
        console.log('[SIGNIN] 처음 방문이므로 에러 모달 상태 복원하지 않음');
        // 처음 방문 시 sessionStorage 정리
        sessionStorage.removeItem('__SIGNIN_ERROR_MODAL_ACTIVE__');
        sessionStorage.removeItem('__SIGNIN_ERROR_MESSAGE__');
        sessionStorage.removeItem('__BLOCK_ALL_REDIRECTS__');
      }
    } catch (error) {
      console.warn('[SIGNIN] sessionStorage 접근 실패:', error);
    }

    // 카카오 콜백 함수 등록 제거

    console.log('✅ [INIT] 초기화 완료');
  }, []);

  // 카카오 로그인 함수 제거

  // 🚨 페이지 로드 즉시 브라우저 저장소에서 에러 모달 상태 확인 및 복원
  const [showErrorModal, setShowErrorModal] = useState(false);

  const [errorModalMessage, setErrorModalMessage] = useState('');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // 로그아웃 후 스플래시 화면 표시 로직
  useEffect(() => {
    const showSplashOnLogout = localStorage.getItem('show_splash_on_logout');
    if (showSplashOnLogout === 'true') {
      console.log('[SIGNIN] 로그아웃 후 스플래시 화면 표시');
      setShowSplash(true);
      // 플래그 제거
      localStorage.removeItem('show_splash_on_logout');
    }
  }, []);
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
      setError: () => { },
      refreshAuthState: () => Promise.resolve()
    };
  }
  const { login, isLoggedIn, loading, error, setError, refreshAuthState } = authContextData;

  // 🆕 DataCache 접근
  let dataCacheContextData;
  try {
    dataCacheContextData = useDataCache();
  } catch (error) {
    console.error('[SIGNIN] useDataCache 컨텍스트 오류:', error);
    dataCacheContextData = {
      saveComprehensiveData: () => { },
      saveToLocalStorage: () => { },
      loadFromLocalStorage: () => null
    };
  }
  const { saveComprehensiveData } = dataCacheContextData;

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

  // 🔄 앱 시작 시 자동 로그인 확인 (최우선)
  useEffect(() => {
    const checkAutoLogin = async () => {
      try {
        console.log('🔍 [SIGNIN AUTO-LOGIN] 자동 로그인 확인 시작');

        // 로컬 스토리지에서 사용자 데이터 확인
        const possibleUserKeys = [
          'smap_user_data',
          'user',
          'userData',
          'user_data',
          'smap_user_profile'
        ];

        let savedUserData = null;
        for (const key of possibleUserKeys) {
          try {
            const data = localStorage.getItem(key);
            if (data && data !== 'null') {
              const parsedData = JSON.parse(data);
              if (parsedData?.mt_idx) {
                savedUserData = parsedData;
                console.log(`[SIGNIN AUTO-LOGIN] 로컬 스토리지에서 사용자 데이터 발견 (키: ${key}):`, parsedData.mt_name);
                break;
              }
            }
          } catch (e) {
            console.warn(`[SIGNIN AUTO-LOGIN] 사용자 데이터 파싱 실패 (키: ${key}):`, e);
          }
        }

        if (savedUserData?.mt_idx) {
          console.log('[SIGNIN AUTO-LOGIN] 🚀 자동 로그인 가능 - 홈페이지로 리다이렉트');

          // AuthService에 사용자 데이터 설정
          import('@/services/authService').then(({ default: authService }) => {
            authService.setUserData(savedUserData);

            // 표준화된 키로 데이터 저장
            localStorage.setItem('smap_user_data', JSON.stringify(savedUserData));
            localStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('authToken', 'authenticated');

            // 홈페이지로 리다이렉트
            router.replace('/home');
          }).catch(error => {
            console.error('[SIGNIN AUTO-LOGIN] AuthService import 실패:', error);
          });
          return;
        } else {
          console.log('[SIGNIN AUTO-LOGIN] 자동 로그인 불가 - 로그인 페이지 유지');
        }
      } catch (error) {
        console.error('[SIGNIN AUTO-LOGIN] 자동 로그인 확인 실패:', error);
      }
    };

    checkAutoLogin();
  }, [router]);

  // 🔍 핸들러 모니터링 useEffect (두 번째 우선순위)
  useEffect(() => {
    console.log('🔍 [HANDLER MONITOR] 핸들러 모니터링 시작');

    // 🌐 전역 테스트 함수들 등록
    (window as any).__SMAP_FORCE_CREATE_HANDLERS__ = forceCreateMessageHandlers;
    (window as any).__SMAP_CHECK_HANDLERS__ = forceCheckHandlers;
    (window as any).__SMAP_EMERGENCY_GOOGLE_LOGIN__ = () => {
      console.log('🚨 [EMERGENCY] 응급 구글 로그인 실행');
      handleGoogleSDKLogin();
    };

    // 카카오 SDK 확인 함수 제거

    console.log('🌐 [GLOBAL] 전역 테스트 함수들 등록 완료:');
    console.log('   - window.__SMAP_FORCE_CREATE_HANDLERS__()');
    console.log('   - window.__SMAP_CHECK_HANDLERS__()');
    console.log('   - window.__SMAP_EMERGENCY_GOOGLE_LOGIN__()');
    console.log('   - 카카오 관련 함수 제거됨');
    console.log('🌐 [GLOBAL] Safari 콘솔에서 위 함수들을 직접 호출할 수 있습니다.');

    // 🧪 테스트 함수들 등록
    registerTestFunctions();

    // 🚨 즉시 가짜 MessageHandler 생성 시도
    if (!window.webkit?.messageHandlers) {
      console.log('🚨 [EMERGENCY] MessageHandler 없음, 강제 생성 실행');
      forceCreateMessageHandlers();
    }

    // 🚨 강제 웹 SDK 모드 비활성화 - 네이티브 로그인 강제 사용
    console.log('🚨 [NATIVE ONLY] 네이티브 구글 로그인 강제 모드 활성화');
    (window as any).__FORCE_WEB_SDK_MODE__ = false;
    (window as any).__FORCE_NATIVE_GOOGLE_LOGIN__ = true;

    // 🚨 네이티브 구글 로그인 콜백 함수 등록 (iOS 앱에서 호출 가능)
    (window as any).onNativeGoogleLoginSuccess = async (userInfo: any) => {
      console.log('🎯 [NATIVE CALLBACK] iOS 앱에서 구글 로그인 성공 콜백 수신:', userInfo);
      console.log('🎯 [NATIVE CALLBACK] userInfo 구조 확인:', {
        hasIdToken: !!userInfo.idToken,
        hasUserInfo: !!userInfo.userInfo,
        userInfoType: typeof userInfo.userInfo,
        userInfoKeys: Object.keys(userInfo),
        idTokenLength: userInfo.idToken ? userInfo.idToken.length : '없음',
        fullUserInfo: userInfo
      });

      // 🚨 iOS에서 전달된 원본 데이터 로깅
      console.log('🚨 [NATIVE CALLBACK] iOS 원본 데이터 상세:', {
        rawIdToken: userInfo.idToken,
        rawUserInfo: userInfo.userInfo,
        rawSource: userInfo.source,
        rawKeys: Object.keys(userInfo)
      });

      try {
        console.log('🔄 [NATIVE CALLBACK] 백엔드 구글 인증 API 호출 시작');

        // iOS 네이티브에서 전달된 데이터 구조 처리
        const idToken = userInfo.idToken;

        // userInfo.userInfo는 JSON 문자열이므로 파싱
        let userData;
        try {
          if (typeof userInfo.userInfo === 'string') {
            userData = JSON.parse(userInfo.userInfo);
            console.log('✅ [NATIVE CALLBACK] userInfo JSON 파싱 성공:', userData);
          } else {
            userData = userInfo.userInfo || userInfo;
            console.log('⚠️ [NATIVE CALLBACK] userInfo가 이미 객체임:', userData);
          }
        } catch (parseError) {
          console.error('❌ [NATIVE CALLBACK] userInfo JSON 파싱 실패:', parseError);
          userData = userInfo; // 폴백
        }

        console.log('🔍 [NATIVE CALLBACK] 파싱된 데이터:', {
          idToken: idToken ? `${idToken.substring(0, 30)}...` : '없음',
          email: userData.email,
          name: userData.name,
          imageURL: userData.imageURL,
          source: userInfo.source,
          userDataType: typeof userData
        });

        // 🚨 백엔드 API로 전송할 데이터 준비
        const requestData = {
          google_id: userData.sub || userData.googleId || userData.id,
          email: userData.email,
          name: userData.name,
          image: userData.imageURL || userData.picture,
          id_token: idToken,
          source: 'native'
        };

        console.log('🚨 [NATIVE CALLBACK] 백엔드 API로 전송할 최종 데이터:', {
          google_id: requestData.google_id,
          email: requestData.email,
          name: requestData.name,
          image: requestData.image,
          id_token_length: requestData.id_token ? requestData.id_token.length : '없음',
          id_token_prefix: requestData.id_token ? requestData.id_token.substring(0, 50) : '없음',
          source: requestData.source,
          hasAllRequired: !!(requestData.email && requestData.id_token)
        });

        // 백엔드 API로 ID 토큰 전송
        const response = await fetch('/api/google-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        console.log('📡 [NATIVE CALLBACK] API 요청 데이터:', {
          google_id: userData.sub || userData.googleId || userData.id,
          email: userData.email,
          name: userData.name,
          hasIdToken: !!idToken,
          source: 'native'
        });

        const data = await response.json();

        console.log('📡 [NATIVE CALLBACK] 백엔드 구글 인증 API 응답:', {
          success: data.success,
          hasUser: !!data.user,
          hasError: !!data.error,
          responseStatus: response.status,
          dataKeys: data ? Object.keys(data) : [],
          userKeys: data?.user ? Object.keys(data.user) : [],
          userMtIdx: data?.user?.mt_idx,
          userMtName: data?.user?.mt_name || data?.user?.name,
          userMtEmail: data?.user?.mt_email,
          hasToken: !!data.token,
          isNewUser: data.isNewUser
        });

        if (data.success) {
          console.log('[NATIVE CALLBACK] 구글 로그인 성공:', {
            isNewUser: data.isNewUser,
            hasUser: !!data.user,
            hasSocialData: !!data.socialLoginData
          });

          // 구글 로그인 성공 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.SUCCESS);

          // 리다이렉트 플래그 설정
          isRedirectingRef.current = true;
          blockAllEffectsRef.current = true;

          // 신규회원/기존회원에 따른 분기 처리
          if (data.isNewUser) {
            console.log('[NATIVE CALLBACK] 신규회원 - 회원가입 페이지로 이동');

            // 구글 소셜 로그인 데이터를 localStorage에 저장 (register 페이지에서 읽을 수 있도록)
            const socialData = {
              provider: 'google',
              email: data.user?.email || userData.email,
              name: data.user?.name || userData.name,
              nickname: data.user?.nickname || userData.name,
              given_name: userData.givenName,
              family_name: userData.familyName,
              profile_image: data.user?.profile_image || userData.imageURL || userData.picture,
              google_id: data.user?.google_id || userData.sub || userData.googleId
            };

            console.log('[NATIVE CALLBACK] 구글 소셜 로그인 데이터 저장:', socialData);
            localStorage.setItem('socialLoginData', JSON.stringify(socialData));

            // localStorage 저장 확인
            const savedData = localStorage.getItem('socialLoginData');
            console.log('[NATIVE CALLBACK] localStorage 저장 확인:', savedData);

            // 회원가입 페이지로 이동 (데이터 저장 후 약간의 지연)
            console.log('[NATIVE CALLBACK] register 페이지로 이동 준비');

            // localStorage 저장이 완료되었는지 재확인
            setTimeout(() => {
              const verifyData = localStorage.getItem('socialLoginData');
              if (verifyData) {
                console.log('[NATIVE CALLBACK] 데이터 저장 확인 완료, register 페이지로 이동');
                window.location.replace('/register?social=google');
              } else {
                console.error('[NATIVE CALLBACK] 데이터 저장 실패, 다시 시도');
                localStorage.setItem('socialLoginData', JSON.stringify(socialData));
                setTimeout(() => {
                  window.location.replace('/register?social=google');
                }, 200);
              }
            }, 200);
            return;

          } else {
            console.log('[NATIVE CALLBACK] 기존회원 - 홈으로 이동');

            // 🚨 강력한 인증 상태 설정
            let backendUserData = data.user || data.member;

            // 백엔드에서 user나 member가 없을 경우 직접 구성
            if (!backendUserData && data.success) {
              console.log('[NATIVE CALLBACK] 백엔드에서 사용자 데이터가 없어 직접 구성 시도');
              backendUserData = {
                mt_idx: data.mt_idx || data.id,
                mt_name: data.mt_name || data.name || userData.name,
                mt_email: data.email || userData.email,
                mt_nickname: data.nickname || userData.name,
                profile_image: data.profile_image || userData.imageURL || userData.picture,
                mt_google_id: userData.sub || userData.googleId || userData.id,
                mt_type: 4, // Google 로그인
                mt_level: 2, // 일반 회원
                mt_status: 1 // 정상
              };
              console.log('[NATIVE CALLBACK] 직접 구성한 사용자 데이터:', backendUserData);
            }

            if (backendUserData) {
              console.log('[NATIVE CALLBACK] 사용자 데이터 설정:', backendUserData);
              console.log('[NATIVE CALLBACK] 사용자 데이터 구조 확인:', {
                hasMtIdx: !!backendUserData.mt_idx,
                hasMtName: !!backendUserData.mt_name,
                hasMtEmail: !!backendUserData.mt_email,
                mtIdx: backendUserData.mt_idx,
                mtName: backendUserData.mt_name || backendUserData.name,
                mtEmail: backendUserData.mt_email,
                dataKeys: Object.keys(backendUserData),
                fullUserData: backendUserData
              });

              // 필수 필드 검증 (mt_name 대신 name 사용)
              if (!backendUserData.mt_idx || (!backendUserData.mt_name && !backendUserData.name)) {
                console.error('[NATIVE CALLBACK] ❌ 필수 사용자 데이터 누락:', {
                  hasMtIdx: !!backendUserData.mt_idx,
                  hasMtName: !!backendUserData.mt_name,
                  hasName: !!backendUserData.name,
                  userData: backendUserData
                });
                showError('사용자 정보가 불완전합니다. 다시 시도해주세요.');
                return;
              }

              // 1. AuthService에 토큰 저장 (가장 중요!)
              if (data.token) {
                console.log('[NATIVE CALLBACK] JWT 토큰 저장:', data.token ? '토큰 있음' : '토큰 없음');
                authService.setToken(data.token);
              } else {
                console.warn('[NATIVE CALLBACK] ⚠️ 백엔드에서 토큰이 반환되지 않음');
              }

              // 2. AuthService에 사용자 데이터 설정
              authService.setUserData(backendUserData);

              // 3. 로컬 스토리지에도 직접 저장 (백업)
              localStorage.setItem('user', JSON.stringify(backendUserData));
              localStorage.setItem('isLoggedIn', 'true');

              // 4. 로그인 시간 저장 (세션 유지를 위해 필수!)
              const loginTime = Date.now();
              localStorage.setItem('smap_login_time', loginTime.toString());
              console.log('[NATIVE CALLBACK] 로그인 시간 저장:', loginTime);

              // 5. 세션 스토리지에도 저장
              sessionStorage.setItem('authToken', 'authenticated');

              // 5. 저장 상태 확인
              console.log('[NATIVE CALLBACK] 저장 상태 확인:');
              console.log('  - 토큰:', authService.getToken() ? '저장됨' : '없음');
              console.log('  - 사용자 데이터:', authService.getUserData() ? '저장됨' : '없음');
              console.log('  - 사용자 데이터 구조:', authService.getUserData());
              console.log('  - isLoggedIn():', authService.isLoggedIn());

              console.log('[NATIVE CALLBACK] 모든 저장소에 인증 상태 저장 완료');
            }

            console.log('[NATIVE CALLBACK] 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');

            // 4. AuthContext 상태를 수동으로 동기화
            console.log('[NATIVE CALLBACK] AuthContext 동기화 시작');

            // 약간의 지연 후 동기화 (토큰 저장 완료 보장)
            setTimeout(async () => {
              try {
                console.log('[NATIVE CALLBACK] AuthContext 상태 동기화 실행');
                await refreshAuthState();
                console.log('[NATIVE CALLBACK] AuthContext 상태 동기화 완료');

                // 5. 동기화 후 상태 재확인
                const isLoggedInAfterRefresh = authService.isLoggedIn();
                console.log('[NATIVE CALLBACK] 동기화 후 로그인 상태:', isLoggedInAfterRefresh);
                console.log('[NATIVE CALLBACK] 저장된 토큰:', authService.getToken() ? '있음' : '없음');
                console.log('[NATIVE CALLBACK] 저장된 사용자:', authService.getUserData() ? '있음' : '없음');

                if (!isLoggedInAfterRefresh) {
                  console.warn('[NATIVE CALLBACK] ⚠️ 동기화 후에도 로그인 상태가 false - 추가 동기화 시도');

                  // 6. 강제로 AuthContext 상태 재설정 (여러 번 시도)
                  for (let attempt = 1; attempt <= 3; attempt++) {
                    console.log(`[NATIVE CALLBACK] 강제 AuthContext 재설정 시도 ${attempt}/3`);
                    try {
                      await refreshAuthState();

                      // 각 시도 후 상태 확인
                      const checkLoginState = authService.isLoggedIn();
                      console.log(`[NATIVE CALLBACK] 시도 ${attempt} 후 로그인 상태:`, checkLoginState);

                      if (checkLoginState) {
                        console.log(`[NATIVE CALLBACK] ✅ 시도 ${attempt}에서 로그인 상태 설정 성공`);
                        break;
                      }

                      // 다음 시도 전 약간의 지연
                      if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                      }
                    } catch (retryError) {
                      console.error(`[NATIVE CALLBACK] 시도 ${attempt} 실패:`, retryError);
                    }
                  }
                }

              } catch (error) {
                console.error('[NATIVE CALLBACK] AuthContext 동기화 실패:', error);
              }
            }, 1000); // 1초 지연

            // 7. 그룹 가입 처리
            try {
              const groupJoinResult = await handlePendingGroupJoin();
              if (groupJoinResult) {
                console.log('[NATIVE CALLBACK] ✅ 그룹 가입 처리 완료');
              }
            } catch (groupJoinError) {
              console.error('[NATIVE CALLBACK] ❌ 그룹 가입 처리 중 오류:', groupJoinError);
              // 그룹 가입 실패해도 로그인은 성공으로 처리
            }

            // 8. 인증 상태 확인 후 리다이렉션
            console.log('[NATIVE CALLBACK] 인증 상태 확인 후 리다이렉션 준비');

            // 추가 지연 후 최종 상태 확인 및 리다이렉션
            setTimeout(() => {
              const finalLoginState = authService.isLoggedIn();
              const finalToken = authService.getToken();
              const finalUserData = authService.getUserData();

              console.log('[NATIVE CALLBACK] 최종 상태 확인:');
              console.log('  - 로그인 상태:', finalLoginState);
              console.log('  - 토큰 존재:', !!finalToken);
              console.log('  - 사용자 데이터:', !!finalUserData);
              console.log('  - 로그인 시간:', localStorage.getItem('smap_login_time'));

              if (finalLoginState && finalToken && finalUserData) {
                console.log('[NATIVE CALLBACK] ✅ 모든 인증 상태 정상 - home으로 리다이렉션');
                router.replace('/home');
              } else {
                console.error('[NATIVE CALLBACK] ❌ 인증 상태 불완전 - 다시 시도');
                // 필요한 경우 에러 처리 또는 재시도 로직 추가
                setTimeout(() => {
                  if (authService.isLoggedIn()) {
                    console.log('[NATIVE CALLBACK] 재시도 성공 - home으로 이동');
                    router.replace('/home');
                  } else {
                    console.error('[NATIVE CALLBACK] 최종 실패 - 사용자에게 알림');
                    showError('로그인 처리 중 문제가 발생했습니다. 다시 시도해주세요.');
                  }
                }, 2000);
              }
            }, 2000); // 2초 지연
          }
        } else {
          console.error('[NATIVE CALLBACK] 서버 인증 실패:', data.error);
          showError(data.error || '서버 인증에 실패했습니다.');
        }
      } catch (error) {
        console.error('❌ [NATIVE CALLBACK] 백엔드 API 호출 실패:', error);
        showError('네트워크 오류가 발생했습니다.');
      } finally {
        // 로딩 해제
        setIsLoading(false);
      }
    };

    (window as any).onNativeGoogleLoginError = (error: any) => {
      console.error('❌ [NATIVE CALLBACK] iOS 앱에서 구글 로그인 실패 콜백 수신:', error);

      // 로딩 해제
      setIsLoading(false);

      // 에러 표시
      showError(error?.message || '네이티브 구글 로그인에 실패했습니다.');
    };

    console.log('✅ [NATIVE CALLBACK] 네이티브 구글 로그인 콜백 함수 등록 완료');

    // 🚨 네이티브 구글 로그인 데이터 처리 함수
    const handleNativeGoogleLoginData = async (data: any) => {
      console.log('🔄 [NATIVE DATA] 네이티브 구글 로그인 데이터 처리 시작');
      console.log('🔄 [NATIVE DATA] 받은 데이터 타입:', typeof data);
      console.log('🔄 [NATIVE DATA] 받은 데이터:', data);
      console.log('🔄 [NATIVE DATA] 데이터 키들:', data ? Object.keys(data) : '데이터 없음');

      // 진행 중 플래그 해제 (로그인 완료)
      delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;

      try {
        if (!data.idToken) {
          throw new Error('ID 토큰이 없습니다');
        }

        console.log('📤 [NATIVE DATA] 백엔드 API 호출 시작');

        // 백엔드 API 호출
        const response = await fetch('/api/google-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken: data.idToken,  // ✅ 백엔드가 기대하는 파라미터 이름으로 수정
            userInfo: data.userInfo,
            source: 'native_direct'
          }),
        });

        const result = await response.json();
        console.log('📥 [NATIVE DATA] 백엔드 응답:', result);
        console.log('📥 [NATIVE DATA] 백엔드 응답 타입:', typeof result);
        console.log('📥 [NATIVE DATA] 백엔드 응답 키들:', Object.keys(result));
        console.log('📥 [NATIVE DATA] isNewUser 값:', result.isNewUser);
        console.log('📥 [NATIVE DATA] success 값:', result.success);

        if (result.success) {
          if (result.isNewUser) {
            console.log('🆕 [NATIVE DATA] 신규 사용자 - 회원가입 페이지로 이동');
            console.log('🆕 [NATIVE DATA] 백엔드 응답 데이터:', result);
            console.log('🆕 [NATIVE DATA] 네이티브 데이터:', data);

            // 구글 소셜 로그인 데이터를 localStorage에 저장 (표준화된 구조로)
            const socialData = {
              provider: 'google',
              email: result.user?.email || data.userInfo?.email || data.email,
              name: result.user?.name || data.userInfo?.name || data.name,
              nickname: result.user?.nickname || data.userInfo?.nickname || data.nickname || data.userInfo?.name || data.name,
              given_name: data.userInfo?.givenName || data.userInfo?.given_name,
              family_name: data.userInfo?.familyName || data.userInfo?.family_name,
              profile_image: result.user?.profile_image || data.userInfo?.profile_image || data.profile_image || data.userInfo?.picture,
              google_id: result.user?.google_id || data.userInfo?.google_id || data.google_id || data.userInfo?.sub
            };

            console.log('🆕 [NATIVE DATA] 소셜 로그인 데이터 저장:', socialData);
            localStorage.setItem('socialLoginData', JSON.stringify(socialData));

            // localStorage 저장 확인
            const savedData = localStorage.getItem('socialLoginData');
            console.log('🆕 [NATIVE DATA] localStorage 저장 확인:', savedData);

            // 강제로 페이지 이동 (데이터 저장 확인 후)
            console.log('🆕 [NATIVE DATA] register 페이지로 이동 준비');

            setTimeout(() => {
              const verifyData = localStorage.getItem('socialLoginData');
              if (verifyData) {
                console.log('🆕 [NATIVE DATA] 데이터 저장 확인 완료, register 페이지로 이동');
                window.location.replace('/register?social=google');
              } else {
                console.error('🆕 [NATIVE DATA] 데이터 저장 실패, 다시 시도');
                localStorage.setItem('socialLoginData', JSON.stringify(socialData));
                setTimeout(() => {
                  window.location.replace('/register?social=google');
                }, 200);
              }
            }, 200);
          } else {
            console.log('✅ [NATIVE DATA] 기존 사용자 - 홈으로 이동');

            // 🚨 강력한 인증 상태 설정 (전역 변수 버전)
            if (result.user) {
              console.log('[NATIVE DATA] 사용자 데이터 설정:', result.user);

              // AuthService 및 스토리지에 저장
              authService.setUserData(result.user);
              localStorage.setItem('user', JSON.stringify(result.user));
              localStorage.setItem('isLoggedIn', 'true');
              sessionStorage.setItem('authToken', 'authenticated');

              console.log('[NATIVE DATA] 모든 저장소에 인증 상태 저장 완료');

              // 🚀 로그인 성공 시 모든 데이터 일괄 프리로딩
              console.log('[NATIVE DATA] 🚀 로그인 성공 후 전체 데이터 프리로딩 시작');
              try {
                const preloadResults = await comprehensivePreloadData(result.user.mt_idx);

                if (preloadResults.success) {
                  // DataCacheContext에 일괄 저장
                  saveComprehensiveData({
                    userProfile: preloadResults.userProfile,
                    userGroups: preloadResults.userGroups,
                    groupMembers: preloadResults.groupMembers,
                    locationData: preloadResults.locationData,
                    dailyLocationCounts: preloadResults.dailyCounts
                  });

                  console.log('[NATIVE DATA] ✅ 로그인 후 전체 데이터 프리로딩 완료');
                } else {
                  console.warn('[NATIVE DATA] ⚠️ 로그인 후 데이터 프리로딩 실패:', preloadResults.errors);
                }
              } catch (preloadError) {
                console.error('[NATIVE DATA] ❌ 로그인 후 데이터 프리로딩 오류:', preloadError);
                // 프리로딩 실패해도 로그인은 성공으로 처리
              }
            }

            // 그룹 가입 처리
            try {
              const groupJoinResult = await handlePendingGroupJoin();
              if (groupJoinResult) {
                console.log('[NATIVE DATA] ✅ 그룹 가입 처리 완료');
              }
            } catch (groupJoinError) {
              console.error('[NATIVE DATA] ❌ 그룹 가입 처리 중 오류:', groupJoinError);
              // 그룹 가입 실패해도 로그인은 성공으로 처리
            }

            // 즉시 리다이렉션
            console.log('[NATIVE DATA] 홈으로 즉시 리다이렉션 실행');
            window.location.href = '/home';
          }
        } else {
          throw new Error(result.message || '인증 실패');
        }
      } catch (error) {
        console.error('❌ [NATIVE DATA] 처리 중 오류:', error);
        showError(`네이티브 로그인 처리 중 오류가 발생했습니다: ${error}`);
      }
    };

    // 🚨 전역 변수 모니터링 (iOS 앱에서 직접 저장한 데이터 확인)
    const checkNativeData = () => {
      // 디버깅을 위한 수동 확인
      const savedData = localStorage.getItem('socialLoginData');
      if (savedData) {
        console.log('🎉 [NATIVE DATA] localStorage에서 데이터 발견:', savedData);
      }

      // 전역 변수 확인
      if ((window as any).__NATIVE_GOOGLE_LOGIN_DATA__) {
        const data = (window as any).__NATIVE_GOOGLE_LOGIN_DATA__;
        console.log('🎉 [NATIVE DATA] 전역 변수에서 구글 로그인 데이터 발견!', data);

        // 즉시 처리
        handleNativeGoogleLoginData(data);

        // 데이터 사용 후 삭제
        delete (window as any).__NATIVE_GOOGLE_LOGIN_DATA__;
      }

      // iOS 네이티브 콜백 데이터도 확인
      if ((window as any).__IOS_GOOGLE_LOGIN_CALLBACK__) {
        const callbackData = (window as any).__IOS_GOOGLE_LOGIN_CALLBACK__;
        console.log('🎉 [NATIVE DATA] iOS 콜백 데이터 발견!', callbackData);

        // 진행 중 플래그 해제
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;

        if (callbackData.success && callbackData.data) {
          // 성공한 경우
          handleNativeGoogleLoginData(callbackData.data);
        } else if (callbackData.error) {
          // 실패한 경우
          console.log('ℹ️ [NATIVE DATA] iOS 로그인 취소 또는 실패:', callbackData.error);
          setError('로그인이 취소되었습니다. 다시 시도해주세요.');
          setIsLoading(false);
        }

        // 콜백 데이터 삭제
        delete (window as any).__IOS_GOOGLE_LOGIN_CALLBACK__;
      }
    };

    // 주기적으로 확인 (1초마다, 최대 10회)
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      console.log(`🔍 [NATIVE DATA] 모니터링 ${checkCount}/10`);
      checkNativeData();

      if (checkCount >= 10) {
        clearInterval(checkInterval);
        console.log('🔍 [NATIVE DATA] 전역 변수 모니터링 종료');

        // 모니터링 종료 후에도 localStorage 확인
        const savedData = localStorage.getItem('socialLoginData');
        console.log('🔍 [NATIVE DATA] 최종 localStorage 확인:', savedData);
      }
    }, 1000);

    // 즉시 한 번 확인
    checkNativeData();

    // 🔍 즉시 강제 핸들러 확인 (iOS 환경에서만)
    if (isIOSWebView) {
      setTimeout(() => {
        console.log('🔍 [FORCE HANDLER CHECK] 5초 후 상세 핸들러 확인');
        forceCheckHandlers();
      }, 5000);
    } else {
      console.log('🔍 [FORCE HANDLER CHECK] 개발 환경에서는 핸들러 체크 생략');
    }

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

  // iOS WebView 환경 감지 - 안드로이드 기기 제외
  const isIOSWebView = React.useMemo(() => {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const hasWebKit = !!(window as any).webkit;
    const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;
    const hasIosBridge = typeof (window as any).SMAP_FORCE_HAPTIC === 'function';
    const isLocalhost = window.location.hostname === 'localhost';
    const isSimulator = /Simulator/.test(userAgent) ||
      navigator.userAgent.includes('iPhone Simulator') ||
      navigator.userAgent.includes('iPad Simulator');

    // 🚨 안드로이드 기기면 무조건 iOS가 아님
    if (isAndroid) {
      console.log('[SIGNIN] 🤖 안드로이드 기기 감지 - iOS 환경이 아님');
      return false;
    }

    // iOS 환경 감지 조건들
    const conditions = {
      condition1: isIOS && hasWebKit && hasMessageHandlers, // 표준 WebKit
      condition2: isIOS && hasIosBridge, // ios-bridge.js가 로드된 iOS
      condition3: isLocalhost && isIOS, // localhost의 iOS
      condition4: isSimulator, // iOS 시뮬레이터
      condition5: (window as any).__FORCE_IOS_MODE__ === true, // 강제 iOS 모드
      condition6: isIOS && hasWebKit, // iOS + WebKit
    };

    const result = Object.values(conditions).some(Boolean);

    console.log('[SIGNIN] 🍎 iOS 환경 감지:', {
      userAgent: userAgent.substring(0, 50) + '...',
      hostname: window.location.hostname,
      isIOS,
      isAndroid,
      isSimulator,
      hasWebKit,
      hasMessageHandlers,
      conditions,
      finalResult: result
    });

    return result;
  }, []);

  // Android WebView 환경 감지 - 개선된 버전
  const isAndroidWebView = React.useMemo(() => {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent;
    const isAndroid = /Android/.test(userAgent);
    const hasAndroidBridge = !!(window as any).androidBridge;
    const hasAndroidGoogleSignIn = !!(window as any).AndroidGoogleSignIn;
    const hasAndroidHandlers = !!(window as any).__SMAP_ANDROID_HANDLERS_READY__;
    const hasWebKit = !!(window as any).webkit;
    const hasMessageHandlers = !!(window as any).webkit?.messageHandlers;

    // Android 기기이면 무조건 Android 환경으로 인정
    const result = isAndroid;

    console.log('[SIGNIN] 🤖 Android 환경 감지:', {
      userAgent: userAgent.substring(0, 50) + '...',
      isAndroid,
      hasAndroidBridge,
      hasAndroidGoogleSignIn,
      hasAndroidHandlers,
      hasWebKit,
      hasMessageHandlers,
      finalResult: result
    });

    return result;
  }, []);

  // 웹 환경 감지
  const isWebEnvironment = React.useMemo(() => {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);

    // iOS나 Android가 아니면 웹 환경으로 간주
    const result = !isIOS && !isAndroid;

    console.log('[SIGNIN] 🌐 웹 환경 감지:', {
      userAgent: userAgent.substring(0, 50) + '...',
      isIOS,
      isAndroid,
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
      triggerHapticFeedback(HapticFeedbackType.SUCCESS);

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
      triggerHapticFeedback(HapticFeedbackType.SUCCESS);

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
      return undefined;
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

    // 안드로이드에서는 웹 SDK 사용 금지 (강화)
    if (isAndroidWebView) {
      console.log('[GOOGLE SDK] 안드로이드 WebView 감지 - 웹 SDK 로그인 경로 차단');
      setError('Google 로그인은 안드로이드 앱에서는 네이티브 방식만 지원됩니다. 앱의 Google 로그인 버튼을 사용해주세요.');
      // 사용자가 잘못된 경로를 타지 않도록 즉시 반환
      return undefined;
    }

    // 중복 호출 방지
    if ((window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__) {
      console.log('[GOOGLE SDK] 이미 로그인 진행 중, 중복 호출 무시');
      return undefined;
    }

    (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = true;

    // 🔥 Google SDK 토큰 캐시 정리 (로그아웃 후 재시도 문제 해결)
    try {
      if ((window as any).google?.accounts?.id) {
        console.log('[GOOGLE SDK] 기존 토큰 캐시 정리 시작');
        (window as any).google.accounts.id.cancel();
        console.log('[GOOGLE SDK] 토큰 캐시 정리 완료');
      }
    } catch (cacheError) {
      console.warn('[GOOGLE SDK] 토큰 캐시 정리 중 오류 (무시):', cacheError);
    }

    try {
      // Google Identity Services 초기화 (이미 로드되어 있다고 가정)
      if ((window as any).google?.accounts?.id) {
        const google = (window as any).google;

        console.log('[GOOGLE SDK] Google Identity Services 초기화');

        // 🔥 Client ID 설정 (하드코딩으로 문제 해결)
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-02ajuasfuecajd0holgu7iqb5hvtjgbp.apps.googleusercontent.com';

        console.log('[GOOGLE SDK] Client ID 확인:', {
          hasPublicEnv: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          hasPrivateEnv: !!process.env.GOOGLE_CLIENT_ID,
          usingClientId: clientId.substring(0, 12) + '...',
          clientIdLength: clientId.length,
          currentDomain: window.location.hostname,
          isProduction: window.location.hostname.includes('.smap.site'),
          isHardcoded: !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        });

        // Client ID 유효성 검사
        if (!clientId || clientId.length < 10) {
          console.error('[GOOGLE SDK] Client ID가 유효하지 않습니다:', clientId);
          throw new Error('Google OAuth Client ID가 설정되지 않았습니다.');
        }

        // 프로덕션 환경에서 추가 도메인 검증 (안드로이드 WebView 차단 보강)
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

        // 🔥 매번 새로운 상태로 초기화 (토큰 캐시 문제 해결)
        google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false, // 자동 선택 비활성화
          cancel_on_tap_outside: true, // 외부 클릭 시 취소
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

                // 그룹 가입 처리
                try {
                  const groupJoinResult = await handlePendingGroupJoin();
                  if (groupJoinResult) {
                    console.log('[GOOGLE SDK] ✅ 그룹 가입 처리 완료');
                  }
                } catch (groupJoinError) {
                  console.error('[GOOGLE SDK] ❌ 그룹 가입 처리 중 오류:', groupJoinError);
                  // 그룹 가입 실패해도 로그인은 성공으로 처리
                }

                // 성공 햅틱 피드백
                triggerHapticFeedback(HapticFeedbackType.SUCCESS);
                console.log('🎮 [SIGNIN] Google 로그인 성공 햅틱 피드백 실행');

                // 즉시 홈으로 이동
                console.log('[GOOGLE SDK] 즉시 홈 페이지로 이동');
                router.push('/home');
              } else {
                throw new Error(data.error || 'Google 인증 실패');
              }
            } catch (error) {
              console.error('[GOOGLE SDK] 백엔드 인증 실패:', error);
              showError('Google 로그인에 실패했습니다.\n\n전화번호 로그인을 이용해주세요.');
            } finally {
              setIsLoading(false);
              (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
            }
          },
          error_callback: (error: any) => {
            console.error('[GOOGLE SDK] 로그인 실패:', error);

            // 진행 중 플래그 해제
            (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
            setIsLoading(false);

            // 사용자 취소 여부 확인
            const errorString = String(error);
            const isCancelled = errorString.includes('popup_closed_by_user') ||
              errorString.includes('popup_blocked_by_browser') ||
              errorString.includes('cancelled') ||
              errorString.includes('canceled') ||
              errorString.includes('user_cancelled') ||
              error?.type === 'popup_closed';

            if (isCancelled) {
              console.log('[GOOGLE SDK] 사용자가 팝업을 닫거나 로그인을 취소함 - 페이지 완전 고정');

              // 🚨 페이지 완전 고정
              freezePage();

              // 취소의 경우 가벼운 햅틱 피드백만 제공
              triggerHapticFeedback(HapticFeedbackType.LIGHT);

              // 간단한 메시지만 표시하고 페이지는 그대로 유지
              setApiError('로그인을 취소했습니다.');

              // 3초 후 메시지 자동 제거 및 모든 차단 해제
              setTimeout(() => {
                setApiError('');
                unfreezePage();

                // 🚨 모든 차단 플래그 해제
                delete (window as any).__PREVENT_SIGNIN_NAVIGATION__;
                delete (window as any).__FORCE_BLOCK_NAVIGATION__;

                console.log('[GOOGLE SDK] 취소 시 모든 차단 플래그 해제 완료');
              }, 3000);

              return; // 여기서 함수 종료 - 추가 처리 없음
            }

            // 실제 에러의 경우 에러 햅틱 피드백
            triggerHapticFeedback(HapticFeedbackType.ERROR);

            // 실제 에러 메시지 생성
            let errorMessage = 'Google 로그인에 실패했습니다.';
            if (window.location.hostname.includes('.smap.site')) {
              errorMessage = 'Google 로그인을 사용할 수 없습니다.\n\n전화번호 로그인을 이용해주세요.';
            } else {
              errorMessage = 'Google 로그인에 실패했습니다.\n\n다시 시도하거나 전화번호 로그인을 사용해주세요.';
            }

            // 실제 에러의 경우 에러 모달 표시
            showError(errorMessage);
          }
        });

        // 🔥 로그인 시도 전 추가 정리
        try {
          // 기존 팝업이나 상태 정리
          google.accounts.id.cancel();

          // 잠시 대기 후 팝업 띄우기
          setTimeout(() => {
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
              }
            });
          }, 100);
        } catch (error) {
          console.error('[GOOGLE SDK] Prompt 호출 실패:', error);
          showError('Google 로그인을 사용할 수 없습니다.\n\n전화번호 로그인을 이용해주세요.');
          setIsLoading(false);
          (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
        }

      } else {
        console.error('[GOOGLE SDK] window.google.accounts.id가 없음:', {
          hasWindow: typeof window !== 'undefined',
          hasGoogle: !!(window as any).google,
          hasAccounts: !!(window as any).google?.accounts,
          hasId: !!(window as any).google?.accounts?.id,
          userAgent: navigator.userAgent
        });

        // 안드로이드에서는 웹 Google SDK를 사용하지 않음
        if (isAndroidWebView) {
          console.log('[GOOGLE SDK] 안드로이드 환경 - 웹 Google SDK 사용하지 않음');
          throw new Error('안드로이드에서는 네이티브 Google 로그인을 사용합니다.');
        }

        // Google SDK를 동적으로 로드해보기 (iOS 및 웹 환경에서만)
        console.log('[GOOGLE SDK] Google Identity Services SDK 동적 로드 시도...');

        try {
          // 기존 스크립트가 있는지 확인
          let existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');

          if (!existingScript) {
            // 새로운 스크립트 태그 생성
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;

            // 스크립트 로드 완료 대기
            await new Promise((resolve, reject) => {
              script.onload = () => {
                console.log('[GOOGLE SDK] Google Identity Services SDK 로드 완료');
                resolve(true);
              };
              script.onerror = () => {
                console.error('[GOOGLE SDK] Google Identity Services SDK 로드 실패');
                reject(new Error('SDK 로드 실패'));
              };

              document.head.appendChild(script);

              // 10초 타임아웃
              setTimeout(() => reject(new Error('SDK 로드 타임아웃')), 10000);
            });

            console.log('[GOOGLE SDK] 스크립트 추가 완료, SDK 초기화 대기...');

            // SDK 초기화 대기 (최대 3초)
            let attempts = 0;
            while (attempts < 15 && !(window as any).google?.accounts?.id) {
              await new Promise(resolve => setTimeout(resolve, 200));
              attempts++;
            }
          }

          // SDK가 로드되었는지 재확인
          if ((window as any).google?.accounts?.id) {
            console.log('[GOOGLE SDK] 동적 로드 성공! 재귀 호출로 다시 시도');
            return handleGoogleSDKLogin(retryCount + 1);
          } else {
            throw new Error('Google SDK 동적 로드 후에도 사용할 수 없음');
          }

        } catch (sdkError) {
          console.error('[GOOGLE SDK] 동적 로드 실패:', sdkError);

          // 최대 2회까지만 재시도
          if (retryCount < 2) {
            console.log('[GOOGLE SDK] 3초 후 기존 재시도 로직 실행...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            if ((window as any).google?.accounts?.id) {
              console.log('[GOOGLE SDK] 재시도 성공 - SDK 사용 가능');
              // 재귀 호출로 다시 시도
              return handleGoogleSDKLogin(retryCount + 1);
            } else {
              console.log('[GOOGLE SDK] 재시도해도 SDK 없음');
            }
          }
        }

        throw new Error('Google 로그인을 사용할 수 없습니다.');
      }

    } catch (error: any) {
      console.error('[GOOGLE SDK] 초기화 실패:', error);
      (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
      throw error;
    } finally {
      (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
    }
  };

  // 컴포넌트 마운트 추적 (안전한 버전)
  useEffect(() => {
    // 페이지 로드 시 이전 상태 정리
    console.log('[SIGNIN] 페이지 로드 시 이전 상태 정리 시작');

    // 🔥 로그아웃 후 에러 모달 방지를 위한 추가 정리
    if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[SIGNIN] 이전 에러 모달 상태 정리');
      delete (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__;
    }

    // 이전 구글 로그인 상태 정리
    if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
      console.log('[SIGNIN] 이전 구글 로그인 상태 정리');
      delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
    }

    if ((window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__) {
      console.log('[SIGNIN] 이전 구글 SDK 로그인 상태 정리');
      delete (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__;
    }

    // 페이지 고정 상태 정리
    if ((window as any).__PAGE_FROZEN__) {
      console.log('[SIGNIN] 이전 페이지 고정 상태 정리');
      try {
        unfreezePage();
      } catch (error) {
        console.warn('[SIGNIN] 이전 페이지 고정 상태 정리 실패:', error);
        // 강제로 스타일 초기화
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.touchAction = '';
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        (document.body.style as any).webkitTouchCallout = '';
        (document.body.style as any).webkitTapHighlightColor = '';
        (document.body.style as any).webkitOverflowScrolling = '';
        document.body.style.webkitTransform = '';
        delete (window as any).__PAGE_FROZEN__;
        delete (window as any).__SAVED_SCROLL_POSITION__;
        delete (window as any).__SAVED_VIEWPORT_HEIGHT__;
      }
    }

    // 🔥 로그아웃 후 에러 상태 완전 초기화
    setIsLoading(false);
    setError(null);
    setApiError('');
    setShowErrorModal(false);
    setErrorModalMessage('');

    // 🔥 URL에서 에러 파라미터 제거 (로그아웃 후 에러 모달 방지)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('error')) {
        console.log('[SIGNIN] URL에서 에러 파라미터 제거');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }

    if (!componentMountedRef.current) {
      componentMountedRef.current = true;
      console.log('[SIGNIN] 컴포넌트 최초 마운트');
    }

    console.log('[SIGNIN] 페이지 로드 시 이전 상태 정리 완료');
  }, []);

  // 인증 상태 확인 및 리다이렉트 처리 (강화된 네비게이션 차단)
  useEffect(() => {
    // 간단한 네비게이션 차단 플래그 확인
    if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
      console.log('[SIGNIN] 🚫 구글 로그인 중 - 네비게이션 차단');
      return undefined;
    }

    // 에러 모달이 표시 중이면 아무것도 하지 않음
    if (showErrorModal) {
      return undefined;
    }

    // 로딩 중이면 대기
    if (loading) {
      return undefined;
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
      return undefined;
    }

    // 로그인된 사용자는 홈으로 리다이렉트 (차단 플래그 재확인)
    if (isLoggedIn && !isRedirectingRef.current) {
      // 🚫 에러 모달이 표시 중이면 리다이렉트 방지
      if (showErrorModal) {
        console.log('[SIGNIN] 🚫 에러 모달 표시 중 - 홈 리다이렉트 차단');
        return undefined;
      }

      // 리다이렉트 직전에 다시 한 번 차단 플래그 확인
      if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
        console.log('[SIGNIN] 🚫 로그인된 사용자지만 구글 로그인 중 - 홈 리다이렉트 차단');
        return undefined;
      }

      // 🚫 최근 로그아웃 감지 시 리다이렉트 방지 (무한 루프 방지)
      const lastLogoutTime = localStorage.getItem('last_logout_time');
      if (lastLogoutTime) {
        const currentTime = Date.now();
        const timeSinceLogout = currentTime - parseInt(lastLogoutTime);
        if (timeSinceLogout < 30000) { // 30초 이내 (시간 연장)
          console.log('[SIGNIN] 🚫 최근 로그아웃 감지 - 홈 리다이렉트 차단 (무한 루프 방지)');
          return undefined;
        }
      }

      // 🚫 로그아웃 후 강제로 signin 페이지에 머물기 위한 추가 체크
      const forceStayOnSignin = localStorage.getItem('force_stay_on_signin');
      if (forceStayOnSignin === 'true') {
        console.log('[SIGNIN] 🚫 force_stay_on_signin 플래그 감지 - signin 페이지에 머물기');
        return undefined;
      }

      // 🚫 URL에 'stay' 파라미터가 있거나 localStorage에 'force_stay_on_signin' 플래그가 있으면 signin 페이지에 머물기
      const urlParams = new URLSearchParams(window.location.search);
      const shouldStay = urlParams.get('stay') === 'true' || localStorage.getItem('force_stay_on_signin') === 'true';
      if (shouldStay) {
        console.log('[SIGNIN] 🚫 stay 파라미터 또는 force_stay_on_signin 플래그 감지 - signin 페이지에 머물기');
        // URL에서 stay 파라미터 제거
        if (urlParams.get('stay') === 'true') {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('stay');
          window.history.replaceState({}, '', newUrl.toString());
        }
        return undefined;
      }

      // 🚫 사용자가 명시적으로 signin 페이지를 방문한 경우 (직접 URL 입력, 북마크 등) 자동 리다이렉트 방지
      const referrer = document.referrer;
      const isDirectVisit = !referrer || referrer === window.location.href;
      const isFromExternal = referrer && !referrer.includes('nextstep.smap.site');

      if (isDirectVisit || isFromExternal) {
        console.log('[SIGNIN] 🚫 직접 방문 또는 외부에서 접근 - signin 페이지에 머물기');
        return undefined;
      }

      console.log('[SIGNIN] 로그인된 사용자 감지, /home으로 리다이렉트');
      isRedirectingRef.current = true;
      router.replace('/home');
      return undefined;
    }

    // 로그인되지 않은 상태에서만 페이지 표시
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

  // URL 파라미터에서 에러 메시지 확인 (처음 방문 시 에러 모달 방지)
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      // 🔥 처음 방문 시 에러 모달 방지
      const isFirstVisit = !document.referrer || document.referrer.includes(window.location.origin + '/signin');
      if (isFirstVisit) {
        console.log('[SIGNIN] 처음 방문 시 에러 파라미터 감지 - 무시:', error);
        // URL에서 error 파라미터만 제거
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl.toString());
        return;
      }

      // 🔥 로그아웃 후 에러 모달 방지 - 컴포넌트 마운트 후 1초 이내의 에러는 무시
      const timeSinceMount = Date.now() - (componentMountedRef.current ? 0 : Date.now());
      if (timeSinceMount < 1000) {
        console.log('[SIGNIN] 로그아웃 후 빠른 에러 감지 - 무시:', error);
        // URL에서 error 파라미터만 제거
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl.toString());
        return;
      }

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
    const isAndroidWebView = /Android/.test(navigator.userAgent);
    console.log('[GOOGLE LOGIN] 콜백 함수 등록 - 환경:', { isIOSWebView, isAndroidWebView });

    // 간단한 네비게이션 차단
    const preventNavigation = (e: BeforeUnloadEvent) => {
      if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
        console.log('[NAVIGATION BLOCK] 🚫 구글 로그인 중 - 페이지 변경 차단');
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', preventNavigation);

    // cleanup 함수
    return () => {
      window.removeEventListener('beforeunload', preventNavigation);
    };

    if (isIOSWebView || isAndroidWebView) {
      // 로딩 상태 함수를 전역으로 노출 (Android에서 사용)
      (window as any).setIsLoading = (loading: boolean) => {
        setIsLoading(loading);
      };

      // Google Sign-In 성공 콜백 (iOS + Android 공통)
      (window as any).googleSignInSuccess = async (idToken: string, userInfoJson: any) => {
        try {
          // 타임아웃 클리어
          if ((window as any).__GOOGLE_LOGIN_TIMEOUT__) {
            clearTimeout((window as any).__GOOGLE_LOGIN_TIMEOUT__);
            (window as any).__GOOGLE_LOGIN_TIMEOUT__ = null;
          }

          console.log('[GOOGLE LOGIN] ✅ 네이티브 Google Sign-In 성공 콜백 수신');
          console.log('[GOOGLE LOGIN] 기기타입:', isAndroidWebView ? 'Android' : (isIOSWebView ? 'iOS' : 'Unknown'));
          console.log('[GOOGLE LOGIN] 매개변수 타입 확인:', {
            idTokenType: typeof idToken,
            idTokenLength: idToken?.length || 0,
            userInfoType: typeof userInfoJson,
            userInfoValue: userInfoJson
          });

          // 진행 중 플래그 해제
          delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;

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
            userInfo: normalizedUserInfo,
            deviceType: isAndroidWebView ? 'android' : (isIOSWebView ? 'ios' : 'unknown'),
            timestamp: new Date().toISOString()
          });

          const response = await fetch('/api/google-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idToken: idToken,
              userInfo: normalizedUserInfo,
              source: isAndroidWebView ? 'android_native' : 'ios_native'
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

            // 간단한 차단 해제 (성공 시)
            console.log('[GOOGLE LOGIN] 성공 시 차단 해제 시작');

            // 로딩 상태 해제
            setIsLoading(false);

            // 페이지 고정 해제 (성공 시에도)
            try {
              unfreezePage();
            } catch (error) {
              console.warn('[GOOGLE LOGIN] 성공 시 페이지 고정 해제 중 오류:', error);
            }

            // 진행 중 플래그 해제
            delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;

            // 🔥 Google 로그인 성공 후 강화된 토큰 및 사용자 정보 저장
            if (data.user && data.token) {
              console.log('[GOOGLE LOGIN] 🔥 사용자 데이터 및 토큰 저장 시작');

              // 1. authService에 데이터 저장
              authService.setUserData(data.user);
              authService.setToken(data.token);

              // 2. localStorage에도 직접 저장 (안전장치)
              if (typeof window !== 'undefined') {
                localStorage.setItem('auth-token', data.token);
                localStorage.setItem('smap_user_data', JSON.stringify(data.user));
              }

              console.log('[GOOGLE LOGIN] 🔄 AuthContext 상태 동기화 시작');

              // 3. AuthContext 상태를 수동으로 동기화
              await refreshAuthState();

              // 4. FCM 토큰 체크 및 업데이트 (백그라운드에서 실행)
              // 🚨 Firebase 토큰 생성 로직 제거 - 네이티브에서 관리
              setTimeout(async () => {
                try {
                  console.log('[GOOGLE LOGIN] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
                  console.log('[GOOGLE LOGIN] 🚫 FCM 토큰 업데이트 로직 비활성화됨 - 네이티브에서 관리');
                } catch (fcmError) {
                  console.error('[GOOGLE LOGIN] ❌ FCM 처리 중 오류:', fcmError);
                }
              }, 1000); // Google 로그인 후 1초 지연

              // 5. Google 로그인 성공 햅틱 피드백
              triggerHapticFeedback(HapticFeedbackType.SUCCESS);
              console.log('🎮 [SIGNIN] Google 로그인 성공 햅틱 피드백 실행');

              // 6. 리다이렉트 플래그 설정
              isRedirectingRef.current = true;

              // 7. 그룹 가입 처리
              try {
                const groupJoinResult = await handlePendingGroupJoin();
                if (groupJoinResult) {
                  console.log('[GOOGLE LOGIN] ✅ 그룹 가입 처리 완료');
                }
              } catch (groupJoinError) {
                console.error('[GOOGLE LOGIN] ❌ 그룹 가입 처리 중 오류:', groupJoinError);
                // 그룹 가입 실패해도 로그인은 성공으로 처리
              }

              // 8. 신규 사용자인 경우 회원가입 페이지로 이동, 기존 사용자는 홈으로 이동
              if (data.isNewUser) {
                console.log('[GOOGLE LOGIN] 🆕 신규 사용자 - 회원가입 페이지로 이동');
                console.log('[GOOGLE LOGIN] 이메일 정보:', data.user.email);

                // 구글 소셜 로그인 데이터를 localStorage에 저장 (표준화된 구조로)
                const socialData = {
                  provider: 'google',
                  email: data.user.email,
                  name: data.user.name,
                  nickname: data.user.name,
                  given_name: data.user.given_name,
                  family_name: data.user.family_name,
                  profile_image: data.user.profile_image,
                  google_id: data.user.google_id
                };

                console.log('[GOOGLE LOGIN] 구글 소셜 로그인 데이터 저장:', socialData);
                localStorage.setItem('socialLoginData', JSON.stringify(socialData));

                // localStorage 저장 확인
                const savedData = localStorage.getItem('socialLoginData');
                console.log('[GOOGLE LOGIN] localStorage 저장 확인:', savedData);

                // 회원가입 페이지로 이동 (데이터 저장 확인 후)
                console.log('[GOOGLE LOGIN] register 페이지로 이동 준비');

                setTimeout(() => {
                  const verifyData = localStorage.getItem('socialLoginData');
                  if (verifyData) {
                    console.log('[GOOGLE LOGIN] 데이터 저장 확인 완료, register 페이지로 이동');
                    window.location.replace('/register?social=google');
                  } else {
                    console.error('[GOOGLE LOGIN] 데이터 저장 실패, 다시 시도');
                    localStorage.setItem('socialLoginData', JSON.stringify(socialData));
                    setTimeout(() => {
                      window.location.replace('/register?social=google');
                    }, 200);
                  }
                }, 200);
              } else {
                console.log('[GOOGLE LOGIN] 🏠 기존 사용자 - 홈 페이지로 이동');
                router.replace('/home');
              }
            }
          } else {
            throw new Error(data.error || '로그인에 실패했습니다.');
          }
        } catch (error: any) {
          console.error('[GOOGLE LOGIN] 네이티브 Google 로그인 처리 오류:', error);

          // Google 로그인 실패 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.ERROR);

          showError(error.message || 'Google 로그인 처리 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      // Google Sign-In 실패 콜백 (강화된 네비게이션 차단 해제)
      (window as any).googleSignInError = (errorMessage: string) => {
        console.error('[GOOGLE LOGIN] iOS 네이티브 Google Sign-In 실패:', errorMessage);

        // 간단한 차단 해제
        console.log('[GOOGLE LOGIN] 실패 시 차단 해제 시작');

        // 로딩 상태 해제
        setIsLoading(false);

        // 진행 중 플래그 해제
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
        delete (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__;

        // 페이지 고정 해제 (안전하게)
        try {
          unfreezePage();
        } catch (error) {
          console.warn('[GOOGLE LOGIN] 실패 시 페이지 고정 해제 중 오류:', error);
        }

        // 에러 메시지에 따른 사용자 친화적 메시지 제공
        let userFriendlyMessage = errorMessage;
        const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('canceled') || errorMessage.includes('The user canceled the sign-in-flow');

        if (isCancelled) {
          userFriendlyMessage = '로그인을 취소했습니다.';
          console.log('[GOOGLE LOGIN] 사용자가 로그인을 취소함');

          // 취소의 경우 가벼운 햅틱 피드백만 제공
          triggerHapticFeedback(HapticFeedbackType.LIGHT);

          // 간단한 메시지만 표시
          setApiError(userFriendlyMessage);

          // 3초 후 메시지 자동 제거
          setTimeout(() => {
            setApiError('');
          }, 3000);

          return; // 여기서 함수 종료 - 추가 처리 없음
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          userFriendlyMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
        } else if (errorMessage.includes('configuration') || errorMessage.includes('Configuration')) {
          userFriendlyMessage = 'Google 로그인 설정에 문제가 있습니다. 앱을 다시 시작해주세요.';
        }

        // 취소가 아닌 실제 에러의 경우에만 에러 햅틱 피드백
        triggerHapticFeedback(HapticFeedbackType.ERROR);

        // 실제 에러의 경우 에러 모달 표시
        console.log('[GOOGLE LOGIN] 실제 에러 발생:', userFriendlyMessage);
        showError(userFriendlyMessage);
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

  // 에러 모달 상태 디버깅 및 안정화 (강화된 버전)
  useEffect(() => {
    console.log('[SIGNIN] 에러 모달 상태 변화:', { showErrorModal, errorModalMessage });
    if (showErrorModal && errorModalMessage) {
      console.log('[SIGNIN] ⚠️ 에러 모달이 표시되어야 함:', errorModalMessage);

      // 에러 모달이 표시되면 페이지 새로고침 방지
      const preventRefresh = (e: BeforeUnloadEvent) => {
        console.log('[SIGNIN] 🚫 beforeunload 이벤트 차단');
        e.preventDefault();
        e.returnValue = '';
        return '';
      };

      const preventPopState = (e: PopStateEvent) => {
        console.log('[SIGNIN] 🚫 popstate 이벤트 차단');
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };

      const preventKeyDown = (e: KeyboardEvent) => {
        // ESC 키 차단
        if (e.key === 'Escape') {
          console.log('[SIGNIN] 🚫 ESC 키 차단');
          e.preventDefault();
          e.stopPropagation();
        }
      };

      window.addEventListener('beforeunload', preventRefresh);
      window.addEventListener('popstate', preventPopState);
      document.addEventListener('keydown', preventKeyDown);

      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      return () => {
        window.removeEventListener('beforeunload', preventRefresh);
        window.removeEventListener('popstate', preventPopState);
        document.removeEventListener('keydown', preventKeyDown);
      };
    }
  }, [showErrorModal, errorModalMessage]);

  // AuthContext 에러 감지 및 에러 모달 표시 (강화된 버전)
  useEffect(() => {
    // 에러 모달이 이미 표시되어 있으면 AuthContext 에러 무시
    if (showErrorModal) {
      console.log('[SIGNIN] 에러 모달이 이미 표시되어 있어 AuthContext 에러 무시');
      return undefined;
    }

    // 구글 로그인 진행 중일 때는 AuthContext 에러 무시
    if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__ || (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__) {
      if (error) {
        console.log('[SIGNIN] 구글 로그인 중 AuthContext 에러 초기화:', error);
        setError(null);
      }
      return undefined;
    }

    // 전화번호 로그인 에러는 catch 블록에서 직접 처리하므로 여기서는 제외
    if (error && !isLoggedIn && !loading && !errorProcessedRef.current) {
      console.log('[SIGNIN] AuthContext 에러 감지:', error);

      // 구글 로그인 관련 에러는 무시
      if (error.includes('Google') || error.includes('google') || error.includes('구글') ||
        error.includes('취소') || error.includes('cancelled') || error.includes('canceled')) {
        console.log('[SIGNIN] 구글 로그인 관련 에러 무시:', error);
        setError(null);
        return undefined;
      }

      // 전화번호 로그인 관련 에러가 아닌 경우만 모달 표시
      if (!error.includes('아이디') && !error.includes('비밀번호') && !error.includes('ID') && !error.includes('password')) {
        console.log('[SIGNIN] AuthContext 에러 모달 표시:', error);
        errorProcessedRef.current = true;
        showError(error);

        setTimeout(() => {
          setError(null);
        }, 100);
      } else {
        setError(null);
      }
    }
  }, [error, isLoggedIn, loading, showErrorModal, setError]);

  // 로그인 상태 변화 디버깅 (error 제외)
  useEffect(() => {
    console.log('[SIGNIN] 로그인 상태 변화:', { isLoggedIn, loading, isCheckingAuth });

    // 에러 모달이 표시되어 있으면 로그인 상태 변화로 인한 리다이렉트 방지
    if (showErrorModal && (isLoggedIn || loading)) {
      console.log('[SIGNIN] 🚫 에러 모달 표시 중 - 로그인 상태 변화 무시');
      return;
    }
  }, [isLoggedIn, loading, isCheckingAuth, showErrorModal]);

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
      setFormErrors(prevErrors => ({ ...prevErrors, phoneNumber: '숫자만 입력 가능합니다.' }));
    } else {
      setFormErrors(prevErrors => ({ ...prevErrors, phoneNumber: '' }));
    }
  };

  // Apple ID SDK 초기화 함수 (관대한 버전)
  const initializeAppleID = () => {
    try {
      if ((window as any).AppleID && (window as any).AppleID.auth) {
        console.log('🍎 [APPLE LOGIN] Apple ID SDK 초기화 시작');

        // Apple ID SDK 초기화
        (window as any).AppleID.auth.init({
          clientId: 'com.dmonster.smap.web', // 웹용 클라이언트 ID
          scope: 'name email',
          redirectURI: window.location.origin + '/signin',
          state: 'apple-signin-' + Date.now(),
          usePopup: true
        });

        console.log('🍎 [APPLE LOGIN] Apple ID SDK 초기화 완료');
        return true;
      }

      // SDK가 없어도 true 반환 (관대한 처리)
      console.log('🍎 [APPLE LOGIN] Apple ID SDK가 없지만 통과시킴');
      return true;
    } catch (error) {
      console.error('🍎 [APPLE LOGIN] Apple ID SDK 초기화 오류, 하지만 통과시킴:', error);
      // 오류가 발생해도 true 반환 (관대한 처리)
      return true;
    }
  };

  // Apple 로그인 상태 추적
  const [appleLoginAttempts, setAppleLoginAttempts] = useState(0);
  const [lastAppleLoginError, setLastAppleLoginError] = useState<string | null>(null);

  // Apple 로그인 핸들러 (iPad 호환성 개선)
  const handleAppleSignIn = async () => {
    console.log('🍎 [APPLE LOGIN] Apple 로그인 시작 (시도 횟수:', appleLoginAttempts + 1, ')');

    // 이미 로딩 중이면 중복 호출 방지
    if (isLoading) {
      console.log('🍎 [APPLE LOGIN] 이미 로딩 중, 중복 호출 무시');
      return;
    }

    // 이전 오류가 있으면 정리
    if (lastAppleLoginError) {
      setLastAppleLoginError(null);
      setError(null);
    }

    setIsLoading(true);
    setError(null);

    try {
      // 시도 횟수 증가
      setAppleLoginAttempts(prev => prev + 1);

      // iOS WebView에서 실행 중인지 확인 (iPhone, iPad 모두 포함)
      const isIOSWebView = /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
        (window as any).webkit?.messageHandlers?.smapIos;

      // iPad Safari 브라우저에서도 Apple 로그인 시도
      const isIPadSafari = /iPad/i.test(navigator.userAgent) &&
        /Safari/i.test(navigator.userAgent) &&
        !(window as any).webkit?.messageHandlers;

      // iPad 앱 내 WebView 감지 (Safari가 아니어도 허용)
      const isIPadApp = /iPad/i.test(navigator.userAgent) &&
        (window as any).webkit?.messageHandlers;

      // Android WebView 환경 감지
      const isAndroidWebView = /Android/.test(navigator.userAgent);

      console.log('🍎 [APPLE LOGIN] 환경 감지:', {
        isIOSWebView,
        isIPadSafari,
        isIPadApp,
        isAndroidWebView,
        userAgent: navigator.userAgent,
        hasWebKit: !!(window as any).webkit,
        hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
        hasAndroid: !!(window as any).Android,
        attemptCount: appleLoginAttempts + 1
      });

      if (isIOSWebView || isIPadApp) {
        console.log('🍎 [APPLE LOGIN] iOS 앱에서 Apple 로그인 호출 (iPhone/iPad 앱)');

        // Apple 로그인 결과 처리 함수 등록 (기존 함수 제거 후 재등록)
        if ((window as any).handleAppleSignInResult) {
          delete (window as any).handleAppleSignInResult;
        }

        // 네이티브 애플 로그인 호출 - smapIos 핸들러 우선 사용
        if ((window as any).webkit?.messageHandlers?.smapIos) {
          console.log('🍎 [APPLE LOGIN] iOS smapIos 핸들러를 통한 애플 로그인 호출');
          (window as any).webkit.messageHandlers.smapIos.postMessage({
            type: 'appleSignIn',
            action: 'appleSignIn'
          });
        } else if ((window as any).webkit?.messageHandlers?.appleLogin) {
          console.log('🍎 [APPLE LOGIN] iOS appleLogin 핸들러를 통한 애플 로그인 호출');
          (window as any).webkit.messageHandlers.appleLogin.postMessage({
            action: 'login'
          });
        } else {
          console.error('🍎 [APPLE LOGIN] iOS 네이티브 애플 로그인 핸들러를 찾을 수 없음');
          setError('애플 로그인을 사용할 수 없습니다.');
          setIsLoading(false);
          return;
        }

        // 애플 로그인 결과 처리 콜백 함수 등록
        console.log('🍎 [APPLE LOGIN] Apple 로그인 결과 처리 함수 등록');
        (window as any).handleAppleSignInResult = async (result: any) => {
          console.log('🍎 [APPLE LOGIN] Apple 로그인 결과 수신:', result);

          try {
            if (result.success) {
              // Apple 로그인 성공 - 서버로 전송
              const response = await fetch('/api/auth/apple-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userIdentifier: result.userIdentifier,
                  userName: result.userName,
                  email: result.email,
                  identityToken: result.identityToken,
                  authorizationCode: result.authorizationCode
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Apple 로그인에 실패했습니다.');
              }

              if (data.success && data.data) {
                if (data.data.isNewUser) {
                  // 신규 회원 - register 페이지로 이동
                  const fallbackEmail = (result?.email && result.email.includes('@'))
                    ? result.email
                    : `apple_${String(result?.userIdentifier || '').slice(0, 8)}@privaterelay.appleid.com`;

                  // Apple은 최초 승인 시에만 이름(fullName/givenName/familyName)을 제공할 수 있음
                  const providedGivenName = (result as any)?.givenName || (result as any)?.given_name || null;
                  const providedFamilyName = (result as any)?.familyName || (result as any)?.family_name || null;
                  const providedUserName = (result as any)?.userName || (result as any)?.fullName || null;

                  // 표시용 이름 구성: userName > "given family" > (없으면 공백)
                  const constructedDisplayName = providedUserName
                    ? String(providedUserName)
                    : (providedGivenName || providedFamilyName)
                      ? `${providedGivenName ? String(providedGivenName) : ''}${providedGivenName && providedFamilyName ? ' ' : ''}${providedFamilyName ? String(providedFamilyName) : ''}`.trim()
                      : '';

                  // 닉네임은 표시용 이름과 동일 기본값 사용 (없으면 공백)
                  const constructedNickname = constructedDisplayName || '';

                  const socialData = {
                    provider: 'apple',
                    userIdentifier: result.userIdentifier,
                    apple_id: result.userIdentifier,
                    email: fallbackEmail,
                    name: constructedDisplayName,
                    nickname: constructedNickname,
                    // 추가 보관: 일부 플로우에서 given/family를 별도로 사용하는 경우 대비
                    given_name: providedGivenName || undefined,
                    family_name: providedFamilyName || undefined
                  };

                  localStorage.setItem('socialLoginData', JSON.stringify(socialData));

                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/register?social=apple');
                } else {
                  // 기존 회원 - 로그인 처리
                  const authService = await import('@/services/authService');
                  if (data.data.token) {
                    authService.default.setToken(data.data.token);
                  }
                  authService.default.setUserData(data.data.user);

                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  console.log('🍎 Apple 로그인 성공:', data.data.user);
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/home');
                }
              } else {
                throw new Error(data.message || 'Apple 로그인에 실패했습니다.');
              }
            } else {
              throw new Error(result.error || 'Apple 로그인이 취소되었습니다.');
            }
          } catch (err: any) {
            console.error('🍎 [APPLE LOGIN] 처리 오류:', err);
            const errorMessage = `Apple 로그인 중 오류가 발생했습니다: ${err.message}`;
            setError(errorMessage);
            setLastAppleLoginError(errorMessage);
          } finally {
            setIsLoading(false);
            // 결과 처리 함수 정리
            delete (window as any).handleAppleSignInResult;
          }
        };

        // iOS Native Apple 로그인 호출은 위에서 이미 처리했으므로 여기서는 불필요
        console.log('🍎 [APPLE LOGIN] iOS 네이티브 호출 완료, 결과 대기 중...');

      } else if (isAndroidWebView) {
        console.log('🍎 [APPLE LOGIN] Android WebView에서 Apple 로그인 호출');

        // Android 네이티브 애플 로그인 호출
        if ((window as any).Android && (window as any).Android.appleLogin) {
          console.log('🍎 [APPLE LOGIN] Android 네이티브 애플 로그인 호출');
          (window as any).Android.appleLogin();
        } else {
          console.error('🍎 [APPLE LOGIN] Android 네이티브 애플 로그인 핸들러를 찾을 수 없음');
          setError('애플 로그인을 사용할 수 없습니다.');
          setIsLoading(false);
          return;
        }

        // Android 환경에서는 네이티브 콜백을 통해 결과를 받으므로 여기서 함수 종료
        console.log('🍎 [APPLE LOGIN] Android 네이티브 호출 완료, 콜백 대기');
        return;

      } else if (isIPadSafari) {
        // iPad Safari에서 Apple 로그인 시도
        console.log('🍎 [APPLE LOGIN] iPad Safari에서 Apple 로그인 시도');

        try {
          // Apple 로그인 SDK가 로드되어 있는지 확인
          if ((window as any).AppleID && (window as any).AppleID.auth) {
            console.log('🍎 [APPLE LOGIN] Apple ID SDK 발견, iPad Safari 로그인 시도');

            // Apple ID SDK 초기화
            if (!initializeAppleID()) {
              throw new Error('Apple ID SDK 초기화에 실패했습니다.');
            }

            // Apple 로그인 요청
            const response = await (window as any).AppleID.auth.signIn();
            console.log('🍎 [APPLE LOGIN] Apple ID SDK 응답:', response);

            if (response && response.authorization) {
              // Apple 로그인 성공 - 서버로 전송
              const appleData = {
                userIdentifier: response.user,
                userName: response.fullName?.givenName || response.fullName?.familyName || '',
                email: response.email || '',
                identityToken: response.authorization.id_token,
                authorizationCode: response.authorization.code
              };

              console.log('🍎 [APPLE LOGIN] iPad Safari에서 받은 Apple 데이터:', appleData);

              // 서버로 전송
              const serverResponse = await fetch('/api/auth/apple-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(appleData),
              });

              const serverData = await serverResponse.json();

              if (!serverResponse.ok) {
                throw new Error(serverData.message || 'Apple 로그인에 실패했습니다.');
              }

              if (serverData.success && serverData.data) {
                if (serverData.data.isNewUser) {
                  // 신규 회원 - register 페이지로 이동
                  const socialData = {
                    provider: 'apple',
                    userIdentifier: appleData.userIdentifier,
                    apple_id: appleData.userIdentifier,
                    email: appleData.email || `apple_${String(appleData.userIdentifier).slice(0, 8)}@privaterelay.appleid.com`,
                    name: appleData.userName || '',
                    nickname: appleData.userName || ''
                  };

                  localStorage.setItem('socialLoginData', JSON.stringify(socialData));
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/register?social=apple');
                } else {
                  // 기존 회원 - 로그인 처리
                  const authService = await import('@/services/authService');
                  if (serverData.data.token) {
                    authService.default.setToken(serverData.data.token);
                  }
                  authService.default.setUserData(serverData.data.user);

                  console.log('🍎 Apple 로그인 성공:', serverData.data.user);
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/home');
                }
              } else {
                throw new Error(serverData.message || 'Apple 로그인에 실패했습니다.');
              }
            } else {
              throw new Error('Apple 로그인 응답이 올바르지 않습니다.');
            }
          } else {
            // Apple ID SDK가 없는 경우 - iPad Safari에서도 시도
            console.log('🍎 [APPLE LOGIN] iPad Safari에서 Apple ID SDK 로드 시도');

            // Apple ID SDK 동적 로드
            await loadAppleIDSDK();

            // 다시 시도
            if ((window as any).AppleID && (window as any).AppleID.auth) {
              console.log('🍎 [APPLE LOGIN] Apple ID SDK 동적 로드 성공, 다시 시도');

              if (!initializeAppleID()) {
                throw new Error('Apple ID SDK 초기화에 실패했습니다.');
              }

              const response = await (window as any).AppleID.auth.signIn();
              // ... 위와 동일한 처리 로직
              console.log('🍎 [APPLE LOGIN] 재시도 성공:', response);
            } else {
              throw new Error('Apple ID SDK를 로드할 수 없습니다.');
            }
          }
        } catch (appleError: any) {
          console.error('🍎 [APPLE LOGIN] iPad Safari Apple 로그인 오류:', appleError);

          let errorMessage = '';
          if (appleError.error === 'popup_closed_by_user') {
            errorMessage = 'Apple 로그인이 취소되었습니다.';
          } else if (appleError.error === 'invalid_request') {
            errorMessage = 'Apple 로그인 요청이 잘못되었습니다.';
          } else {
            errorMessage = `Apple 로그인 중 오류가 발생했습니다: ${appleError.message || appleError.error || '알 수 없는 오류'}`;
          }

          setError(errorMessage);
          setLastAppleLoginError(errorMessage);
          setIsLoading(false);
        }

      } else {
        // iPad/iOS 환경에서 Apple 로그인 시도 (제한 없이 통과)
        console.log('🍎 [APPLE LOGIN] iPad/iOS 환경에서 Apple 로그인 시도 (제한 없이 허용)');

        // iOS 환경에서는 우선 네이티브 메시지 핸들러로 시도 (이미 위에서 처리됨)
        console.log('🍎 [APPLE LOGIN] iOS/iPad 환경 - 웹 SDK 폴백 시도');

        (window as any).handleAppleSignInResult = async (result: any) => {
          console.log('🍎 [APPLE LOGIN] iOS Apple 로그인 결과:', result);

          try {
            if (result.success) {
              // Apple 로그인 성공 - 서버로 전송하여 제대로 처리
              console.log('🍎 [APPLE LOGIN] iOS Apple 로그인 성공, 서버 처리 시작');

              const response = await fetch('/api/auth/apple-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userIdentifier: result.userIdentifier,
                  userName: result.userName,
                  email: result.email,
                  identityToken: result.identityToken,
                  authorizationCode: result.authorizationCode
                }),
              });

              const data = await response.json();
              console.log('🍎 [APPLE LOGIN] 서버 응답:', data);

              if (!response.ok) {
                throw new Error(data.message || 'Apple 로그인에 실패했습니다.');
              }

              if (data.success && data.data) {
                if (data.data.isNewUser) {
                  // 신규 회원 - register 페이지로 이동
                  const fallbackEmail = (result?.email && result.email.includes('@'))
                    ? result.email
                    : `apple_${String(result?.userIdentifier || '').slice(0, 8)}@privaterelay.appleid.com`;

                  const socialData = {
                    provider: 'apple',
                    userIdentifier: result.userIdentifier,
                    apple_id: result.userIdentifier,
                    email: fallbackEmail,
                    name: result.userName || '',
                    nickname: result.userName || ''
                  };

                  localStorage.setItem('socialLoginData', JSON.stringify(socialData));

                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  console.log('🍎 [APPLE LOGIN] 신규 회원, 회원가입 페이지로 이동');
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/register?social=apple');
                } else {
                  // 기존 회원 - 로그인 처리
                  const authService = await import('@/services/authService');
                  if (data.data.token) {
                    authService.default.setToken(data.data.token);
                  }
                  authService.default.setUserData(data.data.user);

                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  console.log('🍎 [APPLE LOGIN] 기존 회원, 홈으로 이동');
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/home');
                }
              } else {
                throw new Error(data.message || 'Apple 로그인에 실패했습니다.');
              }
            } else {
              console.log('🍎 [APPLE LOGIN] iOS Apple 로그인 실패:', result.error);
              setError(result.error || 'Apple 로그인이 취소되었습니다.');
            }
          } catch (err: any) {
            console.error('🍎 [APPLE LOGIN] iOS 결과 처리 오류:', err);
            const errorMessage = `Apple 로그인 중 오류가 발생했습니다: ${err.message}`;
            setError(errorMessage);
            setLastAppleLoginError(errorMessage);
          } finally {
            setIsLoading(false);
            delete (window as any).handleAppleSignInResult;
          }
        };

        // 네이티브 Apple 로그인 호출
        const messageHandlers = (window as any).webkit.messageHandlers;
        if (messageHandlers.smapIos) {
          messageHandlers.smapIos.postMessage({
            type: 'appleSignIn',
            action: 'appleSignIn'
          });
          return; // 네이티브 호출 완료, 함수 종료
        } else if (messageHandlers.appleSignIn) {
          messageHandlers.appleSignIn.postMessage({
            type: 'appleSignIn',
            action: 'appleSignIn'
          });
          return; // 네이티브 호출 완료, 함수 종료
        } else {
          // 다른 메시지 핸들러로 시도
          const handlerKeys = Object.keys(messageHandlers);
          if (handlerKeys.length > 0) {
            messageHandlers[handlerKeys[0]].postMessage({
              type: 'appleSignIn',
              action: 'appleSignIn'
            });
            return; // 네이티브 호출 완료, 함수 종료
          }
        }
      }

      try {
        // Apple 로그인 SDK가 로드되어 있는지 확인
        if ((window as any).AppleID && (window as any).AppleID.auth) {
          console.log('🍎 [APPLE LOGIN] Apple ID SDK 발견, 로그인 시도');

          // Apple ID SDK 초기화
          if (!initializeAppleID()) {
            console.log('🍎 [APPLE LOGIN] Apple ID SDK 초기화 실패, 강제 진행');
            // 초기화 실패해도 강제로 계속 진행
          }

          // Apple 로그인 요청
          const response = await (window as any).AppleID.auth.signIn();
          console.log('🍎 [APPLE LOGIN] Apple ID SDK 응답:', response);

          if (response && response.authorization) {
            // Apple 로그인 성공 - 서버로 전송
            const appleData = {
              userIdentifier: response.user,
              userName: response.fullName?.givenName || response.fullName?.familyName || '',
              email: response.email || '',
              identityToken: response.authorization.id_token,
              authorizationCode: response.authorization.code
            };

            console.log('🍎 [APPLE LOGIN] 받은 Apple 데이터:', appleData);

            // 서버로 전송
            const serverResponse = await fetch('/api/auth/apple-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(appleData),
            });

            const serverData = await serverResponse.json();

            if (!serverResponse.ok) {
              throw new Error(serverData.message || 'Apple 로그인에 실패했습니다.');
            }

            if (serverData.success && serverData.data) {
              if (serverData.data.isNewUser) {
                // 신규 회원 - register 페이지로 이동
                const socialData = {
                  provider: 'apple',
                  userIdentifier: appleData.userIdentifier,
                  apple_id: appleData.userIdentifier,
                  email: appleData.email || `apple_${String(appleData.userIdentifier).slice(0, 8)}@privaterelay.appleid.com`,
                  name: appleData.userName || '',
                  nickname: appleData.userName || ''
                };

                localStorage.setItem('socialLoginData', JSON.stringify(socialData));
                // 리다이렉트 차단 해제 후 이동
                if ((window as any).__REDIRECT_CONTROL__) {
                  (window as any).__REDIRECT_CONTROL__.allowRedirects();
                }
                (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                router.push('/register?social=apple');
              } else {
                // 기존 회원 - 로그인 처리
                const authService = await import('@/services/authService');
                if (serverData.data.token) {
                  authService.default.setToken(serverData.data.token);
                }
                authService.default.setUserData(serverData.data.user);

                console.log('🍎 Apple 로그인 성공:', serverData.data.user);
                // 리다이렉트 차단 해제 후 이동
                if ((window as any).__REDIRECT_CONTROL__) {
                  (window as any).__REDIRECT_CONTROL__.allowRedirects();
                }
                (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                router.push('/home');
              }
            } else {
              throw new Error(serverData.message || 'Apple 로그인에 실패했습니다.');
            }
          } else {
            throw new Error('Apple 로그인 응답이 올바르지 않습니다.');
          }
        } else {
          // Apple ID SDK가 없는 경우 - 강제로 SDK 로드 시도
          console.log('🍎 [APPLE LOGIN] Apple ID SDK가 없음, 동적 로드 시도');

          try {
            // Apple ID SDK 동적 로드
            await loadAppleIDSDK();

            // 다시 시도
            if ((window as any).AppleID && (window as any).AppleID.auth) {
              console.log('🍎 [APPLE LOGIN] Apple ID SDK 동적 로드 성공, 재시도');

              // 초기화 시도 (실패해도 계속 진행)
              try {
                initializeAppleID();
              } catch (initError) {
                console.log('🍎 [APPLE LOGIN] 초기화 실패, 강제 진행:', initError);
              }

              const response = await (window as any).AppleID.auth.signIn();
              console.log('🍎 [APPLE LOGIN] 재시도 응답:', response);

              // 제대로 된 처리 로직
              if (response && response.authorization) {
                const appleData = {
                  userIdentifier: response.user,
                  userName: response.fullName?.givenName || response.fullName?.familyName || '',
                  email: response.email || '',
                  identityToken: response.authorization.id_token,
                  authorizationCode: response.authorization.code
                };

                // 서버로 전송
                const serverResponse = await fetch('/api/auth/apple-login', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(appleData),
                });

                const serverData = await serverResponse.json();
                console.log('🍎 [APPLE LOGIN] 재시도 서버 응답:', serverData);

                if (serverResponse.ok && serverData.success && serverData.data) {
                  // 인증 토큰 및 사용자 데이터 설정
                  const authService = await import('@/services/authService');
                  if (serverData.data.token) {
                    authService.default.setToken(serverData.data.token);
                  }
                  authService.default.setUserData(serverData.data.user);

                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  console.log('🍎 [APPLE LOGIN] 재시도 성공, 홈으로 이동');
                  // 리다이렉트 차단 해제 후 이동
                  if ((window as any).__REDIRECT_CONTROL__) {
                    (window as any).__REDIRECT_CONTROL__.allowRedirects();
                  }
                  (window as any).__BLOCK_ALL_REDIRECTS__ = false;

                  router.push('/home');
                } else {
                  console.log('🍎 [APPLE LOGIN] 재시도 서버 처리 실패');
                  setError('Apple 로그인 처리에 실패했습니다.');
                }
              }
            } else {
              // SDK 로드에 실패해도 에러 표시하지 않고 조용히 처리
              console.log('🍎 [APPLE LOGIN] SDK 로드 실패, 조용히 처리');
              setIsLoading(false);
            }
          } catch (loadError) {
            // 로드 실패해도 에러 표시하지 않고 조용히 처리
            console.log('🍎 [APPLE LOGIN] SDK 동적 로드 실패, 조용히 처리:', loadError);
            setIsLoading(false);
          }
        }
      } catch (appleError: any) {
        console.error('🍎 [APPLE LOGIN] Apple 로그인 오류:', appleError);

        let errorMessage = '';
        if (appleError.error === 'popup_closed_by_user') {
          errorMessage = 'Apple 로그인이 취소되었습니다.';
        } else if (appleError.error === 'invalid_request') {
          errorMessage = 'Apple 로그인 요청이 잘못되었습니다.';
        } else {
          errorMessage = `Apple 로그인 중 오류가 발생했습니다: ${appleError.message || appleError.error || '알 수 없는 오류'}`;
        }

        setError(errorMessage);
        setLastAppleLoginError(errorMessage);
        setIsLoading(false);
      }

      // 웹 SDK 폴백 시도
      try {
        // Apple 로그인 SDK가 로드되어 있는지 확인
        if ((window as any).AppleID && (window as any).AppleID.auth) {
          console.log('🍎 [APPLE LOGIN] Apple ID SDK 발견, 웹 SDK로 로그인 시도');
          // Apple ID SDK 초기화
          if (!initializeAppleID()) {
            console.log('🍎 [APPLE LOGIN] Apple ID SDK 초기화 실패, 강제 진행');
          }

          // Apple 로그인 요청
          const response = await (window as any).AppleID.auth.signIn();
          console.log('🍎 [APPLE LOGIN] Apple ID SDK 응답:', response);

          // 성공 처리 로직은 기존과 동일
          setIsLoading(false);
        } else {
          console.log('🍎 [APPLE LOGIN] Apple ID SDK가 없음, 조용히 처리');
          setIsLoading(false);
        }
      } catch (webSDKError: any) {
        console.log('🍎 [APPLE LOGIN] 웹 SDK 오류, 조용히 처리:', webSDKError);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('🍎 [APPLE LOGIN] 전체 오류:', err);
      const errorMessage = `Apple 로그인 중 오류가 발생했습니다: ${err.message}`;
      setError(errorMessage);
      setLastAppleLoginError(errorMessage);
      setIsLoading(false);
    }
  };

  // Apple ID SDK 동적 로드 함수
  const loadAppleIDSDK = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 이미 로드되어 있으면 즉시 반환
      if ((window as any).AppleID) {
        resolve();
        return;
      }

      // Apple ID SDK 스크립트 동적 로드
      const script = document.createElement('script');
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
      script.async = true;
      script.onload = () => {
        console.log('🍎 [APPLE LOGIN] Apple ID SDK 동적 로드 성공');
        resolve();
      };
      script.onerror = () => {
        console.error('🍎 [APPLE LOGIN] Apple ID SDK 동적 로드 실패');
        reject(new Error('Apple ID SDK 로드에 실패했습니다.'));
      };

      document.head.appendChild(script);
    });
  };

  // 전화번호 로그인 핸들러
  const handlePhoneNumberLogin = async (e: React.FormEvent) => {
    // 폼 기본 제출 동작 방지
    e.preventDefault();
    e.stopPropagation();

    console.log('[SIGNIN] 로그인 시도 시작');

    // 🚨 즉시 리다이렉트 차단 활성화 (로그인 시도 시작과 동시에)
    if ((window as any).__REDIRECT_CONTROL__) {
      (window as any).__REDIRECT_CONTROL__.forceBlock();
    }
    (window as any).__BLOCK_ALL_REDIRECTS__ = true;
    sessionStorage.setItem('block_all_redirects', 'true');
    console.log('[SIGNIN] 🚨 로그인 시도 시작과 동시에 리다이렉트 차단 활성화');

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

    // 전화번호 저장 (로그인 실패 시에도 유지하기 위해)
    const currentPhoneNumber = phoneNumber;

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
      return undefined;
    }

    try {
      console.log('[SIGNIN] AuthContext login 호출 시작');

      // 🔄 전화번호 로그인 전에 이전 계정의 모든 데이터 완전 정리
      console.log('[SIGNIN] 🔄 전화번호 로그인 전 이전 계정 데이터 정리 시작');
      try {
        authService.clearAllPreviousAccountData();
        console.log('[SIGNIN] ✅ 이전 계정 데이터 정리 완료');
      } catch (clearError) {
        console.warn('[SIGNIN] ⚠️ 이전 계정 데이터 정리 중 오류 (계속 진행):', clearError);
      }

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

      // AuthContext 상태 동기화 (로그인 성공 시)
      try {
        const userData = authService.getUserData();
        if (userData) {
          console.log('[SIGNIN] AuthContext 상태 동기화 시작:', userData.mt_name || '사용자');
          // AuthContext의 refreshAuthState 함수를 사용하여 상태 동기화
          await refreshAuthState();
          console.log('[SIGNIN] AuthContext 상태 동기화 완료');
        }
      } catch (error) {
        console.warn('[SIGNIN] AuthContext 상태 동기화 실패 (무시):', error);
      }

      // iOS 로그 전송 - 로그인 성공
      sendLogToiOS('info', '✅ 전화번호 로그인 성공', {
        timestamp: new Date().toISOString(),
        userInfo: {
          hasUserData: !!authService.getUserData(),
          hasToken: !!authService.getToken()
        }
      });

      // 로그인 성공 햅틱 피드백
      triggerHapticFeedback(HapticFeedbackType.SUCCESS);
      console.log('🎮 [SIGNIN] 전화번호 로그인 성공 햅틱 피드백 실행');

      // iOS 로그 전송 - 로그인 성공
      sendLogToiOS('info', '✅ 전화번호 로그인 성공 - 즉시 홈으로 이동', {
        timestamp: new Date().toISOString(),
        redirectMethod: 'router.replace',
        targetPage: '/home'
      });

      // 🚨 로그인 성공 시에만 리다이렉트 차단 해제
      if ((window as any).__REDIRECT_CONTROL__) {
        (window as any).__REDIRECT_CONTROL__.allowRedirects();
      }
      (window as any).__BLOCK_ALL_REDIRECTS__ = false;
      sessionStorage.removeItem('block_all_redirects');
      console.log('[SIGNIN] ✅ 로그인 성공 - 리다이렉트 차단 해제');

      // 즉시 홈으로 이동 (백그라운드에서 데이터 로딩)
      // 홈 페이지 초기화 지연을 위한 플래그 설정
      if (typeof window !== 'undefined') {
        (window as any).__DELAY_HOME_INIT__ = true;
        setTimeout(() => {
          delete (window as any).__DELAY_HOME_INIT__;
        }, 2000); // 2초 후 초기화 허용
      }

      // FCM 토큰 체크 및 업데이트 (백그라운드에서 실행)
      setTimeout(async () => {
        try {
          console.log('[SIGNIN] 🔔 전화번호 로그인 후 FCM 토큰 강제 업데이트 시작');
          // 🚨 Firebase 토큰 생성 로직 제거 - 네이티브에서 관리
          console.log('[SIGNIN] 🚨 Firebase 토큰 생성 로직 제거됨 - 네이티브에서 FCM 토큰 관리');
          console.log('[SIGNIN] 🚫 FCM 토큰 업데이트 로직 비활성화됨 - 네이티브에서 관리');
        } catch (error) {
          console.error('[SIGNIN] ❌ FCM 처리 중 오류:', error);
        }
      }, 1000); // 전화번호 로그인 후 1초 지연

      router.replace('/home');

      // 백그라운드에서 그룹 가입 처리만 수행 (AuthContext는 이미 동기화됨)
      setTimeout(async () => {
        try {
          // 그룹 가입 처리
          const groupJoinResult = await handlePendingGroupJoin();
          if (groupJoinResult) {
            console.log('[SIGNIN] ✅ 백그라운드 그룹 가입 처리 완료');
          }
        } catch (error) {
          console.error('[SIGNIN] ❌ 백그라운드 처리 중 오류:', error);
        }
      }, 100);

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
      if (errorMessage.includes('네트워크') || errorMessage.includes('network') || errorMessage.includes('연결') || errorMessage.includes('timeout')) {
        errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
      } else if (errorMessage.includes('서버') || errorMessage.includes('server') || errorMessage.includes('오류') || errorMessage.includes('error')) {
        errorMessage = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      } else {
        // 로그인 실패의 경우 (아이디/비밀번호 오류 포함) - 구체적인 원인을 알려주지 않음
        errorMessage = '전화번호 또는 비밀번호를 확인해주세요.';
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
      triggerHapticFeedback(HapticFeedbackType.ERROR);
      console.log('🎮 [SIGNIN] 전화번호 로그인 실패 햅틱 피드백 실행');

      try {
        // 로그인 실패 시 전화번호 유지 (강화된 버전)
        console.log('[SIGNIN] 🔄 로그인 실패 시 전화번호 복원:', currentPhoneNumber);
        setPhoneNumber(currentPhoneNumber);

        // sessionStorage에 전화번호 저장 (페이지 새로고침 시에도 유지)
        sessionStorage.setItem('signin_phone_number', currentPhoneNumber);
        console.log('[SIGNIN] 💾 sessionStorage에 전화번호 저장:', currentPhoneNumber);

        // 전화번호 복원 확인
        setTimeout(() => {
          console.log('[SIGNIN] 🔍 전화번호 복원 확인:', phoneNumber);
          // DOM에서도 직접 확인
          const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
          if (phoneInput) {
            console.log('[SIGNIN] 🔍 DOM 전화번호 입력 필드 값:', phoneInput.value);
            if (!phoneInput.value && currentPhoneNumber) {
              phoneInput.value = currentPhoneNumber;
              console.log('[SIGNIN] 🔄 DOM 전화번호 입력 필드 복원:', currentPhoneNumber);
            }
          }
        }, 100);

        showError(errorMessage);
        console.log('[SIGNIN] ✅ showError 함수 호출 완료');
        sendLogToiOS('info', '✅ 에러 모달 표시 완료', {
          timestamp: new Date().toISOString(),
          errorMessage,
          phoneNumberRestored: currentPhoneNumber
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

  // 에러 모달 닫기 (단순화된 버전)
  const closeErrorModal = () => {
    console.log('[SIGNIN] 🔄 에러 모달 닫기 시작');

    // 모달 닫기
    setShowErrorModal(false);
    setErrorModalMessage('');

    // 로딩 상태 해제
    setIsLoading(false);

    // 전화번호는 유지하고 비밀번호만 초기화
    console.log('[SIGNIN] 🔄 에러 모달 닫기 - 전화번호 유지, 비밀번호 초기화');
    setPassword('');

    // 전화번호 입력 필드에 포커스
    setTimeout(() => {
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();

        // 전화번호가 비어있다면 복원
        if (!phoneInput.value && phoneNumber) {
          phoneInput.value = phoneNumber;
        }
      }
    }, 100);

    console.log('[SIGNIN] ✅ 에러 모달 닫기 완료');
  };

  // 🚨 에러 시 홈으로 이동하는 함수
  const handleErrorAndGoHome = () => {
    console.log('[SIGNIN] 에러 처리 후 홈으로 이동');
    closeErrorModal();
    // 카카오 에러 복구 함수 제거됨
  };



  // 에러 표시 헬퍼 함수 (단순화된 버전)
  const showError = (message: string) => {
    console.log('[SIGNIN] showError 함수 시작:', message);

    // 로딩 상태 해제
    setIsLoading(false);

    // 🔥 에러 모달 플래그 설정
    (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;

    // 에러 모달 표시
    setErrorModalMessage(message);
    setShowErrorModal(true);

    console.log('[SIGNIN] ✅ showError 함수 완료');
  };

  // iOS bridge 로드 대기 함수
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

  // 그룹 가입 처리 함수
  const handlePendingGroupJoin = async () => {
    try {
      console.log('[SIGNIN] 그룹 가입 처리 함수 시작');

      const pendingGroupJoin = localStorage.getItem('pendingGroupJoin');
      if (!pendingGroupJoin) {
        console.log('[SIGNIN] 대기 중인 그룹 가입 없음');
        return false;
      }

      const groupData = JSON.parse(pendingGroupJoin);
      const { groupId, groupTitle, timestamp } = groupData;

      console.log('[SIGNIN] localStorage에서 그룹 데이터 확인:', {
        groupId,
        groupTitle,
        timestamp: new Date(timestamp).toISOString(),
        age: Date.now() - timestamp
      });

      // 24시간 이내의 요청만 처리 (만료된 요청 방지)
      const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
      if (isExpired) {
        console.log('[SIGNIN] 만료된 그룹 가입 요청, 삭제 (24시간 초과)');
        localStorage.removeItem('pendingGroupJoin');
        return false;
      }

      console.log('[SIGNIN] 대기 중인 그룹 가입 처리 시작:', {
        groupId,
        groupTitle,
        groupIdType: typeof groupId,
        parsedGroupId: parseInt(groupId)
      });

      // 백엔드 로그를 위한 API 호출 전 로깅
      console.log('[SIGNIN] 그룹 가입 API 호출 시작 - groupId:', parseInt(groupId));

      // 그룹 가입 API 호출
      const result = await groupService.joinGroup(parseInt(groupId));

      console.log('[SIGNIN] 그룹 가입 API 호출 완료:', result);

      // 성공 시 localStorage에서 제거
      localStorage.removeItem('pendingGroupJoin');
      console.log('[SIGNIN] localStorage에서 그룹 데이터 제거 완료');

      console.log(`[SIGNIN] 그룹 "${groupTitle}" (ID: ${groupId}) 가입 완료!`);

      // 성공 알림 (선택사항)
      showError(`그룹 "${groupTitle}"에 성공적으로 가입되었습니다!`);

      return true;

    } catch (error) {
      console.error('[SIGNIN] 자동 그룹 가입 실패:', error);
      console.error('[SIGNIN] 에러 상세 정보:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });

      // 실패해도 localStorage는 정리
      localStorage.removeItem('pendingGroupJoin');
      console.log('[SIGNIN] 에러 발생으로 localStorage에서 그룹 데이터 제거');

      // 에러 메시지 표시
      showError('그룹 가입 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');

      return false;
    }
  };

  // Google 로그인 핸들러 (안전한 버전)
  const handleGoogleLogin = async () => {
    console.log('🎯 [GOOGLE LOGIN] 구글 로그인 시작');

    // 상태 체크
    if (isLoading) {
      console.log('🚫 [GOOGLE LOGIN] 이미 로딩 중');
      return;
    }

    if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
      console.log('🚫 [GOOGLE LOGIN] 이미 진행 중');
      return;
    }

    // 이전 로그인 시도 정리
    if ((window as any).__PAGE_FROZEN__) {
      console.log('[GOOGLE LOGIN] 이전 로그인 시도 정리 중...');
      try {
        unfreezePage();
      } catch (error) {
        console.warn('[GOOGLE LOGIN] 이전 로그인 정리 실패:', error);
      }
    }

    // 🔄 Google 로그인 전에 이전 계정의 모든 데이터 완전 정리
    console.log('[GOOGLE LOGIN] 🔄 Google 로그인 전 이전 계정 데이터 정리 시작');
    try {
      authService.clearAllPreviousAccountData();
      console.log('[GOOGLE LOGIN] ✅ 이전 계정 데이터 정리 완료');
    } catch (clearError) {
      console.warn('[GOOGLE LOGIN] ⚠️ 이전 계정 데이터 정리 중 오류 (계속 진행):', clearError);
    }

    setIsLoading(true);
    setError(null);
    setApiError(''); // 이전 에러 메시지 제거

    // 진행 중 플래그 설정
    (window as any).__GOOGLE_LOGIN_IN_PROGRESS__ = true;

    // 간단한 페이지 고정
    try {
      freezePage();
    } catch (error) {
      console.warn('[GOOGLE LOGIN] 페이지 고정 실패:', error);
    }

    // 간단한 네비게이션 차단
    const preventBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
        console.log('🚫 [BEFOREUNLOAD BLOCK] 구글 로그인 중 - 페이지 이탈 차단');
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', preventBeforeUnload);

    // 안드로이드 네이티브 구글 로그인 확인
    if (isAndroidWebView) {
      console.log('[GOOGLE LOGIN] 안드로이드 환경 감지');
      console.log('[GOOGLE LOGIN] AndroidGoogleSignIn 객체 확인:', (window as any).AndroidGoogleSignIn);
      console.log('[GOOGLE LOGIN] 인터페이스 준비 상태:', (window as any).__ANDROID_GOOGLE_SIGNIN_READY__);

      // 인터페이스 준비 상태 확인
      if (!(window as any).__ANDROID_GOOGLE_SIGNIN_READY__) {
        console.error('[GOOGLE LOGIN] AndroidGoogleSignIn 인터페이스가 아직 준비되지 않음');
        setError('Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요.');
        setIsLoading(false);
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
        try {
          unfreezePage();
        } catch (unfreezeError) {
          console.warn('[GOOGLE LOGIN] 인터페이스 미준비 시 페이지 고정 해제 실패:', unfreezeError);
        }
        window.removeEventListener('beforeunload', preventBeforeUnload);
        return;
      }

      // 함수 존재 여부를 더 정확히 확인
      const androidGoogleSignIn = (window as any).AndroidGoogleSignIn;
      if (androidGoogleSignIn && typeof androidGoogleSignIn.signIn === 'function') {
        try {
          console.log('[GOOGLE LOGIN] signIn 함수 호출 시작');
          androidGoogleSignIn.signIn();
          console.log('[GOOGLE LOGIN] 안드로이드 네이티브 구글 로그인 시작됨');
          return; // 안드로이드에서는 네이티브 로그인만 사용
        } catch (error: any) {
          console.error('[GOOGLE LOGIN] 안드로이드 네이티브 구글 로그인 실패:', error);
          console.error('[GOOGLE LOGIN] 오류 상세:', error?.message);
          console.error('[GOOGLE LOGIN] 오류 스택:', error?.stack);

          // 🚨 안드로이드 Google Sign-In 실패 상세 분석
          console.log('🚨 [ANDROID GOOGLE SIGN-IN] 실패 분석:');
          console.log('  - 에러 타입:', typeof error);
          console.log('  - 에러 이름:', error?.name);
          console.log('  - 에러 메시지:', error?.message);
          console.log('  - 에러 코드:', error?.code);
          console.log('  - User Agent:', navigator.userAgent);
          console.log('  - AndroidGoogleSignIn 객체:', (window as any).AndroidGoogleSignIn);
          console.log('  - 인터페이스 준비 상태:', (window as any).__ANDROID_GOOGLE_SIGNIN_READY__);

          // 안드로이드에서 네이티브 로그인 실패 시 에러 표시
          setError('Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요.');
          setIsLoading(false);
          delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
          try {
            unfreezePage();
          } catch (unfreezeError) {
            console.warn('[GOOGLE LOGIN] 안드로이드 실패 시 페이지 고정 해제 실패:', unfreezeError);
          }
          window.removeEventListener('beforeunload', preventBeforeUnload);
          return;
        }
      } else {
        console.error('[GOOGLE LOGIN] AndroidGoogleSignIn.signIn 함수가 존재하지 않음');
        setError('Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요.');
        setIsLoading(false);
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
        try {
          unfreezePage();
        } catch (unfreezeError) {
          console.warn('[GOOGLE LOGIN] 안드로이드 함수 없음 시 페이지 고정 해제 실패:', unfreezeError);
        }
        window.removeEventListener('beforeunload', preventBeforeUnload);
        return;
      }
    } else {
      console.log('[GOOGLE LOGIN] 안드로이드 네이티브 인터페이스 확인:', {
        isAndroidWebView,
        hasAndroidGoogleSignIn: !!(window as any).AndroidGoogleSignIn,
        androidGoogleSignInType: typeof (window as any).AndroidGoogleSignIn
      });

      // 안드로이드에서 네이티브 인터페이스가 없으면 에러 표시
      if (isAndroidWebView) {
        setError('Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요.');
        setIsLoading(false);
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
        try {
          unfreezePage();
        } catch (unfreezeError) {
          console.warn('[GOOGLE LOGIN] 안드로이드 인터페이스 없음 시 페이지 고정 해제 실패:', unfreezeError);
        }
        window.removeEventListener('beforeunload', preventBeforeUnload);
        return;
      }
    }

    // iOS 네이티브에 구글 로그인 시작 알림
    if ((window as any).webkit?.messageHandlers?.smapIos) {
      console.log('[GOOGLE LOGIN] iOS 네이티브 구글 로그인 호출');
      (window as any).webkit.messageHandlers.smapIos.postMessage({
        type: 'googleSignIn',
        param: '',
        timestamp: Date.now()
      });
    } else if (!isAndroidWebView) {
      // 안드로이드가 아닌 경우에만 웹 SDK 사용
      console.log('[GOOGLE LOGIN] iOS 네이티브 핸들러 없음, 웹 SDK로 폴백');
      try {
        await handleGoogleSDKLogin();
      } catch (error) {
        console.error('[GOOGLE LOGIN] 웹 SDK 로그인 실패:', error);
        setError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
        setIsLoading(false);
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
        try {
          unfreezePage();
        } catch (unfreezeError) {
          console.warn('[GOOGLE LOGIN] 웹 SDK 실패 시 페이지 고정 해제 실패:', unfreezeError);
        }
        window.removeEventListener('beforeunload', preventBeforeUnload);
      }
      return;
    } else {
      // 안드로이드에서 네이티브 인터페이스가 없으면 에러 표시
      console.log('[GOOGLE LOGIN] 안드로이드에서 네이티브 인터페이스 없음');
      setError('Google 로그인 설정 오류입니다. 앱을 다시 시작해주세요.');
      setIsLoading(false);
      delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
      try {
        unfreezePage();
      } catch (unfreezeError) {
        console.warn('[GOOGLE LOGIN] 안드로이드 인터페이스 없음 시 페이지 고정 해제 실패:', unfreezeError);
      }
      window.removeEventListener('beforeunload', preventBeforeUnload);
      return;
    }

    // 15초 후 자동 해제
    setTimeout(() => {
      if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
        console.log('[GOOGLE LOGIN] 타임아웃 - 차단 해제');

        // 이벤트 리스너 제거
        window.removeEventListener('beforeunload', preventBeforeUnload);

        // 페이지 고정 해제
        try {
          unfreezePage();
        } catch (error) {
          console.warn('[GOOGLE LOGIN] 타임아웃 시 페이지 고정 해제 실패:', error);
        }

        // 플래그 해제
        delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;

        setIsLoading(false);

        // 타임아웃 시 간단한 메시지 표시
        setApiError('로그인 시간이 초과되었습니다. 다시 시도해주세요.');
        setTimeout(() => {
          setApiError('');
        }, 3000);
      }
    }, 15000);
  };

  // 🚨 웹에서 직접 MessageHandler 생성 시도
  const forceCreateMessageHandlers = () => {
    console.log('🚨 [FORCE CREATE] 웹에서 MessageHandler 강제 생성 시도');

    try {
      const webkit = (window as any).webkit;

      if (!webkit) {
        console.log('🚨 [FORCE CREATE] WebKit 객체 생성 시도');
        (window as any).webkit = {};
      }

      if (!webkit.messageHandlers) {
        console.log('🚨 [FORCE CREATE] messageHandlers 객체 생성 시도');
        webkit.messageHandlers = {};

        // 가짜 핸들러들 생성
        const handlerNames = ['smapIos', 'iosHandler', 'hapticHandler', 'messageHandler'];

        handlerNames.forEach(handlerName => {
          webkit.messageHandlers[handlerName] = {
            postMessage: (message: any) => {
              console.log(`📱 [FAKE HANDLER] ${handlerName} 메시지 수신:`, message);

              // 구글 로그인 메시지 처리
              if (message.type === 'googleSignIn') {
                console.log('🎯 [FAKE HANDLER] 구글 로그인 메시지 감지, 웹 SDK로 전환');
                setTimeout(() => {
                  // 웹 SDK 로그인 강제 실행
                  handleGoogleSDKLogin();
                }, 100);
              }

              // 햅틱 메시지 처리 (로그만)
              if (message.type === 'haptic') {
                console.log('🎮 [FAKE HANDLER] 햅틱 메시지 감지:', message.param);
              }
            }
          };
        });

        console.log('✅ [FORCE CREATE] 가짜 MessageHandler 생성 완료');
        console.log('📱 [FORCE CREATE] 생성된 핸들러들:', Object.keys(webkit.messageHandlers));

        return true;
      }
    } catch (error) {
      console.error('❌ [FORCE CREATE] MessageHandler 생성 실패:', error);
      return false;
    }
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
      window.fetch = function (url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
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

          xhr.onreadystatechange = function () {
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

          xhr.onerror = function () {
            reject(new Error('Network request failed'));
          };

          xhr.ontimeout = function () {
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

  // 🔍 강제 핸들러 확인 함수
  const forceCheckHandlers = () => {
    console.log('🔍 [FORCE CHECK] 상세 핸들러 확인 시작');

    // WebKit 객체 확인
    const webkit = (window as any).webkit;
    console.log('🔍 [FORCE CHECK] WebKit 객체:', webkit);
    console.log('🔍 [FORCE CHECK] WebKit 타입:', typeof webkit);

    // messageHandlers 확인
    const messageHandlers = webkit?.messageHandlers;
    console.log('🔍 [FORCE CHECK] messageHandlers:', messageHandlers);
    console.log('🔍 [FORCE CHECK] messageHandlers 타입:', typeof messageHandlers);

    if (!messageHandlers) {
      console.warn('⚠️ [FORCE CHECK] messageHandlers 객체 없음 (개발 환경에서는 정상)');
      return undefined;
    }

    // 각 핸들러 테스트
    const handlerNames = ['smapIos', 'iosHandler', 'hapticHandler', 'messageHandler'];

    handlerNames.forEach(handlerName => {
      try {
        const handler = messageHandlers[handlerName];
        if (handler && typeof handler.postMessage === 'function') {
          console.log(`✅ [FORCE CHECK] ${handlerName} 핸들러 정상`);
        } else {
          console.warn(`⚠️ [FORCE CHECK] ${handlerName} postMessage 함수 없음 (개발 환경에서는 정상)`);
        }
      } catch (error) {
        console.warn(`⚠️ [FORCE CHECK] ${handlerName} 테스트 실패 (개발 환경에서는 정상):`, error);
      }
    });

    console.log('🔍 [FORCE CHECK] 상세 핸들러 확인 완료');
  };

  // 🔍 카카오 SDK 상태 확인 함수
  // 카카오 SDK 확인 함수 제거

  // 🔍 테스트 함수들 등록
  const registerTestFunctions = () => {
    console.log('🔍 [TEST FUNCTIONS] 테스트 함수들 등록');

    // 전역 테스트 함수들
    (window as any).__SMAP_TEST_HAPTIC__ = testHapticFeedback;
    (window as any).__SMAP_TEST_HANDLER_HAPTIC__ = testHapticWithHandler;
    (window as any).__SMAP_ENABLE_SIMULATOR__ = enableSimulatorMode;

    console.log('✅ [TEST FUNCTIONS] 테스트 함수들 등록 완료');
  };

  // 🔍 카카오 에러 복구 함수
  // 카카오 에러 복구 함수 제거

  // 🚨 페이지 완전 고정 함수 (개선된 버전)
  const freezePage = () => {
    console.log('[PAGE FREEZE] 페이지 완전 고정 시작');

    // 이미 고정되어 있으면 중복 실행 방지
    if ((window as any).__PAGE_FROZEN__) {
      console.log('[PAGE FREEZE] 이미 고정되어 있음, 중복 실행 방지');
      return;
    }

    // 현재 스크롤 위치 저장
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    (window as any).__SAVED_SCROLL_POSITION__ = scrollY;

    // 현재 뷰포트 높이 저장
    const viewportHeight = window.innerHeight;
    (window as any).__SAVED_VIEWPORT_HEIGHT__ = viewportHeight;

    // 스크롤 방지
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // 페이지 위치 고정 (스크롤 위치 고려하여 정확한 위치 계산)
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = `${viewportHeight}px`;
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';

    // 추가 안정성을 위한 CSS
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    (document.body.style as any).webkitTouchCallout = 'none';
    (document.body.style as any).webkitTapHighlightColor = 'transparent';

    // iOS Safari 특별 처리
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    document.body.style.webkitTransform = 'translateZ(0)';

    // React 상태 변화 방지
    blockAllEffectsRef.current = true;
    isRedirectingRef.current = false;
    preventRemountRef.current = true;

    // 전역 고정 플래그 설정
    (window as any).__PAGE_FROZEN__ = true;

    console.log('[PAGE FREEZE] 페이지 고정 완료, 스크롤 위치 저장:', scrollY, '뷰포트 높이:', viewportHeight);
  };

  // 🚨 페이지 고정 해제 함수 (개선된 버전)
  const unfreezePage = () => {
    console.log('[PAGE FREEZE] 페이지 고정 해제 시작');

    // 고정되어 있지 않으면 해제하지 않음
    if (!(window as any).__PAGE_FROZEN__) {
      console.log('[PAGE FREEZE] 고정되어 있지 않음, 해제 생략');
      return;
    }

    // 저장된 스크롤 위치 복원
    const savedScrollY = (window as any).__SAVED_SCROLL_POSITION__ || 0;
    const savedViewportHeight = (window as any).__SAVED_VIEWPORT_HEIGHT__ || window.innerHeight;

    // 스타일 복원
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.touchAction = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    (document.body.style as any).webkitTouchCallout = '';
    (document.body.style as any).webkitTapHighlightColor = '';
    (document.body.style as any).webkitOverflowScrolling = '';
    document.body.style.webkitTransform = '';

    // React 상태 변화 허용
    blockAllEffectsRef.current = false;
    preventRemountRef.current = false;

    // 전역 고정 플래그 해제
    delete (window as any).__PAGE_FROZEN__;

    // 스크롤 위치 복원 (안전하게)
    setTimeout(() => {
      try {
        window.scrollTo({
          top: savedScrollY,
          left: 0,
          behavior: 'auto'
        });
        console.log('[PAGE FREEZE] 스크롤 위치 복원 완료:', savedScrollY);
      } catch (error) {
        console.warn('[PAGE FREEZE] 스크롤 위치 복원 실패:', error);
        // 대체 방법으로 복원
        window.scrollTo(0, savedScrollY);
      }
    }, 10);

    // 저장된 데이터 제거
    delete (window as any).__SAVED_SCROLL_POSITION__;
    delete (window as any).__SAVED_VIEWPORT_HEIGHT__;

    console.log('[PAGE FREEZE] 페이지 고정 해제 완료');
  };

  // 페이지 스크롤 방지 및 고정
  useEffect(() => {
    // body 스타일 설정으로 스크롤 방지
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    // cleanup 함수
    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // 🔥 iOS 환경에서 네이티브 Google Sign-In 시도 (자동 실행 비활성화)
  /*
  if (isIOSWebView && !isAndroidWebView) {
    console.log('🍎 [GOOGLE LOGIN] iOS 환경에서 네이티브 Google Sign-In 시도');
    
    try {
      // iOS 네이티브 Google Sign-In 호출
      if ((window as any).webkit?.messageHandlers?.smapIos) {
        console.log('📱 [GOOGLE LOGIN] iOS 네이티브 Google Sign-In 호출');
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'googleSignIn',
          param: '',
          timestamp: Date.now(),
          source: 'ios_native'
        });
        
        console.log('✅ [GOOGLE LOGIN] iOS 네이티브 호출 성공, 콜백 대기 중...');
        
        // iOS 환경에서 2초 후 웹 SDK 폴백
        setTimeout(() => {
          console.log('🔍 [IOS FALLBACK] iOS Google Sign-In 응답 확인 중...');
          
          // iOS에서 응답이 없으면 웹 SDK로 폴백
          console.log('⚠️ [IOS FALLBACK] iOS 네이티브 응답 없음, 웹 SDK로 폴백');
          handleGoogleSDKLogin();
        }, 2000);
        
        return undefined;
      } else {
        console.log('⚠️ [IOS FALLBACK] iOS smapIos 핸들러 없음, 웹 SDK로 폴백');
        handleGoogleSDKLogin();
        return undefined;
      }
    } catch (error) {
      console.error('❌ [GOOGLE LOGIN] iOS 네이티브 호출 실패:', error);
      console.log('🔄 [IOS FALLBACK] iOS 실패로 웹 SDK로 폴백');
      handleGoogleSDKLogin();
      return undefined;
    }
  }
  */

  return (
    <>
      {/* 스플래시 화면 - 모든 콘텐츠를 가림 */}
      {showSplash && (
        <SplashScreen
          onComplete={() => setShowSplash(false)}
          duration={2500}
        />
      )}

      {/* 스플래시가 끝난 후에만 배경과 로그인 영역 표시 */}
      {!showSplash && (
        <>
          {/* WebKit 호환 배경 레이어 */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
          }}>
            <motion.div
              style={{
                width: '200vw',
                height: '100vh',
                background: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe)',
                backgroundSize: '200% 100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                WebkitPerspective: '1000px',
                perspective: '1000px',
              }}
              animate={{ x: ['0vw', '-100vw', '0vw'] }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'linear',
                type: 'tween'
              }}
            />
          </div>

          {/* 메인 콘텐츠 컨테이너 */}
          <motion.div
            className="min-h-screen flex flex-col items-center justify-center py-6 px-4 sm:px-6 lg:px-8 relative"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitOverflowScrolling: 'auto',
              zIndex: 1,
            }}
          >
            {/* 배경 오버레이 */}
            <motion.div
              className="absolute inset-0 bg-white/10 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            />

            {/* WebKit 호환 떠다니는 원형 요소들 */}
            <motion.div
              className="absolute top-20 left-10 w-24 h-24 bg-white/20 rounded-full blur-xl"
              style={{
                zIndex: 1,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
              animate={{
                y: [0, -40, 0],
                x: [0, 30, 0],
                scale: [1, 1.3, 1],
                rotate: [0, 180, 360]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut',
                type: 'tween'
              }}
            />
            <motion.div
              className="absolute bottom-32 right-16 w-40 h-40 bg-white/15 rounded-full blur-xl"
              style={{
                zIndex: 1,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
              animate={{
                y: [0, 50, 0],
                x: [0, -40, 0],
                scale: [1, 0.7, 1],
                rotate: [0, -180, -360]
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 3,
                type: 'tween'
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/3 w-20 h-20 bg-white/18 rounded-full blur-lg"
              style={{
                zIndex: 1,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, 25, 0],
                scale: [1, 1.2, 1],
                rotate: [0, 90, 180]
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 6,
                type: 'tween'
              }}
            />
            <motion.div
              className="absolute top-1/4 right-1/4 w-16 h-16 bg-white/12 rounded-full blur-md"
              style={{
                zIndex: 1,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
              animate={{
                y: [0, 35, 0],
                x: [0, -20, 0],
                scale: [1, 0.9, 1],
                rotate: [0, -90, -180]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 1,
                type: 'tween'
              }}
            />
            <motion.div
              className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-white/10 rounded-full blur-lg"
              style={{
                zIndex: 1,
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
              animate={{
                y: [0, -25, 0],
                x: [0, 35, 0],
                scale: [1, 1.1, 1],
                rotate: [0, 120, 240]
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 4,
                type: 'tween'
              }}
            />
            <motion.div
              className="max-w-xs w-full space-y-6 bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-2xl relative z-10"
              style={{
                userSelect: 'auto',
                WebkitUserSelect: 'auto',
                touchAction: 'auto',
                position: 'relative',
                transform: 'translateZ(0)'
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <h2
                  className="text-2xl font-bold tracking-tight text-gray-900 flex items-center justify-center gap-3"
                >
                  <div>
                    <Image
                      src="/images/smap_logo.webp"
                      alt="SMAP Logo"
                      width={32}
                      height={32}
                      className="rounded-lg shadow-md"
                      priority
                    />
                  </div>
                  <span>
                    SMAP 로그인
                  </span>
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  계정에 로그인하여 서비스를 이용하세요.
                </p>
              </motion.div>

              <div className="space-y-4">
                {/* 전화번호 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center z-10 pointer-events-none">
                      <FiPhone className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'phone' || phoneNumber ? '' : 'text-gray-400'
                        }`}
                        style={focusedField === 'phone' || phoneNumber ? { color: '#0113A3' } : {}} />
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
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${formErrors.phoneNumber
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
                    <div className="absolute inset-y-0 left-4 flex items-center z-10 pointer-events-none">
                      <FiLock className={`w-4 h-4 transition-colors duration-200 ${focusedField === 'password' || password ? '' : 'text-gray-400'
                        }`}
                        style={focusedField === 'password' || password ? { color: '#0113A3' } : {}} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
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
                      className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${formErrors.password
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-200'
                        }`}
                      style={{ outline: 'none' }}
                    />
                    {/* 비밀번호 표시/숨기기 버튼 */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-4 flex items-center z-10 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <FiEyeOff className="w-4 h-4" />
                      ) : (
                        <FiEye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="text-red-500 text-sm mt-1" style={{ wordBreak: 'keep-all' }}>{formErrors.password}</p>
                  )}

                  {/* 비밀번호 찾기 링크 */}
                  <div className="text-center mt-2">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-[#0114a2] hover:text-[#001f87] hover:underline transition-colors"
                    >
                      비밀번호를 잊어버리셨나요?
                    </Link>
                  </div>
                </div>
              </div>

              {/* 로그인 버튼 */}
              <form
                onSubmit={handlePhoneNumberLogin}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white disabled:opacity-70 transition-all shadow-md"
                  style={{ backgroundColor: '#0113A3', height: '52px' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#001f87'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0113A3'}
                  onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3, 0 0 0 4px rgba(1, 19, 163, 0.1)'}
                  onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
                >
                  {isLoading ? (
                    <LoadingSpinner message="로그인 중..." fullScreen={false} size="sm" type="spinner" />
                  ) : (
                    '전화번호로 로그인'
                  )}
                </button>
              </form>

              {/* 그룹 3: 구분선, Google 로그인 버튼, 회원가입 링크 - Android에서는 숨김 */}
              {!isAndroid && (
                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-[#fef8f9] text-gray-500">
                        또는
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {/* Google 로그인 버튼 */}
                    <div className="relative" style={{ zIndex: 10 }}>
                      <button
                        type="button"
                        data-google-login="react-handler"
                        onClickCapture={(e) => {
                          // 캡처링 단계에서 먼저 처리
                          console.log('🔥 [GOOGLE LOGIN] React 버튼 클릭 캡처됨!');
                          (e.nativeEvent as any).stopImmediatePropagation?.(); // 즉시 전파 중단

                          // 이벤트 전파 중단
                          e.preventDefault();
                          e.stopPropagation();

                          console.log('🔥 [GOOGLE LOGIN] 버튼 클릭됨!');
                          console.log('🔍 [GOOGLE LOGIN] 클릭 이벤트 상세:', {
                            target: e.target,
                            currentTarget: e.currentTarget,
                            isLoading,
                            disabled: e.currentTarget.disabled,
                            timestamp: Date.now()
                          });

                          // 버튼이 비활성화되어 있으면 함수 종료
                          if (isLoading || e.currentTarget.disabled) {
                            console.log('🚫 [GOOGLE LOGIN] 버튼이 비활성화되어 있어 클릭 무시');
                            return;
                          }

                          sendLogToiOS('info', '🔥 Google 로그인 버튼 클릭됨', {
                            timestamp: new Date().toISOString(),
                            event: 'button_click',
                            isLoading: isLoading,
                            buttonDisabled: isLoading
                          });

                          // 햅틱 피드백 (버튼 클릭 시)
                          triggerHapticFeedback(HapticFeedbackType.LIGHT);

                          // 실제 핸들러 호출 (동기 방식으로 변경)
                          console.log('🚀 [GOOGLE LOGIN] handleGoogleLogin 함수 호출 시작');

                          // Promise 형태로 호출하고 에러 처리
                          handleGoogleLogin()
                            .then(() => {
                              console.log('✅ [GOOGLE LOGIN] handleGoogleLogin 함수 완료');
                            })
                            .catch((error) => {
                              console.error('❌ [GOOGLE LOGIN] handleGoogleLogin 함수 오류:', error);
                              setError('Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
                              setIsLoading(false);
                              (window as any).__GOOGLE_LOGIN_IN_PROGRESS__ = false;
                            });
                        }}
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-70 transition-all"
                        style={{
                          zIndex: 100,
                          position: 'relative',
                          pointerEvents: isLoading ? 'none' : 'auto',
                          height: '44px'
                        }}
                        onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3'}
                        onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
                      >
                        {isLoading ? (
                          <LoadingSpinner message="로그인 중..." fullScreen={false} size="sm" type="spinner" />
                        ) : (
                          <>
                            <FcGoogle className="w-5 h-5 mr-3" aria-hidden="true" />
                            Google 계정으로 로그인
                          </>
                        )}
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

                    {/* Apple Sign In - iOS 디바이스에서 표시 (iPad 앱 포함) */}
                    {(() => {
                      // 더 강력한 iOS 감지 (iPad 앱 포함)
                      if (typeof window !== 'undefined') {
                        const userAgent = navigator.userAgent;
                        const platform = navigator.platform;
                        const vendor = (navigator as any).vendor || '';

                        // iOS WebView 감지 (iOS 앱 내)
                        const isIOSWebView = /iPhone|iPad|iPod/i.test(userAgent) &&
                          (window as any).webkit?.messageHandlers?.smapIos;

                        // iPad Safari 브라우저 감지
                        const isIPadSafari = /iPad/i.test(userAgent) &&
                          /Safari/i.test(userAgent) &&
                          !(window as any).webkit?.messageHandlers;

                        // iPad 앱 내 WebView 감지 (Safari가 아니어도 허용)
                        const isIPadApp = /iPad/i.test(userAgent) &&
                          (window as any).webkit?.messageHandlers;

                        // 다양한 iOS 감지 방법 (iPad 앱, Safari 모두 포함)
                        const isIOS =
                          isIOSWebView ||
                          isIPadSafari ||
                          isIPadApp ||  // iPad 앱 내에서도 허용
                          /iPhone|iPad|iPod/i.test(userAgent) ||
                          /Macintosh/i.test(userAgent) ||
                          /iPad/i.test(platform) ||
                          /iPhone/i.test(platform) ||
                          /iPod/i.test(platform) ||
                          /iPad/i.test(vendor) ||
                          /iPhone/i.test(vendor) ||
                          /iPod/i.test(vendor) ||
                          (platform === 'MacIntel' && /iPad/i.test(userAgent)) || // iPad Pro (macOS 모드)
                          (platform === 'MacIntel' && /iPhone/i.test(userAgent)) || // iPhone (macOS 모드)
                          (platform === 'MacIntel' && /iPod/i.test(userAgent)) || // iPod (macOS 모드)
                          // 개발용 강제 표시 (테스트 후 제거 가능)
                          (process.env.NODE_ENV === 'development' && /iPad/i.test(userAgent)) ||
                          (process.env.NODE_ENV === 'development' && /iPad/i.test(platform));

                        console.log('🍎 [APPLE LOGIN] 디버깅 정보:', {
                          userAgent,
                          platform,
                          vendor,
                          isIOS,
                          isIOSWebView,
                          isIPadSafari,
                          isIPadApp,
                          showButton: isIOS
                        });

                        return isIOS;
                      }
                      return false;
                    })() && (
                        <div className="mb-4">
                          {/* 재시도 안내 메시지 */}
                          {lastAppleLoginError && appleLoginAttempts > 0 && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm text-blue-800">
                                    이전 시도에서 오류가 발생했습니다. 다시 시도해보세요.
                                  </p>
                                  <p className="text-xs text-blue-600 mt-1">
                                    시도 횟수: {appleLoginAttempts}회
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleAppleSignIn}
                            disabled={isLoading}
                            className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-900 rounded-lg shadow-sm bg-black text-sm font-medium text-white hover:bg-gray-900 focus:outline-none disabled:opacity-70 transition-all"
                            style={{
                              zIndex: 100,
                              position: 'relative',
                              pointerEvents: isLoading ? 'none' : 'auto',
                              height: '44px'
                            }}
                            onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #0113A3'}
                            onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
                          >
                            {isLoading ? (
                              <LoadingSpinner message="로그인 중..." fullScreen={false} size="sm" type="spinner" />
                            ) : (
                              <>
                                <svg width="18" height="18" viewBox="0 0 24 24" className="mr-3" fill="currentColor">
                                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.33-.88 3.69-.73 1.58.23 2.76.89 3.53 2.24-3.2 2.1-2.69 6.11.48 7.65-.61 1.34-1.39 2.65-2.78 4.01m-6.89-15C10.29 2.68 12.7.75 15.29 1c.3 2.5-1.86 5.13-4.24 5.28-.3-2.5.42-3.5.11-4Z" />
                                </svg>
                                Apple로 로그인
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    {/* 카카오 로그인 버튼 제거 */}
                  </div>
                </div>
              )}

              {/* 회원가입 링크 - Android에서도 표시 */}
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  아직 계정이 없으신가요?{' '}
                  <Link href="/register" className="font-medium transition-colors"
                    style={{ color: '#0113A3' }}
                    onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1e40af'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#0113A3'}>
                    회원가입
                  </Link>
                </p>
              </div>
            </motion.div>

            {/* 에러 모달 - 단순화된 버전 */}
            {showErrorModal && errorModalMessage && (
              <>
                {/* 배경 오버레이 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 backdrop-blur-sm z-[9999]"
                  style={{
                    width: '100vw',
                    height: '100vh',
                    minWidth: '100vw',
                    minHeight: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh'
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      console.log('[SIGNIN] 배경 클릭으로 에러 모달 닫기');
                      closeErrorModal();
                    }
                  }}
                />

                {/* 에러 모달 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center p-4"
                  style={{
                    width: '100vw',
                    height: '100vh',
                    minWidth: '100vw',
                    minHeight: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh'
                  }}
                >
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto">
                    <div className="p-6">
                      {/* 에러 아이콘 */}
                      <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                        <FiAlertTriangle className="w-6 h-6 text-red-600" />
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                        로그인에 실패했습니다
                      </h3>

                      {/* 메시지 */}
                      <p className="text-gray-600 text-center mb-6">
                        {errorModalMessage}
                      </p>

                      {/* 추가 안내 */}
                      {/* <p className="text-sm text-gray-500 text-center mb-6">
                  전화번호는 유지되며, 비밀번호만 다시 입력해주세요.
                </p> */}

                      {/* 확인 버튼 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[SIGNIN] 에러 모달 확인 버튼 클릭');
                          closeErrorModal();
                        }}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        다시 시도
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}

            {/* 전체 화면 로딩 스피너 */}
            {isLoading && (
              <div
                className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9998]"
                style={{
                  width: '100vw',
                  height: '100vh',
                  minWidth: '100vw',
                  minHeight: '100vh',
                  maxWidth: '100vw',
                  maxHeight: '100vh'
                }}
              >
                <div className="bg-white px-6 py-4 rounded-xl shadow-lg">
                  <IOSCompatibleSpinner size="sm" message="처리 중..." />
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </>
  );
};

export default SignInPage;