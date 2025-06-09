'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';

// 인증이 필요하지 않은 페이지들
const PUBLIC_ROUTES = ['/signin', '/register', '/'];

// 인증 가드 컴포넌트
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 로딩 중이면 대기
    if (loading) return;

    // 공개 페이지는 인증 체크 안함
    if (PUBLIC_ROUTES.includes(pathname)) return;

    // 로그인되지 않은 상태에서 보호된 페이지 접근 시 signin으로 리다이렉트
    if (!isLoggedIn) {
      console.log('[AUTH GUARD] 인증되지 않은 접근, signin으로 리다이렉트:', pathname);
      router.push('/signin');
      return;
    }
  }, [isLoggedIn, loading, pathname, router]);

  // 로딩 중이면 바로 children 렌더링
  if (loading) {
    return <>{children}</>;
  }

  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
    // 로그인 페이지로 리다이렉트 중이므로 기존 컨텐츠 유지
    return <>{children}</>;
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

  // 네비게이션 바를 숨길 페이지들
  const hideNavBarPages = ['/signin', '/register'];
  const shouldHideNavBar = hideNavBarPages.includes(pathname);

  // 클라이언트 측에서만 마운트
  useEffect(() => {
    setIsMounted(true);
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
            </AuthGuard>
          </UserProvider>
        </AuthProvider>
      </DataCacheProvider>
    </SessionProvider>
  );
} 