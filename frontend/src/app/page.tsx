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
  // 빈 화면 - 리다이렉트만 수행
  return null;
} 