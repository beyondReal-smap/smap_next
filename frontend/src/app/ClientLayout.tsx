'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
// import { SessionProvider } from 'next-auth/react'; // 임시 비활성화
import { BottomNavBar } from './components/layout';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMapPreloader } from '@/hooks/useMapPreloader';
// iOS 호환 스피너 컴포넌트를 인라인으로 정의
// import { useServiceWorker } from '@/hooks/useServiceWorker';
// import PerformanceMonitor from '@/components/PerformanceMonitor';

// 인증이 필요하지 않은 페이지들 (루트 페이지는 자체적으로 리다이렉트 처리)
const PUBLIC_ROUTES = ['/signin', '/register', '/login', '/social-login', '/'];

import IOSCompatibleSpinner from '@/components/common/IOSCompatibleSpinner';

// 인증 가드 컴포넌트
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 앱 시작 시 대기 중인 그룹 가입 처리
  useEffect(() => {
    const handlePendingGroupJoin = async () => {
      // 로그인되지 않았거나 로딩 중이면 처리하지 않음
      if (!isLoggedIn || loading) return;
      
      const pendingJoin = localStorage.getItem('pendingGroupJoin');
      if (!pendingJoin) return;
      
      try {
        const { groupId, groupTitle, timestamp } = JSON.parse(pendingJoin);
        
        // 24시간 이내의 요청만 처리 (만료된 요청 방지)
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
          localStorage.removeItem('pendingGroupJoin');
          return;
        }
        
        console.log('[AuthGuard] 대기 중인 그룹 가입 처리:', { groupId, groupTitle });
        
        // 그룹 가입 API 호출
        const groupService = (await import('@/services/groupService')).default;
        await groupService.joinGroup(parseInt(groupId));
        
        // 성공 시 localStorage에서 제거
        localStorage.removeItem('pendingGroupJoin');
        
        // 그룹 페이지로 이동
        router.push('/group');
        
        // 성공 알림 (선택사항)
        console.log(`[AuthGuard] 그룹 "${groupTitle}" 가입 완료!`);
        
      } catch (error) {
        console.error('[AuthGuard] 자동 그룹 가입 실패:', error);
        // 실패해도 localStorage는 정리
        localStorage.removeItem('pendingGroupJoin');
      }
    };
    
    handlePendingGroupJoin();
  }, [isLoggedIn, loading, router]);

  useEffect(() => {
    // 🚫 전역 에러 모달 플래그 확인 - 모든 네비게이션 차단
    if (typeof window !== 'undefined' && (window as any).__SIGNIN_ERROR_MODAL_ACTIVE__) {
      console.log('[AUTH GUARD] 🚫 전역 에러 모달 활성화 - 모든 네비게이션 차단');
      return;
    }
    
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
    // 단, 이미 signin 페이지에 있으면 리다이렉트하지 않음
    if (!isLoggedIn && pathname !== '/signin') {
      console.log('[AUTH GUARD] 인증되지 않은 접근, signin으로 리다이렉트:', pathname);
      router.push('/signin');
      return;
    }

    console.log('[AUTH GUARD] 인증된 사용자, 접근 허용:', pathname);
  }, [isLoggedIn, loading, pathname, router]);

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return <IOSCompatibleSpinner message="로딩 중..." fullScreen />;
  }

  // 인증되지 않은 사용자가 보호된 페이지에 접근하려는 경우
  // 단, signin 페이지는 제외 (이미 signin 페이지에 있으면 스피너 표시하지 않음)
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname) && pathname !== '/signin') {
    console.log('[AUTH GUARD] 인증되지 않은 사용자, 빈 화면 표시 (리다이렉트 대기)');
    return <IOSCompatibleSpinner message="로그인 페이지로 이동 중..." fullScreen />;
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
  // useServiceWorker(); // 임시 비활성화
  
  // Service Worker 완전 해제 (페이지 새로고침 방지)
  useEffect(() => {
    const unregisterServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
            console.log('[ClientLayout] Service Worker 해제 완료:', registration.scope);
          }
          
          // 캐시도 모두 삭제
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('[ClientLayout] 모든 캐시 삭제 완료');
          }
        } catch (error) {
          console.error('[ClientLayout] Service Worker 해제 실패:', error);
        }
      }
    };
    
    unregisterServiceWorker();
  }, []);

  // 네비게이션 바를 숨길 페이지들 - useMemo로 최적화
  const shouldHideNavBar = React.useMemo(() => {
    const hideNavBarPages = ['/signin', '/register', '/notice', '/setting'];
    return hideNavBarPages.some(page => pathname.startsWith(page)) || 
           pathname === '/' || // 루트 페이지만 네비게이션 숨김
           pathname.includes('/join') || // 그룹 초대 페이지도 네비게이션 숨김
           pathname.match(/\/group\/\d+\/join/); // 정규식으로 그룹 초대 페이지 확실히 매칭
  }, [pathname]);
  
  // 디버깅용 로그 - 개발 환경에서만 출력
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ClientLayout] 현재 경로:', pathname);
      console.log('[ClientLayout] 네비게이션 숨김 여부:', shouldHideNavBar);
    }
  }, [pathname, shouldHideNavBar]);

  // 클라이언트 측에서만 마운트
  useEffect(() => {
    setIsMounted(true);
    console.log('[ClientLayout] 🚀 앱 초기화 완료 - 지도 API 프리로딩 및 서비스 워커 활성화');
  }, []);

  if (!isMounted) {
    return null; // 서버 사이드 렌더링 중에는 아무것도 렌더링하지 않음
  }

  return (
    <DataCacheProvider>
      <AuthProvider>
        <UserProvider>
          <AuthGuard>
            {children}
            {!shouldHideNavBar && <BottomNavBar />}
            {/* <PerformanceMonitor /> */}
          </AuthGuard>
        </UserProvider>
      </AuthProvider>
    </DataCacheProvider>
  );
} 