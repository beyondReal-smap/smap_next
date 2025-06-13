'use client';

import { useEffect, useState } from 'react';
import { API_KEYS } from '../config';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

interface User {
  id: number;
  email: string | null;
  nickname: string;
  profile_image: string | null;
  provider: string;
}

interface KakaoLoginProps {
  onLoginSuccess?: (user: User) => void;
  onLoginError?: (error: string) => void;
}

export default function KakaoLogin({ onLoginSuccess, onLoginError }: KakaoLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isKakaoLoaded, setIsKakaoLoaded] = useState(false);

  useEffect(() => {
    // 카카오 SDK 로드
    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(API_KEYS.KAKAO_LOGIN);
        setIsKakaoLoaded(true);
      }
    };
    document.head.appendChild(script);

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거
      document.head.removeChild(script);
    };
  }, []);

  const handleKakaoLogin = async () => {
    if (!isKakaoLoaded || !window.Kakao) {
      onLoginError?.('카카오 SDK가 로드되지 않았습니다.');
      return;
    }

    setIsLoading(true);

    try {
      // 카카오 로그인 팝업 띄우기
      window.Kakao.Auth.login({
        success: async (authObj: any) => {
          try {
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
              onLoginSuccess?.(data.user);
              // 페이지 새로고침하여 로그인 상태 반영
              window.location.reload();
            } else {
              onLoginError?.(data.error || '로그인에 실패했습니다.');
            }
          } catch (error) {
            console.error('로그인 처리 오류:', error);
            onLoginError?.('로그인 처리 중 오류가 발생했습니다.');
          }
        },
        fail: (error: any) => {
          console.error('카카오 로그인 실패:', error);
          onLoginError?.('카카오 로그인에 실패했습니다.');
        },
      });
    } catch (error) {
      console.error('로그인 오류:', error);
      onLoginError?.('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKakaoLogout = async () => {
    try {
      // 백엔드 로그아웃 API 호출
      const response = await fetch('/api/kakao-auth', {
        method: 'DELETE',
      });

      if (response.ok) {
        // 카카오 SDK 로그아웃
        if (window.Kakao && window.Kakao.Auth) {
          window.Kakao.Auth.logout();
        }
        // 페이지 새로고침하여 로그아웃 상태 반영
        window.location.reload();
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  if (!API_KEYS.KAKAO_LOGIN) {
    return (
      <div className="text-red-500 text-sm">
        카카오 앱 키가 설정되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <button
        onClick={handleKakaoLogin}
        disabled={isLoading || !isKakaoLoaded}
        className="flex items-center justify-center w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span>로그인 중...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a11.5 11.5 0 0 1-2.357-.249c-1.889 1.754-4.588 2.88-7.143 2.88-.192 0-.384-.007-.576-.019a.425.425 0 0 1-.395-.49c.047-.263.212-.513.444-.659.121-.076.237-.166.348-.263.526-.463.949-1.067 1.184-1.776C2.304 17.678 1.5 15.678 1.5 13.369 1.5 6.664 6.201 3 12 3z"/>
            </svg>
            <span>카카오로 로그인</span>
          </div>
        )}
      </button>
      
      {/* 개발 환경에서 로그아웃 버튼 표시 */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={handleKakaoLogout}
          className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
        >
          로그아웃
        </button>
      )}
    </div>
  );
} 