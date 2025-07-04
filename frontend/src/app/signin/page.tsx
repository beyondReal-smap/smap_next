// frontend/src/app/signin/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiLock, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import AlertModal from '@/components/ui/AlertModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { comprehensivePreloadData } from '@/services/dataPreloadService';
import { RiKakaoTalkFill } from 'react-icons/ri';
import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';


// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
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

// 햅틱 피드백 함수
const triggerHapticFeedback = (type: HapticFeedbackType) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    const patterns = {
      [HapticFeedbackType.LIGHT]: [10],
      [HapticFeedbackType.MEDIUM]: [20],
      [HapticFeedbackType.HEAVY]: [30],
      [HapticFeedbackType.SUCCESS]: [50, 100, 50],
      [HapticFeedbackType.WARNING]: [100, 50, 100],
      [HapticFeedbackType.ERROR]: [200, 100, 200]
    };
    window.navigator.vibrate(patterns[type]);
  }
};

// iOS 로거 함수
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





const SignInPage = () => {
  // 🚨 페이지 로드 디버깅
  console.log('[SIGNIN PAGE] 컴포넌트 로딩 시작', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

  // 🚨 페이지 초기화 및 에러 모달 상태 복원
  useEffect(() => {
    // 안전하게 window 객체 확인
    if (typeof window === 'undefined') {
      console.log('[INIT] 서버사이드에서 실행됨, 스킵');
      return undefined;
    }
    
    console.log('[INIT] 클라이언트사이드 초기화 시작');
    
    // 에러 모달 상태 복원
    try {
      const savedErrorFlag = sessionStorage.getItem('__SIGNIN_ERROR_MODAL_ACTIVE__') === 'true';
      if (savedErrorFlag) {
        console.log('[SIGNIN] 🔄 페이지 로드 시 브라우저 저장소에서 에러 모달 상태 복원');
        
        const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
        (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
        (window as any).__SIGNIN_ERROR_MESSAGE__ = savedErrorMessage;
        
        setShowErrorModal(true);
        if (savedErrorMessage) {
          setErrorModalMessage(savedErrorMessage);
        }
      }
    } catch (error) {
      console.warn('[SIGNIN] sessionStorage 접근 실패:', error);
    }
    
    // 카카오 콜백 함수 등록 (구글 로그인과 동일한 패턴)
    (window as any).onNativeKakaoLoginSuccess = async (userInfo: any) => {
      console.log('🎯 [NATIVE CALLBACK] iOS 카카오 로그인 성공:', userInfo);
      
      try {
        console.log('🔄 [NATIVE CALLBACK] 백엔드 카카오 인증 API 호출 시작');
        
        // 진행 중 플래그 해제
        (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
        
        // 백엔드 API로 access_token 전송
        const response = await fetch('/api/kakao-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: userInfo.accessToken,
            userInfo: userInfo.userInfo,
            source: 'native'
          }),
        });

        const data = await response.json();
        
        console.log('📡 [NATIVE CALLBACK] 백엔드 카카오 인증 API 응답:', {
          success: data.success,
          hasUser: !!data.user,
          hasError: !!data.error,
          responseStatus: response.status
        });

        if (data.success) {
          console.log('[NATIVE CALLBACK] 카카오 로그인 성공:', {
            isNewUser: data.isNewUser,
            hasUser: !!data.user,
            hasSocialData: !!data.socialLoginData
          });
          
          // 카카오 로그인 성공 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.SUCCESS);
          
          // 리다이렉트 플래그 설정
          isRedirectingRef.current = true;
          blockAllEffectsRef.current = true;
          
          // 신규회원/기존회원에 따른 분기 처리
          if (data.isNewUser) {
            console.log('[NATIVE CALLBACK] 신규회원 - 회원가입 페이지로 이동');
            
            // 소셜 로그인 데이터를 sessionStorage에 저장
            if (data.socialLoginData) {
              sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
              console.log('[NATIVE CALLBACK] 소셜 로그인 데이터 저장 완료');
            }
            
            // 회원가입 페이지로 이동
            window.location.href = '/register?social=kakao';
            return undefined;
            
          } else {
            console.log('[NATIVE CALLBACK] 기존회원 - 홈으로 이동');
            
            // 🚨 강력한 인증 상태 설정
            if (data.user) {
              console.log('[NATIVE CALLBACK] 사용자 데이터 설정:', data.user);
              
              // 1. AuthService에 토큰 저장 (가장 중요!)
              if (data.token) {
                console.log('[NATIVE CALLBACK] JWT 토큰 저장:', data.token ? '토큰 있음' : '토큰 없음');
                authService.setToken(data.token);
              } else {
                console.warn('[NATIVE CALLBACK] 백엔드에서 토큰을 받지 못했습니다.');
              }
              
              // 2. AuthContext 상태 업데이트
              await refreshAuthState();
              
              // 3. 포괄적 데이터 캐싱
              try {
                await saveComprehensiveData({
                  userProfile: data.user
                });
                console.log('[NATIVE CALLBACK] 포괄적 데이터 캐싱 완료');
              } catch (cacheError) {
                console.warn('[NATIVE CALLBACK] 데이터 캐싱 실패:', cacheError);
              }
            }
            
            // 📄 상태 초기화
            setIsLoading(false);
            setError(null);
            
            console.log('[NATIVE CALLBACK] 홈으로 이동');
            window.location.href = '/home';
          }
        } else {
          console.error('[NATIVE CALLBACK] 백엔드 카카오 인증 실패:', data.error);
          
          // 진행 중 플래그 해제
          (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
          setIsLoading(false);
          
          // 탈퇴한 사용자인지 확인
          if (data.isWithdrawnUser) {
            setError('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
          } else {
            setError(data.error || '카카오 로그인에 실패했습니다.');
          }
          
          // 햅틱 피드백 (에러)
          triggerHapticFeedback(HapticFeedbackType.ERROR);
        }
      } catch (error) {
        console.error('[NATIVE CALLBACK] 카카오 로그인 처리 중 오류:', error);
        
        // 진행 중 플래그 해제
        (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
        setIsLoading(false);
        setError('카카오 로그인 처리 중 오류가 발생했습니다.');
        
        // 햅틱 피드백 (에러)
        triggerHapticFeedback(HapticFeedbackType.ERROR);
      }
    };
    
    (window as any).onNativeKakaoLoginError = (error: any) => {
      console.error('❌ [NATIVE CALLBACK] iOS 카카오 로그인 실패:', error);
      
      // 진행 중 플래그 해제
      (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
      setIsLoading(false);
      setError('카카오 로그인에 실패했습니다.');
      
      // 햅틱 피드백 (에러)
      triggerHapticFeedback(HapticFeedbackType.ERROR);
    };
    
    console.log('✅ [INIT] 초기화 완료');
  }, []);

  // 카카오 로그인 함수 (구글 로그인과 동일한 패턴)
  const handleKakaoLogin = async () => {
    if (isLoading) {
      console.log('🚫 [KAKAO LOGIN] 이미 로딩 중입니다.');
      return undefined;
    }
    
    // 중복 실행 방지를 위한 플래그 체크
    if ((window as any).__KAKAO_LOGIN_IN_PROGRESS__) {
      console.log('🚫 [KAKAO LOGIN] 이미 진행 중인 로그인이 있습니다.');
      return undefined;
    }
    
    setIsLoading(true);
    setError(null);
    
    // 진행 중 플래그 설정
    (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = true;
    
    try {
      console.log('🚀 [KAKAO LOGIN] 시작', { 
        platform: 'web',
        isIOSWebView,
        isAndroidWebView,
        isWebEnvironment,
        timestamp: Date.now()
      });
      
      // 햅틱 피드백 (버튼 클릭 시)
      triggerHapticFeedback(HapticFeedbackType.LIGHT);
      
      // iOS 환경 체크 및 처리
      if (isIOSWebView) {
        console.log('🍎 [KAKAO LOGIN] iOS 환경에서 카카오 로그인 시도');
        
        // iOS 네이티브 카카오 로그인 시도
        if ((window as any).webkit?.messageHandlers?.smapIos) {
          console.log('📱 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 인터페이스 발견');
          
          try {
            // iOS 네이티브 로그인 호출
            (window as any).webkit.messageHandlers.smapIos.postMessage({
              type: 'kakaoLogin',
              param: '',
              timestamp: Date.now(),
              source: 'ios_native'
            });
            
            console.log('✅ [KAKAO LOGIN] iOS 네이티브 호출 성공, 콜백 대기 중...');
            
            // iOS 환경에서 3초 후 폴백 (웹에서는 카카오 로그인이 제한적이므로 에러 메시지)
            setTimeout(() => {
              console.log('🔍 [IOS FALLBACK] iOS 카카오 로그인 응답 확인 중...');
              
              // 진행 중 플래그가 여전히 설정되어 있으면 에러 처리
              if ((window as any).__KAKAO_LOGIN_IN_PROGRESS__) {
                console.log('⚠️ [IOS FALLBACK] iOS 네이티브 응답 없음');
                (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
                setIsLoading(false);
                setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
              }
            }, 3000);
            
            return undefined;
          } catch (error) {
            console.error('❌ [KAKAO LOGIN] iOS 네이티브 호출 실패:', error);
            (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
            setIsLoading(false);
            setError('카카오 로그인 중 오류가 발생했습니다.');
            return undefined;
          }
        } else {
          console.warn('🍎 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 인터페이스가 없습니다.');
          (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
          setIsLoading(false);
          setError('카카오 로그인은 앱에서만 지원됩니다.');
        }
        
        return undefined; // iOS 처리가 완료되면 함수 종료
      }
      
      // Android 환경 체크 및 처리
      if (isAndroidWebView) {
        console.log('🤖 [KAKAO LOGIN] Android 환경에서 카카오 로그인 시도');
        console.log('⚠️ [KAKAO LOGIN] Android에서는 카카오 로그인이 제한적입니다.');
        (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
        setIsLoading(false);
        setError('카카오 로그인은 iOS 앱에서만 지원됩니다.');
        return undefined; // Android 처리가 완료되면 함수 종료
      }
      
      // 웹 환경 또는 기타 환경
      console.log('🌐 [KAKAO LOGIN] 웹 환경에서 카카오 로그인 시도');
      (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
      setIsLoading(false);
      setError('카카오 로그인은 앱에서만 지원됩니다.');
      
    } catch (error) {
      console.error('❌ [KAKAO LOGIN] 카카오 로그인 실패', { error });
      
      // 취소된 로그인인지 확인
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('canceled') || errorMessage.includes('cancelled')) {
        console.log('ℹ️ [KAKAO LOGIN] 사용자가 로그인을 취소했습니다.');
        setError('로그인이 취소되었습니다. 다시 시도해주세요.');
      } else {
        setError('카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      
      // 햅틱 피드백 (에러)
      triggerHapticFeedback(HapticFeedbackType.ERROR);
    } finally {
      // 진행 중 플래그 제거
      (window as any).__KAKAO_LOGIN_IN_PROGRESS__ = false;
      setIsLoading(false);
    }
  };

  // 🚨 페이지 로드 즉시 브라우저 저장소에서 에러 모달 상태 확인 및 복원
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  const [errorModalMessage, setErrorModalMessage] = useState('');

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
  
  // 🆕 DataCache 접근
  let dataCacheContextData;
  try {
    dataCacheContextData = useDataCache();
  } catch (error) {
    console.error('[SIGNIN] useDataCache 컨텍스트 오류:', error);
    dataCacheContextData = {
      saveComprehensiveData: () => {},
      saveToLocalStorage: () => {},
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

  // 🔍 핸들러 모니터링 useEffect (최우선)
  useEffect(() => {
    console.log('🔍 [HANDLER MONITOR] 핸들러 모니터링 시작');
    
    // 🌐 전역 테스트 함수들 등록
    (window as any).__SMAP_FORCE_CREATE_HANDLERS__ = forceCreateMessageHandlers;
    (window as any).__SMAP_CHECK_HANDLERS__ = forceCheckHandlers;
    (window as any).__SMAP_EMERGENCY_GOOGLE_LOGIN__ = () => {
      console.log('🚨 [EMERGENCY] 응급 구글 로그인 실행');
      handleGoogleSDKLogin();
    };
    
    // 카카오 SDK 확인 함수 등록
    (window as any).__SMAP_CHECK_KAKAO_SDK__ = checkKakaoSDKStatus;
    
    console.log('🌐 [GLOBAL] 전역 테스트 함수들 등록 완료:');
    console.log('   - window.__SMAP_FORCE_CREATE_HANDLERS__()');
    console.log('   - window.__SMAP_CHECK_HANDLERS__()');
    console.log('   - window.__SMAP_EMERGENCY_GOOGLE_LOGIN__()');
    console.log('   - window.__SMAP_CHECK_KAKAO_SDK__()');
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
      
      try {
        console.log('🔄 [NATIVE CALLBACK] 백엔드 구글 인증 API 호출 시작');
        
        // 백엔드 API로 ID 토큰 전송
        const response = await fetch('/api/google-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken: userInfo.idToken,  // ✅ 백엔드가 기대하는 파라미터 이름으로 수정
            userInfo: userInfo.userInfo,
            source: 'native'
          }),
        });

        const data = await response.json();
        
        console.log('📡 [NATIVE CALLBACK] 백엔드 구글 인증 API 응답:', {
          success: data.success,
          hasUser: !!data.user,
          hasError: !!data.error,
          responseStatus: response.status
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
            
            // 소셜 로그인 데이터를 sessionStorage에 저장
            if (data.socialLoginData) {
              sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
              console.log('[NATIVE CALLBACK] 소셜 로그인 데이터 저장 완료');
            }
            
            // 회원가입 페이지로 이동
            window.location.href = '/register?social=google';
            return undefined;
            
          } else {
            console.log('[NATIVE CALLBACK] 기존회원 - 홈으로 이동');
            
            // 🚨 강력한 인증 상태 설정
            if (data.user) {
              console.log('[NATIVE CALLBACK] 사용자 데이터 설정:', data.user);
              
              // 1. AuthService에 토큰 저장 (가장 중요!)
              if (data.token) {
                console.log('[NATIVE CALLBACK] JWT 토큰 저장:', data.token ? '토큰 있음' : '토큰 없음');
                authService.setToken(data.token);
              } else {
                console.warn('[NATIVE CALLBACK] ⚠️ 백엔드에서 토큰이 반환되지 않음');
              }
              
              // 2. AuthService에 사용자 데이터 설정
              authService.setUserData(data.user);
              
              // 3. 로컬 스토리지에도 직접 저장 (백업)
              localStorage.setItem('user', JSON.stringify(data.user));
              localStorage.setItem('isLoggedIn', 'true');
              
              // 4. 세션 스토리지에도 저장
              sessionStorage.setItem('authToken', 'authenticated');
              
              // 5. 저장 상태 확인
              console.log('[NATIVE CALLBACK] 저장 상태 확인:');
              console.log('  - 토큰:', authService.getToken() ? '저장됨' : '없음');
              console.log('  - 사용자 데이터:', authService.getUserData() ? '저장됨' : '없음');
              console.log('  - isLoggedIn():', authService.isLoggedIn());
              
              console.log('[NATIVE CALLBACK] 모든 저장소에 인증 상태 저장 완료');
            }
            
            console.log('[NATIVE CALLBACK] 로그인 성공 - AuthContext 상태 동기화 후 home으로 리다이렉션');
            
            // 4. AuthContext 상태를 수동으로 동기화
            try {
              await refreshAuthState();
              console.log('[NATIVE CALLBACK] AuthContext 상태 동기화 완료');
              
              // 5. 동기화 후 상태 재확인
              const isLoggedInAfterRefresh = authService.isLoggedIn();
              console.log('[NATIVE CALLBACK] 동기화 후 로그인 상태:', isLoggedInAfterRefresh);
              
              if (!isLoggedInAfterRefresh) {
                console.warn('[NATIVE CALLBACK] ⚠️ 동기화 후에도 로그인 상태가 false');
                
                // 6. 강제로 AuthContext 상태 설정
                if (typeof refreshAuthState === 'function') {
                  console.log('[NATIVE CALLBACK] 강제 AuthContext 재설정 시도');
                  await refreshAuthState();
                }
              }
              
            } catch (error) {
              console.error('[NATIVE CALLBACK] AuthContext 동기화 실패:', error);
            }
            
            // 7. 즉시 리다이렉션 (상태 안정화 완료)
            console.log('[NATIVE CALLBACK] 홈으로 즉시 리다이렉션 실행');
            router.replace('/home');
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
      console.log('🔄 [NATIVE DATA] 네이티브 구글 로그인 데이터 처리 시작', data);
      
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

        if (result.success) {
          if (result.isNewUser) {
            console.log('🆕 [NATIVE DATA] 신규 사용자 - 회원가입 페이지로 이동');
            window.location.href = '/register?social=google';
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
      checkNativeData();
      
      if (checkCount >= 10) {
        clearInterval(checkInterval);
        console.log('🔍 [NATIVE DATA] 전역 변수 모니터링 종료');
      }
    }, 1000);
    
    // 즉시 한 번 확인
    checkNativeData();
    
    // 🔍 즉시 강제 핸들러 확인 (더 상세한 디버깅)
    setTimeout(() => {
      console.log('🔍 [FORCE HANDLER CHECK] 5초 후 상세 핸들러 확인');
      forceCheckHandlers();
    }, 5000);
    
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
    
    // 중복 호출 방지
    if ((window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__) {
      console.log('[GOOGLE SDK] 이미 로그인 진행 중, 중복 호출 무시');
      return undefined;
    }
    
    (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = true;
    
    try {
      // Google Identity Services 초기화 (이미 로드되어 있다고 가정)
      if ((window as any).google?.accounts?.id) {
        const google = (window as any).google;
        
        console.log('[GOOGLE SDK] Google Identity Services 초기화');
        
        // 🔥 Client ID 설정 (하드코딩으로 문제 해결)
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-lamjiad6ljpa02fk30k6nh6arqq4rc4o.apps.googleusercontent.com';
        
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
                triggerHapticFeedback(HapticFeedbackType.SUCCESS);
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
              (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
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
            (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
          }
        });
        
        // 로그인 팝업 띄우기 (중복 호출 방지)
        try {
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
        } catch (error) {
          console.error('[GOOGLE SDK] Prompt 호출 실패:', error);
          showError('Google 로그인 팝업을 열 수 없습니다.');
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
      (window as any).__GOOGLE_SDK_LOGIN_IN_PROGRESS__ = false;
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
        
        return undefined;
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
      return undefined;
    }
    
    if (componentMountedRef.current && !preventRemountRef.current) {
      console.log('[SIGNIN] ⚠️ 컴포넌트 재마운트 감지 - 차단 활성화');
      preventRemountRef.current = true;
      blockAllEffectsRef.current = true;
      
      // 강제로 현재 페이지 상태 유지
      window.history.replaceState(null, '', window.location.href);
      
      return undefined;
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
      return undefined;
    }
    
    // 모든 useEffect 차단 플래그가 설정되어 있으면 아무것도 하지 않음
    if (blockAllEffectsRef.current || preventRemountRef.current) {
      console.log('[SIGNIN] 🚫 모든 useEffect 차단됨 (재마운트 방지 포함)');
      return undefined;
    }
    
    // 에러 모달이 표시 중이면 아무것도 하지 않음 (최우선 조건)
    if (showErrorModal) {
      console.log('[SIGNIN] ⛔ 에러 모달 표시 중, useEffect 완전 중단');
      blockAllEffectsRef.current = true; // 차단 플래그 설정
      return undefined;
    }
    
    console.log('[SIGNIN] 🔄 메인 useEffect 실행:', { isLoggedIn, loading, showErrorModal, isCheckingAuth });
    
    // 로딩 중이면 대기
    if (loading) {
      console.log('[SIGNIN] AuthContext 로딩 중, 대기...');
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

    // 로그인된 사용자는 홈으로 리다이렉트 (한 번만 실행)
    if (isLoggedIn && !isRedirectingRef.current) {
      console.log('[SIGNIN] 로그인된 사용자 감지, /home으로 리다이렉트');
      isRedirectingRef.current = true;
      
      // 추가 안전장치: 모든 상태 업데이트 차단
      blockAllEffectsRef.current = true;
      
      router.replace('/home');
      return undefined;
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
    const isAndroidWebView = /Android/.test(navigator.userAgent);
    console.log('[GOOGLE LOGIN] 콜백 함수 등록 - 환경:', { isIOSWebView, isAndroidWebView });
    
    if (isIOSWebView || isAndroidWebView) {
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
            
            // 🚨 Google 로그인 성공 상세 로깅
            iosLogger.logGoogleLogin('네이티브 로그인 성공', {
              hasUser: !!data.user,
              hasToken: !!data.token,
              isNewUser: data.isNewUser || false,
              userEmail: data.user?.mt_email || data.user?.email || normalizedUserInfo.email || 'unknown',
              userNickname: data.user?.mt_nickname || data.user?.nickname || normalizedUserInfo.name || 'unknown',
              userId: data.user?.mt_idx || data.user?.id || 'unknown',
              provider: isAndroidWebView ? 'google_android' : 'google_ios',
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
              triggerHapticFeedback(HapticFeedbackType.SUCCESS);
              console.log('🎮 [SIGNIN] Google 로그인 성공 햅틱 피드백 실행');
              
              // 6. 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
              // 7. 모든 상태 업데이트 차단
              blockAllEffectsRef.current = true;
              
              // 8. 🔥 즉시 홈 페이지 이동 로직
              console.log('[GOOGLE LOGIN] 🏠 홈 페이지로 즉시 이동');
                sendLogToiOS('info', 'Google 로그인 홈 페이지 이동', {
                  userId: data.user.mt_idx,
                  hasToken: !!authService.getToken(),
                  hasUser: !!authService.getUserData(),
                  authContextReady: isLoggedIn
                });
                
                // 즉시 홈 페이지로 이동
                router.replace('/home');
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
        triggerHapticFeedback(HapticFeedbackType.ERROR);
        
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
      return undefined;
    }
    
    // 모든 useEffect 차단 플래그가 설정되어 있으면 아무것도 하지 않음
    if (blockAllEffectsRef.current) {
      console.log('[SIGNIN] 🚫 에러 감지 useEffect 차단됨');
      return undefined;
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
      return undefined;
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
      triggerHapticFeedback(HapticFeedbackType.SUCCESS);
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
      triggerHapticFeedback(HapticFeedbackType.ERROR);
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
    isRedirectingRef.current = false; // 🔄 리다이렉트 플래그도 초기화
    
    // 🔄 로딩 상태도 안전하게 해제
    setIsLoading(false);
    
    console.log('[SIGNIN] 모든 플래그 리셋 완료 - signin 화면으로 복귀 준비');
  };

  // 🚨 카카오 에러 시 홈으로 이동하는 함수
  const handleErrorAndGoHome = () => {
    console.log('[SIGNIN] 에러 처리 후 홈으로 이동');
    closeErrorModal();
    recoverFromKakaoError();
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
      
      // 🚫 브라우저 네비게이션 차단 (안전한 버전)
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
      
      safeAddEventListener(window, 'beforeunload', navigationListenersRef.current.beforeunload, { capture: true, passive: false });
      
      // unload 이벤트 차단
      navigationListenersRef.current.unload = (e: Event) => {
        console.log('[SIGNIN] 🚫 unload 이벤트 차단!');
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        } catch (error) {
          console.warn('[SIGNIN] unload 처리 중 오류:', error);
        }
      };
      
      safeAddEventListener(window, 'unload', navigationListenersRef.current.unload, { capture: true, passive: false });
      
      // pagehide 이벤트 차단
      navigationListenersRef.current.pagehide = (e: PageTransitionEvent) => {
        console.log('[SIGNIN] 🚫 pagehide 이벤트 차단!');
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        } catch (error) {
          console.warn('[SIGNIN] pagehide 처리 중 오류:', error);
        }
      };
      
      safeAddEventListener(window, 'pagehide', navigationListenersRef.current.pagehide, { capture: true, passive: false });
      
      // visibilitychange 이벤트 차단
      navigationListenersRef.current.visibilitychange = (e: Event) => {
        console.log('[SIGNIN] 🚫 visibilitychange 이벤트 차단!');
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        } catch (error) {
          console.warn('[SIGNIN] visibilitychange 처리 중 오류:', error);
        }
      };
      
      safeAddEventListener(document, 'visibilitychange', navigationListenersRef.current.visibilitychange, { capture: true, passive: false });
      
      // popstate 이벤트 차단 (뒤로가기, 앞으로가기 차단)
      navigationListenersRef.current.popstate = (e: PopStateEvent) => {
        console.log('[SIGNIN] 🚫 popstate 이벤트 차단!');
        try {
          if (e.preventDefault) e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          // 현재 URL로 다시 pushState
          window.history.pushState(null, '', window.location.href);
        } catch (error) {
          console.warn('[SIGNIN] popstate 처리 중 오류:', error);
        }
      };
      
      safeAddEventListener(window, 'popstate', navigationListenersRef.current.popstate, { capture: true, passive: false });
      
      // 키보드 이벤트 차단 (F5, Ctrl+R 등)
      navigationListenersRef.current.keydown = (e: KeyboardEvent) => {
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.key === 'F5') || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
          console.log('[SIGNIN] 🚫 키보드 이벤트 차단:', e.key);
          try {
            if (e.preventDefault) e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          } catch (error) {
            console.warn('[SIGNIN] 키보드 이벤트 처리 중 오류:', error);
          }
          return false;
        }
      };
      
      safeAddEventListener(window, 'keydown', navigationListenersRef.current.keydown, { capture: true, passive: false });
      
      // 🚫 히스토리 API 차단 (안전한 방법)
      const originalPush = window.history.pushState;
      const originalReplace = window.history.replaceState;
      
      window.history.pushState = function(...args) {
        if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[SIGNIN] 🚫 history.pushState 차단!');
          return undefined;
        }
        return originalPush.apply(this, args);
      };
      
      window.history.replaceState = function(...args) {
        if ((window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
          console.log('[SIGNIN] 🚫 history.replaceState 차단!');
          return undefined;
        }
        return originalReplace.apply(this, args);
      };
      
      // 복원 함수 저장
      (window as any).__SIGNIN_RESTORE_HISTORY__ = () => {
        window.history.pushState = originalPush;
        window.history.replaceState = originalReplace;
      };
      
      // 🚫 fetch 요청 차단 (페이지 데이터 로드 방지)
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
      
    } catch (e) {
      console.warn('[SIGNIN] 브라우저 네비게이션 차단 설정 중 오류 (무시):', e);
    }
    
    console.log('[SIGNIN] 브라우저 네비게이션 차단 완료 (안전한 버전)');
    
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
        try {
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
                return undefined;
              }
              originalNextData = value;
            },
            configurable: true
          });
        } catch (e) {
          console.warn('[SIGNIN] __NEXT_DATA__ 차단 실패 (무시):', e);
        }
      }
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

  // Google 로그인 핸들러 (플랫폼별 분리된 버전)
  const handleGoogleLogin = async () => {
    if (isLoading) {
      console.log('🚫 [GOOGLE LOGIN] 이미 로딩 중입니다.');
      return undefined;
    }
    
    // 중복 실행 방지를 위한 플래그 체크
    if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
      console.log('🚫 [GOOGLE LOGIN] 이미 진행 중인 로그인이 있습니다.');
      return undefined;
    }
    
    setIsLoading(true);
    setError(null);
    
    // 진행 중 플래그 설정
    (window as any).__GOOGLE_LOGIN_IN_PROGRESS__ = true;
    
    try {
      // 환경 감지 상태 출력
      console.log('🔍 [GOOGLE LOGIN] 환경 감지 상태:', {
        userAgent: navigator.userAgent.substring(0, 100),
        isIOSWebView,
        isAndroidWebView,
        isWebEnvironment,
        hasWebKit: !!(window as any).webkit,
        hasAndroidBridge: !!(window as any).androidBridge,
        platform: 'web'
      });
      
      console.log('🚀 [GOOGLE LOGIN] 시작', { 
        platform: 'web',
        isIOSWebView,
        isAndroidWebView,
        isWebEnvironment,
        timestamp: Date.now()
      });
      triggerHapticFeedback(HapticFeedbackType.LIGHT);
      
      // iOS 환경 체크 및 처리
      if (isIOSWebView) {
        console.log('🍎 [GOOGLE LOGIN] iOS 환경에서 Google 로그인 시도');
        
        // iOS 네이티브 Google 로그인 시도
        if ((window as any).webkit?.messageHandlers?.smapIos) {
          console.log('📱 [GOOGLE LOGIN] iOS 네이티브 Google 로그인 인터페이스 발견');
          
          try {
            // iOS 네이티브 로그인 호출
            (window as any).webkit.messageHandlers.smapIos.postMessage({
              type: 'googleSignIn',
              param: '',
              timestamp: Date.now(),
              source: 'ios_native'
            });
            
            console.log('✅ [GOOGLE LOGIN] iOS 네이티브 호출 성공, 콜백 대기 중...');
            
            // iOS 환경에서 3초 후 웹 SDK 폴백 (시간 증가)
            setTimeout(() => {
              console.log('🔍 [IOS FALLBACK] iOS Google Sign-In 응답 확인 중...');
              
              // 진행 중 플래그가 여전히 설정되어 있으면 웹 SDK로 폴백
              if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
                console.log('⚠️ [IOS FALLBACK] iOS 네이티브 응답 없음, 웹 SDK로 폴백');
                handleGoogleSDKLogin();
              }
            }, 3000);
            
            return undefined;
          } catch (error) {
            console.error('❌ [GOOGLE LOGIN] iOS 네이티브 호출 실패:', error);
            console.log('🔄 [IOS FALLBACK] iOS 실패로 웹 SDK로 폴백');
            await handleGoogleSDKLogin();
            return undefined;
          }
        } else {
          console.warn('🍎 [GOOGLE LOGIN] iOS 네이티브 Google 로그인 인터페이스가 없습니다. 웹 SDK로 폴백합니다');
          
          // iOS에서 네이티브 인터페이스가 없으면 웹 SDK 사용
          await handleGoogleSDKLogin();
        }
        
        return undefined; // iOS 처리가 완료되면 함수 종료
      }
      
      // Android 환경 체크 및 처리
      if (isAndroidWebView) {
        console.log('🤖 [GOOGLE LOGIN] Android 환경에서 Google 로그인 시도');
        
        // 🔥 Android 인터페이스 대기 및 감지 함수
        const waitForAndroidInterface = async (maxWait = 5000) => { // 5초로 증가
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxWait) {
            // 여러 방법으로 Android 인터페이스 확인
            const interfaces = [
              (window as any).AndroidGoogleSignIn,
              (window as any).androidGoogleSignIn,
              (window as any).androidBridge?.googleSignIn,
              (window as any).__SMAP_ANDROID_GOOGLE_SIGNIN__
            ];
            
            for (const iface of interfaces) {
              if (iface && typeof iface.signIn === 'function') {
                console.log('✅ [ANDROID INTERFACE] Android Google Sign-In 인터페이스 발견:', iface);
                return iface;
              }
            }
            
            // 상세 디버깅 (1초마다)
            if ((Date.now() - startTime) % 1000 < 100) {
              console.log('🔍 [ANDROID INTERFACE] 상세 디버깅:', {
                AndroidGoogleSignIn: !!(window as any).AndroidGoogleSignIn,
                androidGoogleSignIn: !!(window as any).androidGoogleSignIn,
                androidBridge: !!(window as any).androidBridge,
                androidBridgeGoogleSignIn: !!((window as any).androidBridge && (window as any).androidBridge.googleSignIn),
                __SMAP_ANDROID_GOOGLE_SIGNIN__: !!(window as any).__SMAP_ANDROID_GOOGLE_SIGNIN__,
                __ANDROID_GOOGLE_SIGNIN_INJECTED__: !!(window as any).__ANDROID_GOOGLE_SIGNIN_INJECTED__,
                __ANDROID_GOOGLE_SIGNIN_READY__: !!(window as any).__ANDROID_GOOGLE_SIGNIN_READY__,
                __ANDROID_GOOGLE_SIGNIN_INITIAL_READY__: !!(window as any).__ANDROID_GOOGLE_SIGNIN_INITIAL_READY__,
                __SMAP_ANDROID_HANDLERS_READY__: !!(window as any).__SMAP_ANDROID_HANDLERS_READY__,
                __ANDROID_HANDLER_MONITOR_INJECTED__: !!(window as any).__ANDROID_HANDLER_MONITOR_INJECTED__,
                elapsedTime: Date.now() - startTime
              });
            }
            
            console.log('⏳ [ANDROID INTERFACE] Android 인터페이스 대기 중...', Date.now() - startTime);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.error('❌ [ANDROID INTERFACE] Android 인터페이스 대기 시간 초과');
          return null;
        };
        
        // Android 인터페이스 대기
        const androidInterface = await waitForAndroidInterface();
        
        if (androidInterface) {
          console.log('🤖 [GOOGLE LOGIN] Android 네이티브 Google 로그인 인터페이스 발견');
          
          try {
            // Android 네이티브 로그인 호출
            androidInterface.signIn();
            console.log('✅ [GOOGLE LOGIN] Android 네이티브 호출 성공, 콜백 대기 중...');
            
            // Android 환경에서 1초 후 웹 SDK 폴백 (시간 단축)
            setTimeout(() => {
              console.log('🔍 [ANDROID FALLBACK] Android Google Sign-In 응답 확인 중...');
              
              // 진행 중 플래그가 여전히 설정되어 있으면 웹 SDK로 폴백
              if ((window as any).__GOOGLE_LOGIN_IN_PROGRESS__) {
                console.log('⚠️ [ANDROID FALLBACK] Android 네이티브 응답 없음, 웹 SDK로 폴백');
                handleGoogleSDKLogin();
              }
            }, 1000); // 3초에서 1초로 단축
            
            return undefined;
          } catch (error) {
            console.error('❌ [GOOGLE LOGIN] Android 네이티브 호출 실패:', error);
            console.log('🔄 [ANDROID FALLBACK] Android 실패로 웹 SDK로 폴백');
            await handleGoogleSDKLogin();
            return undefined;
          }
        } else {
          console.warn('🤖 [GOOGLE LOGIN] Android 네이티브 Google 로그인 인터페이스가 없습니다. 웹 SDK로 폴백합니다');
          console.log('🔍 [ANDROID DEBUG] 사용 가능한 객체들:', {
            AndroidGoogleSignIn: !!(window as any).AndroidGoogleSignIn,
            androidGoogleSignIn: !!(window as any).androidGoogleSignIn,
            androidBridge: !!(window as any).androidBridge,
            androidBridgeGoogleSignIn: !!((window as any).androidBridge && (window as any).androidBridge.googleSignIn),
            __SMAP_ANDROID_GOOGLE_SIGNIN__: !!(window as any).__SMAP_ANDROID_GOOGLE_SIGNIN__,
            __ANDROID_GOOGLE_SIGNIN_INJECTED__: !!(window as any).__ANDROID_GOOGLE_SIGNIN_INJECTED__,
            __ANDROID_GOOGLE_SIGNIN_READY__: !!(window as any).__ANDROID_GOOGLE_SIGNIN_READY__
          });
          
          // Android에서 네이티브 인터페이스가 없으면 웹 SDK 사용
          await handleGoogleSDKLogin();
        }
        
        return undefined; // Android 처리가 완료되면 함수 종료
      }
      
      // 웹 환경 또는 기타 환경에서 웹 SDK 사용
      console.log('🌐 [GOOGLE LOGIN] 웹 환경에서 Google 로그인 시도');
      await handleGoogleSDKLogin();
      
    } catch (error) {
      console.error('❌ [GOOGLE LOGIN] Google 로그인 실패', { error });
      
      // 취소된 로그인인지 확인
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('canceled') || errorMessage.includes('cancelled')) {
        console.log('ℹ️ [GOOGLE LOGIN] 사용자가 로그인을 취소했습니다.');
        setError('로그인이 취소되었습니다. 다시 시도해주세요.');
      } else {
        setError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
      }
      
      triggerHapticFeedback(HapticFeedbackType.ERROR);
    } finally {
      setIsLoading(false);
      // 진행 중 플래그 해제
      delete (window as any).__GOOGLE_LOGIN_IN_PROGRESS__;
    }
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
      console.log('❌ [FORCE CHECK] messageHandlers 객체 없음');
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
          console.error(`❌ [FORCE CHECK] ${handlerName} postMessage 함수 없음`);
        }
      } catch (error) {
        console.error(`❌ [FORCE CHECK] ${handlerName} 테스트 실패:`, error);
      }
    });
    
    console.log('🔍 [FORCE CHECK] 상세 핸들러 확인 완료');
  };

  // 🔍 카카오 SDK 상태 확인 함수
  const checkKakaoSDKStatus = () => {
    console.log('🔍 [KAKAO SDK] 카카오 SDK 상태 확인');
    
    const kakao = (window as any).Kakao;
    if (kakao) {
      console.log('✅ [KAKAO SDK] Kakao 객체 발견');
      console.log('🔍 [KAKAO SDK] Kakao.isInitialized():', kakao.isInitialized());
      return true;
    } else {
      console.log('❌ [KAKAO SDK] Kakao 객체 없음');
      return false;
    }
  };

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
  const recoverFromKakaoError = () => {
    console.log('🔍 [KAKAO RECOVER] 카카오 에러 복구 시도');
    
    try {
      // 카카오 SDK 재초기화
      if ((window as any).Kakao) {
        (window as any).Kakao.init(process.env.NEXT_PUBLIC_KAKAO_APP_KEY);
        console.log('✅ [KAKAO RECOVER] 카카오 SDK 재초기화 완료');
      }
    } catch (error) {
      console.error('❌ [KAKAO RECOVER] 카카오 에러 복구 실패:', error);
    }
  };

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
                  triggerHapticFeedback(HapticFeedbackType.LIGHT);
                  
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
              onClick={(e) => {
                console.log('💬 [KAKAO LOGIN] 버튼 클릭됨!');
                sendLogToiOS('info', '💬 Kakao 로그인 버튼 클릭됨', {
                  timestamp: new Date().toISOString(),
                  event: 'button_click',
                  isLoading: isLoading,
                  buttonDisabled: isLoading
                });
                
                // 햅틱 피드백 (버튼 클릭 시)
                triggerHapticFeedback(HapticFeedbackType.LIGHT);
                
                // 실제 핸들러 호출
                handleKakaoLogin();
              }}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-[#FEE500] hover:bg-[#F0D900] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
              onFocus={(e) => (e.target as HTMLButtonElement).style.boxShadow = '0 0 0 2px #FEE500'}
              onBlur={(e) => (e.target as HTMLButtonElement).style.boxShadow = ''}
            >
              <RiKakaoTalkFill className="w-5 h-5 mr-3" aria-hidden="true" />
              {isLoading ? (
                <LoadingSpinner message="로그인 중..." fullScreen={false} />
              ) : (
                'Kakao 계정으로 로그인'
              )}
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
          <AnimatePresence>
            {shouldShowModal && (
              <>
                {/* 배경 오버레이 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  onClick={closeErrorModal}
                />
                
                {/* 에러 모달 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto">
                    <div className="p-6">
                      {/* 에러 아이콘 */}
                      <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                        <FiAlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      
                      {/* 제목 */}
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                        로그인 실패
                      </h3>
                      
                      {/* 메시지 */}
                      <p className="text-gray-600 text-center mb-6">
                        {displayMessage}
                      </p>
                      
                      {/* 버튼들 */}
                      <div className="flex flex-col space-y-3">
                        {/* KOE006 에러인 경우 홈으로 이동 버튼 표시 */}
                        {(displayMessage.includes('카카오 앱 설정') || displayMessage.includes('KOE006')) && (
                          <button
                            onClick={handleErrorAndGoHome}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                          >
                            홈으로 이동
                          </button>
                        )}
                        
                        {/* 확인 버튼 */}
                        <button
                          onClick={closeErrorModal}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
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
};

export default SignInPage;