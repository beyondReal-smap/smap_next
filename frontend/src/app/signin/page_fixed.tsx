'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiLock, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import AlertModal from '@/components/ui/AlertModal';
import UnifiedLoadingSpinner from '../../../../components/UnifiedLoadingSpinner';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { comprehensivePreloadData } from '@/services/dataPreloadService';

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
  }
};

// 카카오 로그인 함수
const handleKakaoLogin = async () => {
  console.log('카카오 로그인 시도');
  // 카카오 로그인 로직 구현
};

export default function SignInPageFixed() {
  // 🚨 페이지 로드 디버깅
  console.log('[SIGNIN PAGE FIXED] 컴포넌트 로딩 시작', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });

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

  // 에러 표시 함수
  const showError = (message: string) => {
    console.log('[SIGNIN] 에러 표시:', message);
    setErrorModalMessage(message);
    setShowErrorModal(true);
    setIsLoading(false);
  };

  // 에러 모달 닫기
  const closeErrorModal = () => {
    setShowErrorModal(false);
    setErrorModalMessage('');
  };

  // 전화번호 로그인 처리
  const handlePhoneNumberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !password) {
      showError('전화번호와 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setApiError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('로그인 성공:', data.user);
        await login(data.user, data.token);
        router.push('/home');
      } else {
        setApiError(data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setApiError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google 로그인 처리
  const handleGoogleLogin = async () => {
    console.log('Google 로그인 시도');
    setIsLoading(true);
    
    try {
      // Android 브리지 확인
      if ((window as any).androidBridge?.googleSignIn?.signIn) {
        console.log('Android 브리지 사용');
        (window as any).androidBridge.googleSignIn.signIn();
        return;
      }
      
      // iOS 브리지 확인
      if ((window as any).iosBridge?.googleSignIn?.signIn) {
        console.log('iOS 브리지 사용');
        (window as any).iosBridge.googleSignIn.signIn();
        return;
      }
      
      // WebKit 메시지 핸들러 확인
      if ((window as any).webkit?.messageHandlers?.smapIos) {
        console.log('WebKit 메시지 핸들러 사용');
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          type: 'googleSignIn',
          param: ''
        });
        return;
      }
      
      // 웹 Google SDK 사용
      console.log('웹 Google SDK 사용');
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            try {
              const backendResponse = await fetch('/api/google-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              
              const data = await backendResponse.json();
              if (data.success) {
                await login(data.user, data.token);
                router.push('/home');
              } else {
                throw new Error(data.error || 'Google 인증 실패');
              }
            } catch (error) {
              console.error('Google 로그인 처리 실패:', error);
              showError('Google 로그인 처리 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          }
        });
        
        (window as any).google.accounts.id.prompt();
      } else {
        throw new Error('Google SDK를 사용할 수 없습니다.');
      }
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      showError('Google 로그인에 실패했습니다. 전화번호 로그인을 사용해주세요.');
      setIsLoading(false);
    }
  };

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // 인증 상태 확인
  useEffect(() => {
    if (isLoggedIn && !isRedirectingRef.current) {
      console.log('[SIGNIN] 로그인된 사용자 감지, /home으로 리다이렉트');
      isRedirectingRef.current = true;
      router.replace('/home');
      return;
    }

    if (!isLoggedIn && isCheckingAuth) {
      console.log('[SIGNIN] 로그인되지 않은 상태, 로그인 페이지 표시');
      setIsCheckingAuth(false);
    }
    
    return () => {
      isRedirectingRef.current = false;
    };
  }, [isLoggedIn, loading, isCheckingAuth, router]);

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

  // Google Sign-In 콜백 등록
  useEffect(() => {
    // Google Sign-In 성공 콜백
    (window as any).googleSignInSuccess = async (idToken: string, userInfoJson: any) => {
      console.log('[GOOGLE LOGIN] 성공 콜백 수신:', { idToken, userInfoJson });
      
      try {
        let userInfo;
        if (typeof userInfoJson === 'string') {
          userInfo = JSON.parse(userInfoJson);
        } else if (typeof userInfoJson === 'object' && userInfoJson !== null) {
          userInfo = userInfoJson;
        } else {
          throw new Error('사용자 정보를 가져올 수 없습니다.');
        }

        const response = await fetch('/api/google-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            userInfo,
            source: 'native'
          }),
        });

        const data = await response.json();
        if (data.success) {
          await login(data.user, data.token);
          router.push('/home');
        } else {
          throw new Error(data.error || 'Google 인증 실패');
        }
      } catch (error) {
        console.error('[GOOGLE LOGIN] 처리 실패:', error);
        showError('Google 로그인 처리 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    // Google Sign-In 실패 콜백
    (window as any).googleSignInError = (errorMessage: string) => {
      console.error('[GOOGLE LOGIN] 실패 콜백 수신:', errorMessage);
      showError(`Google 로그인 실패: ${errorMessage}`);
      setIsLoading(false);
    };

    return () => {
      delete (window as any).googleSignInSuccess;
      delete (window as any).googleSignInError;
    };
  }, [login, router]);

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

        {/* 전화번호 로그인 폼 */}
        <motion.form 
          onSubmit={handlePhoneNumberLogin}
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
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiPhone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder="010-1234-5678"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                maxLength={13}
              />
            </div>
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 에러 메시지 */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex">
                <FiAlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                <p className="text-sm text-red-600">{apiError}</p>
              </div>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <UnifiedLoadingSpinner size="sm" message="로그인 중..." />
            ) : (
              '로그인'
            )}
          </button>
        </motion.form>

        {/* 구분선 */}
        <motion.div 
          className="relative"
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
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500">
              또는 다음으로 계속
            </span>
          </div>
        </motion.div>

        {/* 소셜 로그인 버튼들 */}
        <motion.div 
          className="grid grid-cols-1 gap-3"
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
          {/* Google 로그인 버튼 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
          >
            {/* Google 아이콘 대신 FiMail 사용 */}
            <FiMail className="w-5 h-5 mr-3 text-gray-600" aria-hidden="true" />
            Google 계정으로 로그인
          </button>

          {/* Kakao 로그인 버튼 */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-[#FEE500] hover:bg-[#F0D900] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
          >
            {/* Kakao 아이콘 대신 FiAlertCircle 사용 */}
            <FiAlertCircle className="w-5 h-5 mr-3 text-black" aria-hidden="true" />
            {isLoading ? (
              <LoadingSpinner message="로그인 중..." fullScreen={false} />
            ) : (
              'Kakao 계정으로 로그인'
            )}
          </button>
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

      {/* 에러 모달 */}
      <AnimatePresence>
        {showErrorModal && (
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
                    {errorModalMessage}
                  </p>
                  
                  {/* 확인 버튼 */}
                  <button
                    onClick={closeErrorModal}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    확인
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 전체 화면 로딩 스피너 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg">
            <UnifiedLoadingSpinner size="md" message="처리 중..." />
          </div>
        </div>
      )}
    </motion.div>
  );
} 