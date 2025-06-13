'use client';

import { useEffect, useState } from 'react';
import KakaoLogin from './KakaoLogin';

interface User {
  id: number;
  email: string | null;
  nickname: string;
  profile_image: string | null;
  provider: string;
}

export default function AuthHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('인증 확인 오류:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/kakao-auth', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setUser(null);
        // 카카오 SDK 로그아웃
        if (typeof window !== 'undefined' && window.Kakao && window.Kakao.Auth) {
          window.Kakao.Auth.logout();
        }
        window.location.reload();
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setShowLoginModal(false);
  };

  const handleLoginError = (error: string) => {
    console.error('로그인 오류:', error);
    alert(error);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      {user ? (
        <div className="flex items-center space-x-3">
          {user.profile_image && (
            <img
              src={user.profile_image}
              alt="프로필"
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-gray-700 font-medium">{user.nickname}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            로그인
          </button>
        </div>
      )}

      {/* 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">로그인</h2>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-600 text-center">
                SMAP 서비스를 이용하려면 로그인이 필요합니다.
              </p>
              <KakaoLogin
                onLoginSuccess={handleLoginSuccess}
                onLoginError={handleLoginError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 