'use client';

import React from 'react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';

export default function TestGooglePage() {
  const { isSignedIn, user, isLoading, error, isIOS } = useGoogleSignIn();

  const handleSuccess = (user: any) => {
    console.log('Google Sign-In 성공:', user);
    alert(`로그인 성공! 환영합니다, ${user.name}님!`);
  };

  const handleError = (error: string) => {
    console.error('Google Sign-In 실패:', error);
    alert(`로그인 실패: ${error}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          Google Sign-In 테스트
        </h1>

        <div className="space-y-4">
          {/* 환경 정보 */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">환경 정보</h3>
            <p className="text-sm">iOS: {isIOS ? '예' : '아니오'}</p>
            <p className="text-sm">로그인 상태: {isSignedIn ? '로그인됨' : '로그아웃됨'}</p>
            <p className="text-sm">로딩 중: {isLoading ? '예' : '아니오'}</p>
            {error && <p className="text-sm text-red-600">에러: {error}</p>}
          </div>

          {/* 사용자 정보 */}
          {isSignedIn && user && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">사용자 정보</h3>
              <p className="text-sm">이름: {user.name}</p>
              <p className="text-sm">이메일: {user.email}</p>
              {user.imageURL && (
                <img 
                  src={user.imageURL} 
                  alt="프로필" 
                  className="w-12 h-12 rounded-full mt-2"
                />
              )}
            </div>
          )}

          {/* Google Sign-In 버튼 */}
          <GoogleSignInButton
            onSuccess={handleSuccess}
            onError={handleError}
          />

          {/* iOS가 아닌 경우 안내 */}
          {!isIOS && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                이 기능은 iOS 앱에서만 동작합니다. 
                웹 브라우저에서는 기존 Google 로그인을 사용하세요.
              </p>
            </div>
          )}

          {/* 디버그 정보 */}
          <details className="bg-gray-50 p-4 rounded-lg">
            <summary className="cursor-pointer font-semibold">
              디버그 정보 (클릭하여 펼치기)
            </summary>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify({
                isIOS,
                isSignedIn,
                user,
                isLoading,
                error,
                userAgent: navigator.userAgent,
                hasWebkit: !!(window as any).webkit,
                hasMessageHandlers: !!(window as any).webkit?.messageHandlers,
                hasIosBridge: !!(window as any).iosBridge,
                hasGoogleSignIn: !!(window as any).iosBridge?.googleSignIn
              }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
} 