'use client';

import React from 'react';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function GoogleSignInButton({ 
  onSuccess, 
  onError, 
  className 
}: GoogleSignInButtonProps) {
  const { 
    isSignedIn, 
    user, 
    isLoading, 
    error, 
    isIOS, 
    signIn, 
    signOut, 
    clearError 
  } = useGoogleSignIn();

  // 로그인 성공 시 콜백 실행
  React.useEffect(() => {
    if (isSignedIn && user && onSuccess) {
      onSuccess(user);
    }
  }, [isSignedIn, user, onSuccess]);

  // 에러 발생 시 콜백 실행
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleGoogleSignIn = () => {
    clearError();
    signIn();
  };

  const handleGoogleSignOut = () => {
    clearError();
    signOut();
  };

  // iOS가 아닌 경우 표시하지 않음
  if (!isIOS) {
    return null;
  }

  return (
    <div className={className}>
      {!isSignedIn ? (
        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          variant="primary"
          size="lg"
          className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
          hapticType="medium"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Google로 로그인
        </Button>
      ) : (
        <div className="space-y-4">
          {/* 사용자 정보 표시 */}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            {user?.imageURL && (
              <img
                src={user.imageURL}
                alt={user.name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          {/* 로그아웃 버튼 */}
          <Button
            onClick={handleGoogleSignOut}
            variant="secondary"
            size="md"
            className="w-full"
            hapticType="medium"
          >
            Google 로그아웃
          </Button>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
} 