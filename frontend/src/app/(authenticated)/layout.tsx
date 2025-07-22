'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '../components/layout/AppLayout';

// 범용 로딩 스피너 컴포넌트
function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
}

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 로딩이 끝났는데, 로그인이 되어있지 않다면 signin 페이지로 리디렉션
    if (!loading && !isLoggedIn) {
      console.log('[AUTH_LAYOUT] Not logged in, redirecting to signin...');
      router.push('/signin');
    }
  }, [isLoggedIn, loading, router]);

  // 로딩 중일 때는 로딩 화면을 보여줌
  if (loading) {
    return <FullPageSpinner />;
  }

  // 로그인 상태일 때만 실제 레이아웃과 컨텐츠를 렌더링
  if (isLoggedIn) {
    return <AppLayout>{children}</AppLayout>;
  }

  // 리디렉션이 실행되기 전까지 아무것도 렌더링하지 않음 (깜빡임 방지)
  return null;
} 