// frontend/src/app/signin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // Image 컴포넌트 임포트

// 아이콘 임포트 (react-icons 사용 예시)
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';

export default function SignInPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const router = useRouter();

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
      const response = await fetch('/api/auth/login', { // 실제 백엔드 API 경로로 수정 필요
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mt_hp: phoneNumber.replace(/-/g, ''), // PHP 코드의 mt_hp에 맞춤 (또는 mt_id)
          mt_pass: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // API에서 내려주는 오류 메시지가 있다면 사용, 없다면 기본 메시지
        throw new Error(data.message || '아이디 또는 비밀번호를 잘못 입력했습니다.');
      }

      // 로그인 성공
      router.push('/'); // 홈 화면으로 이동

    } catch (err: any) {
      setApiError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setApiError('');
    setFormErrors({});
    try {
      // Google OAuth 클라이언트 초기화
      const googleClient = window.google?.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: async (response: any) => {
          if (response.access_token) {
            try {
              const result = await fetch('/api/auth/social-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  provider: 'google',
                  token: response.access_token,
                }),
              });

              const data = await result.json();
              if (!result.ok) {
                throw new Error(data.message);
              }

              // 로그인 성공 시 홈으로 이동
              router.push('/');
            } catch (err: any) {
              setApiError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
            }
          }
        },
      });

      googleClient.requestAccessToken();
    } catch (err: any) {
      setApiError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
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
      // Kakao SDK 초기화
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID);
      }

      // Kakao 로그인 실행
      window.Kakao.Auth.login({
        success: async (authObj: any) => {
          try {
            const result = await fetch('/api/auth/social-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                provider: 'kakao',
                token: authObj.access_token,
              }),
            });

            const data = await result.json();
            if (!result.ok) {
              throw new Error(data.message);
            }

            // 로그인 성공 시 홈으로 이동
            router.push('/');
          } catch (err: any) {
            setApiError(err.message || 'Kakao 로그인 중 오류가 발생했습니다.');
          }
        },
        fail: (err: any) => {
          setApiError('Kakao 로그인에 실패했습니다.');
        },
      });
    } catch (err: any) {
      setApiError(err.message || 'Kakao 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google SDK 로드
  useEffect(() => {
    const loadGoogleSDK = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    };

    loadGoogleSDK();
  }, []);

  // Kakao SDK 로드
  useEffect(() => {
    const loadKakaoSDK = () => {
      const script = document.createElement('script');
      script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    };

    loadKakaoSDK();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div className="text-center">
          {/* 로고 추가 */}
          <Image 
            className="mx-auto h-20 w-auto" // mb-2 제거
            src="/images/smap_logo.webp" // public 폴더 경로부터 시작
            alt="SMAP Logo"
            width={160} // 실제 이미지 크기에 맞게 조절 (예시)
            height={80} // 실제 이미지 크기에 맞게 조절 (예시)
            priority // LCP 이미지일 경우 우선순위 로딩
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
              <label htmlFor="password_signin_phone" className="sr-only">비밀번호</label>
              <input
                id="password_signin_phone"
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

          {/* '로그인 상태 유지' 및 '비밀번호 찾기'는 전화번호 로그인 방식에 따라 조정 필요 */}
          {/* 
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <input id="remember-me-phone" name="remember-me-phone" type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
              <label htmlFor="remember-me-phone" className="ml-2 block text-gray-900">
                로그인 상태 유지
              </label>
            </div>
            <Link href="/forgot-password">
              <span className="font-medium text-indigo-600 hover:text-indigo-500">
                비밀번호를 잊으셨나요?
              </span>
            </Link>
          </div>
          */}

          <div>
            <button
              type="submit"
              disabled={isLoading && !apiError}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-105 active:scale-95 shadow-md"
            >
              {isLoading && !apiError ? (
                <LoadingSpinner message="로그인 중..." fullScreen={false} />
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
          <Link href="/register"> {/* 실제 회원가입 페이지 경로로 수정 필요 */}
            <span className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
              회원가입
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}

// 공통 로딩 스피너 컴포넌트 (버튼 내부용)
interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean; 
}
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "처리 중...", fullScreen = false }) => {
  // fullScreen={true} 일 때의 로직은 이전 LoadingSpinner.tsx와 동일하게 가정
  // 여기서는 fullScreen={false} (버튼 내부) 케이스만 간단히 표현
  return (
    <div className="flex items-center justify-center">
      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>{message}</span>
    </div>
  );
};