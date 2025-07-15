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

    // 로딩 중이면 대기
    if (loading) {
      return;
    }

    // 공개 페이지는 인증 체크 안함
    if (PUBLIC_ROUTES.includes(pathname)) {
      return;
    }

    // 로그인되지 않은 상태에서 보호된 페이지 접근 시 즉시 signin으로 리다이렉트
    // 단, 이미 signin 페이지에 있으면 리다이렉트하지 않음
    if (!isLoggedIn && pathname !== '/signin') {
      console.log('[AUTH GUARD] 인증되지 않은 접근, signin으로 리다이렉트:', pathname);
      router.replace('/signin'); // push 대신 replace 사용으로 뒤로가기 방지
      return;
    }
  }, [isLoggedIn, loading, pathname, router]);

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return <IOSCompatibleSpinner message="로딩 중..." fullScreen />;
  }

  // 인증되지 않은 사용자가 보호된 페이지에 접근하려는 경우 즉시 리다이렉트
  // 빈 화면 표시 없이 바로 signin으로 이동
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname) && pathname !== '/signin') {
    console.log('[AUTH GUARD] 인증되지 않은 사용자, 즉시 signin으로 리다이렉트');
    router.push('/signin');
    return null; // 빈 화면 대신 null 반환으로 즉시 리다이렉트
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

      // 네비게이션 바를 보여줄 페이지들만 지정 - 화이트리스트 방식
  const shouldHideNavBar = React.useMemo(() => {
    // 네비게이션바를 보여줄 페이지들 (정확한 경로 매칭)
    const showNavBarPages = ['/home', '/group', '/schedule', '/location', '/activelog'];
    
    // 현재 경로가 지정된 페이지들 중 하나로 시작하는지 확인
    const shouldShow = showNavBarPages.some(page => pathname?.startsWith(page));
    
    // notice 페이지는 네비게이션 바를 숨기는 페이지로 명시적 처리
    const isNoticePage = pathname?.startsWith('/notice');
    
    return !shouldShow || isNoticePage; // 지정된 페이지가 아니거나 notice 페이지면 숨김
  }, [pathname]);

  // body에 클래스 및 data-page 속성 추가/제거
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // data-page 속성 설정 (CSS에서 페이지별 스타일링을 위해)
      document.body.setAttribute('data-page', pathname);
      document.documentElement.setAttribute('data-page', pathname);
      
      if (shouldHideNavBar) {
          document.body.classList.add('hide-bottom-nav');
      } else {
        document.body.classList.remove('hide-bottom-nav');
      }
    }
    
    // 컴포넌트 언마운트 시 클래스 및 속성 제거
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('hide-bottom-nav');
        document.body.removeAttribute('data-page');
        document.documentElement.removeAttribute('data-page');
      }
    };
  }, [shouldHideNavBar, pathname]);
  
  // 디버깅용 로그 - 개발 환경에서만 출력 (성능 최적화)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // pathname이 실제로 변경될 때만 로그 출력
      console.log('[ClientLayout] 경로 변경:', pathname, '네비게이션 숨김:', shouldHideNavBar);
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
    <>
      <DataCacheProvider>
        <AuthProvider>
          <UserProvider>
            <AuthGuard>
              {children}
              {/* <PerformanceMonitor /> */}
            </AuthGuard>
          </UserProvider>
        </AuthProvider>
      </DataCacheProvider>
      
      {/* 전역 네비게이션 바 - 모든 페이지에서 일관된 위치 보장 */}
      {!shouldHideNavBar && <BottomNavBar />}
    </>
  );
} 