// frontend/src/app/signin/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // Image 컴포넌트 임포트
import { motion, AnimatePresence } from 'framer-motion';
import { signIn, getSession } from 'next-auth/react';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import UnifiedLoadingSpinner from '../../../../components/UnifiedLoadingSpinner';

// 아이콘 임포트 (react-icons 사용 예시)
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiX, FiAlertTriangle, FiPhone, FiLock, FiEye, FiEyeOff, FiMail, FiUser } from 'react-icons/fi';
import { AlertModal } from '@/components/ui';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export default function SignInPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggedIn, loading } = useAuth();

  // AuthContext 상태 변화 감지 및 자동 리다이렉트
  useEffect(() => {
    console.log('[SIGNIN] AuthContext 상태 확인:', { isLoggedIn, loading, showErrorModal });
    
    // 로딩 중이면 대기
    if (loading) {
      console.log('[SIGNIN] AuthContext 로딩 중, 대기...');
      return;
    }

    // 에러 모달이 표시 중이면 리다이렉트 하지 않음
    if (showErrorModal) {
      console.log('[SIGNIN] 에러 모달 표시 중, 리다이렉트 건너뛰기');
      return;
    }

    // 로그인된 사용자는 홈으로 리다이렉트
    if (isLoggedIn) {
      console.log('[SIGNIN] 로그인된 사용자 감지, /home으로 리다이렉트');
      router.replace('/home');
      return;
    }

    console.log('[SIGNIN] 로그인되지 않은 상태, 로그인 페이지 표시');
    setIsCheckingAuth(false);
  }, [isLoggedIn, loading, router, showErrorModal]);

  // 초기 인증 상태 확인 (페이지 첫 로드 시에만)
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        console.log('[SIGNIN] 초기 인증 상태 확인 중...');
        
        // URL에서 탈퇴 완료 플래그 확인
        const urlParams = new URLSearchParams(window.location.search);
        const isFromWithdraw = urlParams.get('from') === 'withdraw';
        
        if (isFromWithdraw) {
          console.log('[SIGNIN] 탈퇴 후 접근 - 자동 로그인 건너뛰기');
          
          // URL에서 from 파라미터 제거
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('from');
          window.history.replaceState({}, '', newUrl.toString());
          
          return;
        }
        
        // AuthContext가 아직 로딩 중이면 대기
        if (loading) {
          console.log('[SIGNIN] AuthContext 로딩 중, 초기 확인 건너뛰기');
          return;
        }

        // AuthContext에서 이미 로그인 상태라면 리다이렉트
        if (isLoggedIn) {
          console.log('[SIGNIN] AuthContext에서 로그인 상태 확인, /home으로 리다이렉트');
          router.replace('/home');
          return;
        }

        console.log('[SIGNIN] 초기 인증 없음, 로그인 페이지 표시');
      } catch (error) {
        console.error('[SIGNIN] 초기 인증 상태 확인 중 오류:', error);
      }
    };

    // 컴포넌트 마운트 시 한 번만 실행
    checkExistingAuth();
  }, []); // 빈 의존성 배열로 한 번만 실행

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

  // 에러 모달 상태 디버깅
  useEffect(() => {
    console.log('[SIGNIN] 에러 모달 상태 변화:', { showErrorModal, errorModalMessage });
  }, [showErrorModal, errorModalMessage]);

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
      
      // AuthContext를 통해 로그인
      await login({
        mt_id: phoneNumber.replace(/-/g, ''), // 전화번호에서 하이픈 제거
        mt_pwd: password,
      });

      console.log('[SIGNIN] AuthContext 로그인 성공 - 자동 리다이렉션 대기');
      
      // 수동 리다이렉션 제거 - AuthContext의 자동 리다이렉션 사용
      // router.push('/home'); // 이 줄을 제거

    } catch (err: any) {
      console.error('[SIGNIN] 로그인 오류:', err);
      console.log('[SIGNIN] 에러 메시지:', err.message);
      
      const errorMessage = err.message || '아이디 또는 비밀번호가 올바르지 않습니다.';
      console.log('[SIGNIN] 모달에 표시할 메시지:', errorMessage);
      
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
      
      console.log('[SIGNIN] 에러 모달 상태 설정 완료');
    } finally {
      setIsLoading(false);
      console.log('[SIGNIN] 로그인 시도 완료');
    }
  };

  // 에러 모달 닫기
  const closeErrorModal = () => {
    console.log('[SIGNIN] 에러 모달 닫기 시작');
    setShowErrorModal(false);
    setErrorModalMessage('');
    console.log('[SIGNIN] 에러 모달 닫기 완료 - 사용자가 signin 페이지에 남아있어야 함');
  };

  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Google 로그인 시도');
      
      // iOS WebView에서 구글 로그인 차단 감지
      const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
      if (isIOSWebView) {
        console.log('iOS WebView에서 구글 로그인 시도 감지');
        
        // iOS 앱에 구글 로그인 요청 전달
        try {
          if ((window as any).webkit?.messageHandlers?.googleLogin) {
            (window as any).webkit.messageHandlers.googleLogin.postMessage({
              action: 'startLogin',
              source: 'signin_page'
            });
            return; // 네이티브 처리로 위임
          }
        } catch (e) {
          console.error('iOS 네이티브 구글 로그인 요청 실패:', e);
        }
        
        // 네이티브 처리가 불가능한 경우 사용자에게 안내
        setErrorModalMessage('앱 내에서 구글 로그인이 제한됩니다. Safari 브라우저에서 시도해주세요.');
        setShowErrorModal(true);
        setIsLoading(false);
        return;
      }
      
      // NextAuth.js를 통한 Google 로그인
      const result = await signIn('google', {
        redirect: false, // 자동 리디렉션 방지
        callbackUrl: '/home'
      });

      console.log('Google 로그인 결과:', result);

      if (result?.error) {
        // 구글 로그인 에러 처리
        if (result.error.includes('disallowed_useragent') || 
            result.error.includes('403') ||
            result.error.includes('blocked')) {
          setErrorModalMessage('구글 로그인이 차단되었습니다. Safari 브라우저에서 시도해주세요.');
        } else {
          setErrorModalMessage(`구글 로그인 실패: ${result.error}`);
        }
        setShowErrorModal(true);
        return;
      }

      if (result?.ok) {
        // 세션 정보 가져오기
        const session = await getSession();
        console.log('Google 로그인 세션:', session);

        if (session?.backendData) {
          // authService를 통해 사용자 정보 저장 (AuthContext가 인식할 수 있도록)
          try {
            const userData = session.backendData.member;
            const token = session.backendData.token || '';
            
            console.log('[GOOGLE LOGIN] 새로운 사용자 정보:', userData.mt_name, 'ID:', userData.mt_idx);
            
            // 기존 데이터와 다른 사용자면 완전 초기화
            const existingUserData = authService.getUserData();
            if (existingUserData && existingUserData.mt_idx !== userData.mt_idx) {
              console.log('[GOOGLE LOGIN] 다른 사용자 감지, 기존 데이터 초기화:', existingUserData.mt_idx, '->', userData.mt_idx);
              authService.clearAuthData(); // 기존 데이터 완전 삭제
            }
            
            // authService를 통해 저장하여 AuthContext가 인식하도록 함
            authService.setUserData(userData);
            authService.setToken(token);
            
            console.log('[GOOGLE LOGIN] 저장 완료, home으로 이동');
          } catch (error) {
            console.error('사용자 정보 저장 실패:', error);
          }
        }

        // 수동 리다이렉션 제거 - AuthContext의 자동 리다이렉션 사용
        // router.push('/home'); // 이 줄을 제거
        console.log('[GOOGLE LOGIN] 로그인 성공 - 자동 리다이렉션 대기');
      }
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      
      // 에러 메시지 개선
      let errorMessage = 'Google 로그인에 실패했습니다.';
      if (error instanceof Error) {
        if (error.message.includes('disallowed_useragent') || 
            error.message.includes('403') ||
            error.message.includes('blocked')) {
          errorMessage = '구글 로그인이 차단되었습니다. Safari 브라우저에서 시도해주세요.';
        } else if (error.message.includes('network')) {
          errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
        } else {
          errorMessage = `구글 로그인 오류: ${error.message}`;
        }
      }
      
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Kakao 로그인 핸들러
  const handleKakaoLogin = async () => {
    // 카카오 SDK가 로드되었는지 확인
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      setErrorModalMessage('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      setShowErrorModal(true);
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
              
              // 수동 리다이렉션 제거 - AuthContext의 자동 리다이렉션 사용
              // router.push('/home'); // 이 줄을 제거
              console.log('[KAKAO LOGIN] 로그인 성공 - 자동 리다이렉션 대기');
            } else {
              throw new Error(data.error || '로그인에 실패했습니다.');
            }
          } catch (error: any) {
            console.error('카카오 로그인 처리 오류:', error);
            
            // 탈퇴한 사용자 오류 처리
            if (error.response?.status === 403 && error.response?.data?.isWithdrawnUser) {
              setErrorModalMessage('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
            } else {
              setErrorModalMessage(error.message || '로그인 처리 중 오류가 발생했습니다.');
            }
            setShowErrorModal(true);
          } finally {
            setIsLoading(false);
          }
        },
        fail: (error: any) => {
          console.error('카카오 로그인 실패:', error);
          setErrorModalMessage('카카오 로그인에 실패했습니다.');
          setShowErrorModal(true);
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      setErrorModalMessage('카카오 로그인 중 오류가 발생했습니다.');
      setShowErrorModal(true);
      setIsLoading(false);
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
              {typeof window !== 'undefined' && (window as any).webkit && (window as any).webkit.messageHandlers && (
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
              )}
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

      {/* 에러 모달 */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={closeErrorModal}
        message="로그인 실패"
        description={errorModalMessage}
        buttonText="확인"
        type="error"
      />

      {/* 전체 화면 로딩 스피너 */}
      {isLoading && <LoadingSpinner message="처리 중..." />}
    </motion.div>
  );
}