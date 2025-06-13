// frontend/src/app/signin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // Image 컴포넌트 임포트
import { motion, AnimatePresence } from 'framer-motion';
import { signIn, getSession } from 'next-auth/react';
import authService from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';

// 아이콘 임포트 (react-icons 사용 예시)
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';
import { FiX, FiAlertTriangle, FiPhone, FiLock } from 'react-icons/fi';

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
  const { login } = useAuth();

  // 이미 로그인된 사용자 감지 및 자동 리다이렉트
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        console.log('[SIGNIN] 기존 인증 상태 확인 중...');
        
        // 쿠키에서 JWT 토큰 확인
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1];

        if (token) {
          console.log('[SIGNIN] JWT 토큰 발견, 유효성 검증 중...');
          
          // 토큰 유효성 검증
          const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              console.log('[SIGNIN] 유효한 토큰 발견, 홈으로 리다이렉트');
              router.replace('/home');
              return;
            }
          } else {
            console.log('[SIGNIN] 토큰이 유효하지 않음, 쿠키 삭제');
            // 유효하지 않은 토큰 삭제
            document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }

        console.log('[SIGNIN] 기존 인증 없음, 로그인 페이지 표시');
      } catch (error) {
        console.error('[SIGNIN] 인증 상태 확인 중 오류:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkExistingAuth();
  }, [router]);

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
    e.preventDefault();
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

      console.log('[SIGNIN] AuthContext 로그인 성공');
      
      // home/page.tsx로 이동
      router.push('/home');

    } catch (err: any) {
      console.error('[SIGNIN] 로그인 오류:', err);
      const errorMessage = err.message || '아이디 또는 비밀번호가 올바르지 않습니다.';
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 에러 모달 닫기
  const closeErrorModal = () => {
    setShowErrorModal(false);
    setErrorModalMessage('');
  };

  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Google 로그인 시도');
      
      // NextAuth.js를 통한 Google 로그인
      const result = await signIn('google', {
        redirect: false, // 자동 리디렉션 방지
        callbackUrl: '/home'
      });

      console.log('Google 로그인 결과:', result);

      if (result?.error) {
        throw new Error(result.error);
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

        // home 페이지로 이동
        router.push('/home');
      }
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      setErrorModalMessage('Google 로그인에 실패했습니다.');
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
              
              // 로그인 성공 시 홈 페이지로 이동
              router.push('/home');
            } else {
              throw new Error(data.error || '로그인에 실패했습니다.');
            }
          } catch (error: any) {
            console.error('카카오 로그인 처리 오류:', error);
            setErrorModalMessage(error.message || '로그인 처리 중 오류가 발생했습니다.');
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

  // 로딩 스피너 컴포넌트
  const LoadingSpinner = ({ message, fullScreen = true }: { message: string; fullScreen?: boolean }) => {
    if (fullScreen) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="text-gray-700">{message}</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span>{message}</span>
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
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">인증 상태 확인 중</h2>
          <p className="text-gray-600">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

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
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
            >
              <FcGoogle className="w-5 h-5 mr-3" aria-hidden="true" />
              Google 계정으로 로그인
            </button>

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
      <AnimatePresence>
        {showErrorModal && (
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeErrorModal}
          >
            <motion.div 
              className="bg-white rounded-3xl w-full max-w-sm mx-auto shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiAlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">로그인 실패</h3>
                  <p className="text-gray-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                    {errorModalMessage}
                  </p>
                </div>
                
                <motion.button
                  onClick={closeErrorModal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 transition-colors"
                >
                  확인
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 전체 화면 로딩 스피너 */}
      {isLoading && <LoadingSpinner message="처리 중..." />}
    </motion.div>
  );
}