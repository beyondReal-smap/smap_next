'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface SocialLoginButtonProps {
  provider: string;
  bgColor: string;
  hoverColor: string;
  textColor: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const SocialLoginButton = ({ 
  provider, 
  bgColor, 
  hoverColor, 
  textColor, 
  icon, 
  onClick 
}: SocialLoginButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-sm 
        font-medium text-${textColor} ${bgColor} hover:${hoverColor} 
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        mb-3`}
    >
      <span className="mr-2">{icon}</span>
      <span>{provider}로 계속하기</span>
    </button>
  );
};

export default function SocialLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSocialLogin = async (provider: string) => {
    setIsLoading(true);
    setError('');

    try {
      console.log(`${provider} 로그인 시도 중...`);
      
      if (provider === '구글' || provider === 'google') {
        // 구글 로그인 처리
        try {
          const response = await fetch('/api/google-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              credential: `demo-google-credential-${Date.now()}`
            }),
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || '구글 로그인에 실패했습니다.');
          }

          if (data.success && data.data) {
            if (data.data.isNewUser) {
              // 신규 회원 - register 페이지로 이동하면서 구글 정보 전달
              const socialData = {
                provider: 'google',
                email: data.data.user.mt_email,
                name: data.data.user.mt_name,
                nickname: data.data.user.mt_nickname,
                profile_image: data.data.user.mt_file1,
                google_id: data.data.user.google_id
              };
              
              localStorage.setItem('socialLoginData', JSON.stringify(socialData));
              router.push('/register?social=google');
            } else {
              // 기존 회원 - 로그인 처리
              const authService = await import('@/services/authService');
              if (data.data.token) {
                authService.default.setToken(data.data.token);
              }
              authService.default.setUserData(data.data.user);
              
              console.log('구글 로그인 성공:', data.data.user);
              router.push('/home');
            }
          } else {
            throw new Error(data.message || '구글 로그인에 실패했습니다.');
          }
        } catch (err) {
          console.error('구글 로그인 API 오류:', err);
          // 실제 구글 로그인 실패 시 안내 메시지
          setError('구글 로그인은 실제 구글 SDK 구현이 필요합니다. 데모 모드를 위해 네이버나 애플을 사용해주세요.');
        }
      } else if (provider === '카카오' || provider === 'kakao') {
        // 카카오 로그인 처리
        try {
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
            throw new Error(data.message || '카카오 로그인에 실패했습니다.');
          }

          if (data.success && data.data) {
            if (data.data.isNewUser) {
              // 신규 회원 - register 페이지로 이동하면서 카카오 정보 전달
              const socialData = {
                provider: 'kakao',
                email: data.data.user.mt_email,
                name: data.data.user.mt_name,
                nickname: data.data.user.mt_nickname,
                profile_image: data.data.user.mt_file1,
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
              
              console.log('카카오 로그인 성공:', data.data.user);
              router.push('/home');
            }
          } else {
            throw new Error(data.message || '카카오 로그인에 실패했습니다.');
          }
        } catch (err) {
          console.error('카카오 로그인 API 오류:', err);
          // 실제 카카오 로그인 실패 시 안내 메시지
          setError('카카오 로그인은 실제 카카오 SDK 구현이 필요합니다. 데모 모드를 위해 네이버나 애플을 사용해주세요.');
        }
      } else {
        // 기타 소셜 로그인은 데모 모드로 처리
        const response = await fetch('/api/auth/social-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: provider.toLowerCase(),
            token: `demo-${provider}-token-${Date.now()}`
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `${provider} 로그인에 실패했습니다.`);
        }

        if (data.success && data.data) {
          // AuthService를 통해 토큰과 사용자 정보 저장
          const authService = await import('@/services/authService');
          if (data.data.token) {
            authService.default.setToken(data.data.token);
          }
          authService.default.setUserData(data.data.member);
          
          console.log(`${provider} 로그인 성공:`, data.data.member);
          router.push('/home');
        } else {
          throw new Error(data.message || `${provider} 로그인에 실패했습니다.`);
        }
      }
      
    } catch (err: any) {
      console.error(`${provider} 로그인 오류:`, err);
      setError(`${provider} 로그인 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // SVG 아이콘들
  const kakaoIcon = (
    <svg width="18" height="18" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <path fill="#3A1D1D" d="M128 36C70.562 36 24 72.713 24 118.875c0 29.09 19.361 54.647 48.736 69.285c-2.063 7.629-7.436 27.737-8.542 32.007c-1.339 5.3 1.956 5.225 4.099 3.803c1.675-1.114 26.56-18.03 37.084-25.306c7.322 1.38 14.917 2.086 22.623 2.086c57.438 0 104-36.713 104-82.875S185.438 36 128 36"/>
      <path fill="#FFFFFF" d="M70.828 113.75l-14.777 19.099c-1.391 1.795-4.508 1.365-5.096-.703l-7.496-26.548c-.502-1.776.962-3.469 2.77-3.177l22.23 3.567c2.193.352 2.964 2.998 1.37 4.742L70.828 113.75zm69.427 17.135c-.762.803-1.783 1.211-2.801 1.211c-.914 0-1.832-.337-2.549-.994l-1.442-1.329c-3.437 1.559-7.244 2.429-11.262 2.429c-14.943 0-27.09-11.582-27.09-25.852S107.258 80.5 122.2 80.5c14.943 0 27.09 11.582 27.09 25.852c0 5.748-2.051 11.059-5.486 15.404l2.773 2.55c1.398 1.286 1.498 3.466.233 4.879l-2.822 3.061c-.948 1.03-2.447 1.282-3.65.634c-.016-.009-.032-.018-.047-.027l-.036-.019zm70.332-28.061l-7.496 26.548c-.588 2.068-3.705 2.498-5.096.703l-14.777-19.1c-1.593-1.744-.823-4.39 1.37-4.742l22.23-3.567c1.807-.292 3.271 1.401 2.769 3.177v-.019z"/>
    </svg>
  );
  
  const naverIcon = (
    <svg width="18" height="18" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFFFFF" d="M13.5285 10.824L6.47152 0.75H0.75V19.25H6.97152V9.176L14.0285 19.25H19.75V0.75H13.5285V10.824Z"/>
    </svg>
  );
  
  const googleIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
      </g>
    </svg>
  );
  
  const appleIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.33-.88 3.69-.73 1.58.23 2.76.89 3.53 2.24-3.2 2.1-2.69 6.11.48 7.65-.61 1.34-1.39 2.65-2.78 4.01m-6.89-15C10.29 2.68 12.7.75 15.29 1c.3 2.5-1.86 5.13-4.24 5.28-.3-2.5.42-3.5.11-4Z"/>
    </svg>
  );

  return (
    <div className="animate-fadeIn">
      {/* 오류 메시지 */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {/* 카카오 로그인 */}
        <SocialLoginButton
          provider="카카오"
          bgColor="bg-[#FEE500]"
          hoverColor="bg-[#F2D935]"
          textColor="black"
          icon={kakaoIcon}
          onClick={() => handleSocialLogin('카카오')}
        />

        {/* 네이버 로그인 */}
        <SocialLoginButton
          provider="네이버"
          bgColor="bg-[#03C75A]"
          hoverColor="bg-[#02B350]"
          textColor="white"
          icon={naverIcon}
          onClick={() => handleSocialLogin('네이버')}
        />

        {/* 구글 로그인 */}
        <SocialLoginButton
          provider="구글"
          bgColor="bg-white"
          hoverColor="bg-gray-50"
          textColor="gray-700"
          icon={googleIcon}
          onClick={() => handleSocialLogin('구글')}
        />

        {/* 애플 로그인 */}
        <SocialLoginButton
          provider="애플"
          bgColor="bg-black"
          hoverColor="bg-gray-900"
          textColor="white"
          icon={appleIcon}
          onClick={() => handleSocialLogin('애플')}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center items-center my-4">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-indigo-500 font-suite">로그인 중...</span>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 font-suite">
          다른 방법으로 로그인하고 싶으신가요?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            이메일로 로그인
          </Link>
        </p>
      </div>
    </div>
  );
} 