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
import { hapticFeedback } from '@/utils/haptic';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export default function SignInPage() {
  // 🚨 페이지 로드 즉시 브라우저 저장소에서 에러 모달 상태 확인 및 복원
  const [showErrorModal, setShowErrorModal] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedErrorFlag = sessionStorage.getItem('__SIGNIN_ERROR_MODAL_ACTIVE__') === 'true';
      if (savedErrorFlag) {
        console.log('[SIGNIN] 🔄 페이지 로드 시 브라우저 저장소에서 에러 모달 상태 복원');
        
        // 전역 플래그도 즉시 복원
        const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
        (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__ = true;
        (window as any).__SIGNIN_ERROR_MESSAGE__ = savedErrorMessage;
        
        return true;
      }
    }
    return false;
  });
  
  const [errorModalMessage, setErrorModalMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedErrorMessage = sessionStorage.getItem('__SIGNIN_ERROR_MESSAGE__') || '';
      if (savedErrorMessage) {
        console.log('[SIGNIN] 🔄 페이지 로드 시 에러 메시지 복원:', savedErrorMessage);
        return savedErrorMessage;
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
  const { login, isLoggedIn, loading, error, setError } = useAuth();
  
  // 리다이렉트 중복 실행 방지 플래그
  const isRedirectingRef = useRef(false);
  
  // 에러 처리 완료 플래그 - 한 번 에러를 처리하면 더 이상 처리하지 않음
  const errorProcessedRef = useRef(false);
  
  // 에러 모달 표시 중 모든 useEffect 차단 플래그
  const blockAllEffectsRef = useRef(false);
  
  // 🔒 컴포넌트 재마운트 방지 플래그들
  const componentMountedRef = useRef(false);
  const preventRemountRef = useRef(false);
  
  // 네비게이션 차단 이벤트 리스너 참조
  const navigationListenersRef = useRef<{
    beforeunload?: (e: BeforeUnloadEvent) => void;
    popstate?: (e: PopStateEvent) => void;
    unload?: (e: Event) => void;
    pagehide?: (e: PageTransitionEvent) => void;
    visibilitychange?: (e: Event) => void;
    keydown?: (e: KeyboardEvent) => void;
  }>({});

  // iOS 네이티브 로그 전송 함수
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
          sendLogToiOS('info', 'Google Auth API 성공', {
            success: data.success,
            hasUser: !!data.user,
            hasToken: !!data.token
          });

          if (data.success) {
            console.log('[GOOGLE LOGIN] 네이티브 Google 로그인 성공, 사용자 정보:', data.user);
            
            // AuthContext에 사용자 정보 설정
            if (data.user && data.token) {
              authService.setUserData(data.user);
              authService.setToken(data.token);
              
              console.log('[GOOGLE LOGIN] 로그인 성공 - home으로 즉시 리다이렉션');
              
              // Google 로그인 성공 햅틱 피드백
              hapticFeedback.success();
              
              // 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
              // router.replace 사용 (페이지 새로고침 없이 이동)
              router.replace('/home');
            }
          } else {
            throw new Error(data.error || '로그인에 실패했습니다.');
          }
        } catch (error: any) {
          console.error('[GOOGLE LOGIN] 네이티브 Google 로그인 처리 오류:', error);
          
          // Google 로그인 실패 햅틱 피드백
          hapticFeedback.error();
          
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
        hapticFeedback.error();
        
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
      setFormErrors(currentFormErrors);
      setIsLoading(false);
      return;
    }

    try {
      console.log('[SIGNIN] AuthContext login 호출 시작');
      
      // 전화번호 로그인 시작 시 AuthContext 에러 감지 비활성화
      blockAllEffectsRef.current = true;
      console.log('[SIGNIN] AuthContext 에러 감지 비활성화');
      
      // AuthContext를 통해 로그인
      await login({
        mt_id: phoneNumber.replace(/-/g, ''), // 전화번호에서 하이픈 제거
        mt_pwd: password,
      });

      console.log('[SIGNIN] AuthContext 로그인 성공 - home으로 즉시 리다이렉션');
      
      // 로그인 성공 햅틱 피드백
      hapticFeedback.success();
      
      // 리다이렉트 플래그 설정하여 useEffect에서 처리하도록 함
      isRedirectingRef.current = true;
      
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
    
    // 🚨 즉시 기본 이벤트 차단
    const emergencyBlocker = (e: Event) => {
      console.log('[SIGNIN] 🚨 긴급 이벤트 차단:', e.type);
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    };
    
    // 즉시 모든 위험한 이벤트 차단
    window.addEventListener('beforeunload', emergencyBlocker, { capture: true, passive: false });
    window.addEventListener('unload', emergencyBlocker, { capture: true, passive: false });
    window.addEventListener('pagehide', emergencyBlocker, { capture: true, passive: false });
    document.addEventListener('visibilitychange', emergencyBlocker, { capture: true, passive: false });
    
    // 🚨 즉시 히스토리 고정 (여러 번)
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
    
    // 🚨 즉시 키보드 차단
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
      
      // beforeunload 이벤트 (새로고침, 창 닫기 차단)
      navigationListenersRef.current.beforeunload = (e: BeforeUnloadEvent) => {
        console.log('[SIGNIN] 🚫 beforeunload 이벤트 차단!');
        e.preventDefault();
        e.stopImmediatePropagation();
        e.returnValue = '에러 모달을 확인해주세요.';
        // iOS WebView에서는 return 문 제거 (JavaScript execution 오류 방지)
        const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
        if (!isIOSWebView) {
          return false;
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
      
      // 모든 이벤트 리스너 추가 (capture와 passive 모두)
      const eventOptions = { capture: true, passive: false };
      window.addEventListener('beforeunload', navigationListenersRef.current.beforeunload, eventOptions);
      window.addEventListener('popstate', navigationListenersRef.current.popstate, eventOptions);
      window.addEventListener('unload', navigationListenersRef.current.unload, eventOptions);
      window.addEventListener('pagehide', navigationListenersRef.current.pagehide, eventOptions);
      document.addEventListener('visibilitychange', navigationListenersRef.current.visibilitychange, eventOptions);
      
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
      
      window.addEventListener('keydown', navigationListenersRef.current.keydown, eventOptions);
      
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
      
      // 웹 환경에서는 NextAuth.js를 통한 Google 로그인 (임시 비활성화)
      console.log('웹 환경에서 Google 로그인 시도');
      
      // 에러 모달 강제 표시
      setTimeout(() => {
        showError('웹 환경에서는 Google 로그인이 현재 사용할 수 없습니다. 앱에서 이용해주세요.');
      }, 100);
      
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

  // Kakao 로그인 핸들러
  const handleKakaoLogin = async () => {
    // 카카오 SDK가 로드되었는지 확인
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showError('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsLoading(true);
    
    try {
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
              
              // AuthContext에 사용자 정보 설정 (JWT 토큰은 이미 쿠키에 저장됨)
              // AuthContext가 쿠키에서 토큰을 자동으로 읽어올 것임
              
              console.log('[KAKAO LOGIN] 로그인 성공 - home으로 즉시 리다이렉션');
              
              // 리다이렉트 플래그 설정
              isRedirectingRef.current = true;
              
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
          console.error('카카오 로그인 실패:', error);
          showError('카카오 로그인에 실패했습니다.');
        },
      });
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      showError('카카오 로그인 중 오류가 발생했습니다.');
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

  return (
    <motion.div 
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-6 px-4 sm:px-6 lg:px-8"
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
              <FiPhone className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                focusedField === 'phone' || phoneNumber ? 'text-indigo-500' : 'text-gray-400'
              }`} />
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                placeholder="010-1234-5678"
                maxLength={13}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${
                  formErrors.phoneNumber 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200 focus:ring-indigo-500'
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
              <FiLock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                focusedField === 'password' || password ? 'text-indigo-500' : 'text-gray-400'
              }`} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="비밀번호를 입력해주세요"
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-200 ${
                  formErrors.password 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200 focus:ring-indigo-500'
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
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95 shadow-md"
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
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
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
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
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