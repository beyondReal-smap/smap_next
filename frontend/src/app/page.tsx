'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    console.log('[ROOT PAGE] 인증 상태 체크:', { isLoggedIn, loading });

    // 로딩 중이면 대기
    if (loading) {
      console.log('[ROOT PAGE] 로딩 중, 대기...');
      return;
    }

    // 로그인된 사용자는 홈으로 리다이렉트
    if (isLoggedIn) {
      console.log('[ROOT PAGE] 로그인된 사용자, /home으로 리다이렉트');
      router.replace('/home');
      return;
    }

    // 로그인되지 않은 사용자는 signin으로 리다이렉트
    console.log('[ROOT PAGE] 로그인되지 않은 사용자, /signin으로 리다이렉트');
    router.replace('/signin');
  }, [isLoggedIn, loading, router]);

  // 추가 안전장치: 컴포넌트 마운트 시에도 체크
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        console.log('[ROOT PAGE] 타이머 체크:', { isLoggedIn, loading });
        if (isLoggedIn) {
          router.replace('/home');
        } else {
          router.replace('/signin');
        }
      }
    }, 1000); // 1초 후 재체크

    return () => clearTimeout(timer);
  }, []);

  // 로딩 화면 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-green-500 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
            <h1 className="text-4xl text-green-600 font-bold">S</h1>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">스맵</h2>
        
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          <p className="text-gray-600">
            {loading ? '로딩 중...' : '페이지 이동 중...'}
          </p>
        </div>
      </div>
    </div>
  );
} 