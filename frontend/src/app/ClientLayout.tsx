'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
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

  // 로딩 중이거나 인증되지 않은 상태에서 보호된 페이지에 접근하면 로딩 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#ffffff'}}>
        <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center space-y-4 max-w-xs mx-4">
          {/* 스피너 */}
          <div className="relative">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
          </div>
          
          {/* 로딩 텍스트 */}
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 mb-1">
              앱을 준비하는 중...
            </p>
            <p className="text-sm text-gray-600">
              잠시만 기다려주세요
            </p>
          </div>
          
          {/* 진행 표시 점들 */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#ffffff'}}>
        <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center space-y-4 max-w-xs mx-4">
          {/* 스피너 */}
          <div className="relative">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
          </div>
          
          {/* 로딩 텍스트 */}
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 mb-1">
              인증을 확인하는 중...
            </p>
            <p className="text-sm text-gray-600">
              잠시만 기다려주세요
            </p>
          </div>
          
          {/* 진행 표시 점들 */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
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
      <AuthProvider>
        <UserProvider>
          <AuthGuard>
            {children}
            {!shouldHideNavBar && <BottomNavBar />}
          </AuthGuard>
        </UserProvider>
      </AuthProvider>
    </SessionProvider>
  );
} 