'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

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
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)' }}
    >
      <div className="text-center">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <Image 
            src="/images/smap_logo.webp"
            alt="SMAP Logo"
            width={128}
            height={128}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">SMAP</h2>
        
        <div className="flex items-center justify-center space-x-2">
          <div 
            className="rounded-full h-6 w-6 border-4 border-gray-200 border-t-blue-500"
            style={{
              WebkitAnimation: 'spin 1s linear infinite',
              animation: 'spin 1s linear infinite',
              WebkitTransformOrigin: 'center',
              transformOrigin: 'center',
              willChange: 'transform'
            }}
          ></div>
          <p className="text-gray-600">
            {loading ? '로딩 중...' : '페이지 이동 중...'}
          </p>
        </div>
      </div>
    </div>
  );
} 