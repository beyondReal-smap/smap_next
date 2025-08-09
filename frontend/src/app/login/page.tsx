'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, loading: authLoading } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Google 로그인 핸들러 - 네이티브 앱 연동
  const handleGoogleLogin = async () => {
    console.log('🔥 [LOGIN] 네이티브 구글 로그인 요청');
    setIsLoading(true);
    setApiError('');
    setFormErrors({});
    
    try {
      // 네이티브 앱에 구글 로그인 요청
      if (typeof window !== 'undefined' && (window as any).webkit?.messageHandlers?.smapIos) {
        console.log('🔥 [LOGIN] iOS 네이티브 구글 로그인 호출');
        (window as any).webkit.messageHandlers.smapIos.postMessage({
          action: 'googleLogin',
          callback: 'handleGoogleLoginResult'
        });
      } else if (typeof window !== 'undefined' && (window as any).Android) {
        console.log('🔥 [LOGIN] Android 네이티브 구글 로그인 호출');
        (window as any).Android.googleLogin();
      } else {
        console.log('🔥 [LOGIN] 네이티브 브릿지가 없습니다. 네이티브 앱에서만 구글 로그인이 가능합니다.');
        setApiError('네이티브 앱에서만 구글 로그인이 가능합니다.');
      }
    } catch (err: any) {
      console.error('Google 로그인 오류:', err);
      setApiError('네이티브 구글 로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 네이티브에서 받은 구글 로그인 결과 처리
  const handleGoogleLoginResult = async (googleData: any) => {
    console.log('🔥 [LOGIN] 네이티브에서 구글 로그인 결과 수신:', googleData);
    
    try {
      // 구글 데이터를 서버로 전송하여 사용자 확인
      const response = await fetch('/api/google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: googleData.credential || googleData.idToken,
          user: googleData.user
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Google 로그인에 실패했습니다.');
      }

      if (data.success) {
        console.log('🔥 [LOGIN] Google 로그인 응답:', data);
        
        if (data.isNewUser) {
          // 신규 회원 - register 페이지로 이동하면서 구글 정보 전달
          const socialData = {
            provider: 'google',
            email: data.user.email,
            name: data.user.name,
            nickname: data.user.nickname,
            profile_image: data.user.profile_image,
            google_id: data.user.google_id
          };
          
          console.log('🔥 [LOGIN] 신규 사용자 - localStorage에 저장:', socialData);
          localStorage.setItem('socialLoginData', JSON.stringify(socialData));
          router.push('/register?social=google');
        } else {
          // 기존 회원 - 로그인 처리
          const authService = await import('@/services/authService');
          if (data.token) {
            authService.default.setToken(data.token);
          }
          authService.default.setUserData(data.user);
          
          // FCM 토큰 체크 및 업데이트 (백그라운드에서 실행)
          setTimeout(async () => {
            try {
              console.log('[LOGIN] 🔔 Google 로그인 후 FCM 토큰 체크/업데이트 시작');
              const fcmTokenService = (await import('@/services/fcmTokenService')).default;
              
              if (data.user?.mt_idx) {
                const fcmResult = await fcmTokenService.initializeAndCheckUpdateToken(data.user.mt_idx);
                if (fcmResult.success) {
                  console.log('[LOGIN] ✅ FCM 토큰 체크/업데이트 완료:', fcmResult.message);
                } else {
                  console.warn('[LOGIN] ⚠️ FCM 토큰 체크/업데이트 실패:', fcmResult.error);
                }
              } else {
                console.warn('[LOGIN] ⚠️ FCM 토큰 체크/업데이트 스킵: mt_idx 없음');
              }
            } catch (fcmError) {
              console.error('[LOGIN] ❌ FCM 토큰 체크/업데이트 중 오류:', fcmError);
            }
          }, 1000); // Google 로그인 후 1초 지연
          
          console.log('Google 로그인 성공:', data.user);
          router.push('/home');
        }
      } else {
        throw new Error(data.message || 'Google 로그인에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Google 로그인 결과 처리 오류:', err);
      setApiError('구글 로그인 결과 처리에 실패했습니다.');
    }
  };

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      router.push('/home');
    }
  }, [isLoggedIn, authLoading, router]);

  // 네이티브 앱에서 호출할 수 있도록 전역 함수 등록
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).handleGoogleLoginResult = handleGoogleLoginResult;
      (window as any).handleGoogleLogin = handleGoogleLogin;
      console.log('🔥 [LOGIN] 전역 함수 등록 완료: handleGoogleLoginResult, handleGoogleLogin');
    }
  }, [handleGoogleLoginResult, handleGoogleLogin]);

  // 전화번호 포맷팅 함수
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

  // 전화번호 로그인 핸들러 (AuthContext 사용)
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
      // AuthContext의 login 함수 사용
      await login({
        mt_id: phoneNumber.replace(/-/g, ''), // 전화번호에서 하이픈 제거
        mt_pwd: password
      });
      
      console.log('전화번호 로그인 성공');
      router.push('/home');
    } catch (error: any) {
      console.error('전화번호 로그인 오류:', error);
      setApiError(error.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Kakao 로그인 핸들러
  const handleKakaoLogin = async () => {
    setIsLoading(true);
    setApiError('');
    setFormErrors({});
    
    try {
      console.log('Kakao 로그인 시도 중...');
      
      const response = await fetch('/api/kakao-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: `demo-kakao-token-${Date.now()}`
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Kakao 로그인에 실패했습니다.');
      }

      if (data.success && data.data) {
        if (data.data.isNewUser) {
          // 신규 회원 - register 페이지로 이동하면서 카카오 정보 전달
          const socialData = {
            provider: 'kakao',
            email: data.data.user.email,
            name: data.data.user.name,
            nickname: data.data.user.nickname,
            profile_image: data.data.user.profile_image,
            kakao_id: data.data.user.kakao_id
          };
          
          localStorage.setItem('socialLoginData', JSON.stringify(socialData));
          router.push('/register?social=kakao');
        } else {
          // 기존 회원 - 로그인 처리
          const authService = await import('@/services/authService');
          if (data.data.token) {
            authService.default.setToken(data.data.token);
          }
          authService.default.setUserData(data.data.user);
          
          console.log('Kakao 로그인 성공:', data.data.user);
          router.push('/home');
        }
      } else {
        throw new Error(data.message || 'Kakao 로그인에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Kakao 로그인 오류:', err);
      setApiError('카카오 로그인은 실제 카카오 SDK 구현이 필요합니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 로딩 중이면 로딩 스피너 표시
  if (authLoading) {
    return (
      <LoadingSpinner 
        message="로그인 상태를 확인하는 중입니다..." 
        fullScreen={true}
        type="ripple"
        size="md"
        color="blue"
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div className="text-center">
          {/* 로고 추가 */}
          <Image 
            className="mx-auto h-20 w-auto" 
            src="/images/smap_logo.webp" 
            alt="SMAP Logo"
            width={160} 
            height={80} 
            priority 
          />
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            SMAP 로그인
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            계정에 로그인하여 서비스를 이용하세요.
          </p>
        </div>

        {/* 전화번호 로그인 폼 */}
        <form className="mt-8 space-y-6" onSubmit={handlePhoneNumberLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="phone-number" className="sr-only">전화번호</label>
              <input
                id="phone-number"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-shadow"
                placeholder="전화번호 ('-' 없이 입력)"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                maxLength={13}
              />
            </div>
            {formErrors.phoneNumber && (
              <p className="text-xs text-red-600 px-1 pt-1">{formErrors.phoneNumber}</p>
            )}
            <div>
              <label htmlFor="password_login_phone" className="sr-only">비밀번호</label>
              <input
                id="password_login_phone"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-shadow"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {formErrors.password && (
              <p className="text-xs text-red-600 px-1 pt-1">{formErrors.password}</p>
            )}
          </div>

          {apiError && (
            <p className="text-xs text-red-600 text-center bg-red-50 p-2 rounded-md">{apiError}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95 shadow-md"
            >
              {isLoading ? (
                <InlineLoadingSpinner message="로그인 중..." />
              ) : (
                '전화번호로 로그인'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6">
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

          <div className="mt-6 grid grid-cols-1 gap-4">
            {/* Google 로그인 버튼 */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
            >
              <FcGoogle className="w-5 h-5 mr-3" aria-hidden="true" />
              Google 계정으로 로그인
            </button>

            {/* Kakao 로그인 버튼 */}
            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-black bg-[#FEE500] hover:bg-[#F0D900] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95"
            >
              <RiKakaoTalkFill className="w-5 h-5 mr-3" aria-hidden="true" />
              Kakao 계정으로 로그인
            </button>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link href="/register">
            <span className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
              회원가입
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}

// 인라인 로딩 스피너 컴포넌트 (버튼 내부용)
interface InlineLoadingSpinnerProps {
  message?: string;
}

const InlineLoadingSpinner: React.FC<InlineLoadingSpinnerProps> = ({ message = "처리 중..." }) => {
  return (
    <div className="flex items-center justify-center">
                              <svg className="unified-animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>{message}</span>
    </div>
  );
}; 