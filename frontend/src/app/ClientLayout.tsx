'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMapPreloader } from '@/hooks/useMapPreloader';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import PerformanceMonitor from '@/components/PerformanceMonitor';

// 인증이 필요하지 않은 페이지들 (루트 페이지는 자체적으로 리다이렉트 처리)
const PUBLIC_ROUTES = ['/signin', '/register', '/login', '/social-login', '/'];

// 인증 가드 컴포넌트
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('[AUTH GUARD] 상태 체크:', { 
      pathname, 
      isLoggedIn, 
      loading, 
      isPublicRoute: PUBLIC_ROUTES.includes(pathname) 
    });

    // 로딩 중이면 대기
    if (loading) {
      console.log('[AUTH GUARD] 로딩 중, 대기...');
      return;
    }

    // 공개 페이지는 인증 체크 안함
    if (PUBLIC_ROUTES.includes(pathname)) {
      console.log('[AUTH GUARD] 공개 페이지, 인증 체크 생략:', pathname);
      return;
    }

    // 로그인되지 않은 상태에서 보호된 페이지 접근 시 signin으로 리다이렉트
    if (!isLoggedIn) {
      console.log('[AUTH GUARD] 인증되지 않은 접근, signin으로 리다이렉트:', pathname);
      router.push('/signin');
      return;
    }

    console.log('[AUTH GUARD] 인증된 사용자, 접근 허용:', pathname);
  }, [isLoggedIn, loading, pathname, router]);

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 인증되지 않은 사용자가 보호된 페이지에 접근하려는 경우
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
    console.log('[AUTH GUARD] 인증되지 않은 사용자, 빈 화면 표시 (리다이렉트 대기)');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-600">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  // 지도 API 프리로딩 및 서비스 워커 등록
  useMapPreloader();
  useServiceWorker();

  // 네비게이션 바를 숨길 페이지들
  const hideNavBarPages = ['/signin', '/register', '/notice', '/setting'];
  const shouldHideNavBar = hideNavBarPages.some(page => pathname.startsWith(page));

  // 클라이언트 측에서만 마운트
  useEffect(() => {
    setIsMounted(true);
    console.log('[ClientLayout] 🚀 앱 초기화 완료 - 지도 API 프리로딩 및 서비스 워커 활성화');
  }, []);

  if (!isMounted) {
    return null; // 서버 사이드 렌더링 중에는 아무것도 렌더링하지 않음
  }

  return (
    <SessionProvider>
      <DataCacheProvider>
        <AuthProvider>
          <UserProvider>
            <AuthGuard>
              {children}
              {!shouldHideNavBar && <BottomNavBar />}
              <PerformanceMonitor />
            </AuthGuard>
          </UserProvider>
        </AuthProvider>
      </DataCacheProvider>
    </SessionProvider>
  );
} 